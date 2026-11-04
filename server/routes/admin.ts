import express, { type Response } from 'express'
import { currentUser, endAllSessions, requireRole, type Role } from '../auth.ts'
import { createSuperUser, deleteAccount } from '../accounts.ts'
import {
  adminAccounts,
  matchmakerAccounts,
  matchmakerRow,
  pendingApplications,
  profileRowForUser,
  seekerAccounts,
  toProfile,
} from '../data.ts'
import { get, run } from '../db.ts'
import { applicationDecisionEmail, superUserWelcomeEmail } from '../emails.ts'
import { APP_URL, fail } from '../http.ts'
import { sendEmail } from '../mailer.ts'
import { REALM_PATHS, sendPasswordReset } from './auth.ts'

/** Super users (/admin): every seeker and matchmaker account, and matchmaker applications. */
export const adminRoutes = express.Router()
adminRoutes.use(requireRole('admin'))

interface AccountRow {
  id: string
  email: string
  role: Role
  suspended_at: number | null
}

const me = (res: Response) => currentUser(res, 'admin')!

function account(res: Response, id: string): AccountRow | undefined {
  const row = get<AccountRow>('SELECT id, email, role, suspended_at FROM users WHERE id = ?', id)
  if (!row) fail(res, 404, 'Account not found.')
  return row
}

/** True if taking this super user away would leave no active super user. */
function isLastSuperUser(row: AccountRow): boolean {
  if (row.role !== 'admin' || row.suspended_at !== null) return false
  return !get(`SELECT 1 FROM users WHERE role = 'admin' AND suspended_at IS NULL AND id <> ?`, row.id)
}

adminRoutes.get('/state', (_req, res) => {
  const user = me(res)
  res.json({
    me: { id: user.id, email: user.email },
    seekers: seekerAccounts(),
    matchmakers: matchmakerAccounts(),
    admins: adminAccounts(),
    applications: pendingApplications(),
  })
})

/** A seeker's full profile (photos and contact included), for a super user to review. */
adminRoutes.get('/seekers/:id', (req, res) => {
  const row = account(res, req.params.id)
  if (!row) return
  if (row.role !== 'seeker') return fail(res, 404, 'Account not found.')
  const profile = profileRowForUser(row.id)
  res.json({ profile: profile ? toProfile(profile) : null })
})

/* ---------- Suspend, reactivate, delete, password reset ---------- */

adminRoutes.post('/accounts/:id/suspend', (req, res) => {
  const row = account(res, req.params.id)
  if (!row) return
  if (row.id === me(res).id) return fail(res, 400, 'You can’t suspend your own account.')
  if (isLastSuperUser(row)) return fail(res, 400, 'This is the only active super user, so it can’t be suspended.')
  run('UPDATE users SET suspended_at = ? WHERE id = ? AND suspended_at IS NULL', Date.now(), row.id)
  // Signed out everywhere straight away.
  endAllSessions(row.id)
  res.json({ ok: true })
})

adminRoutes.post('/accounts/:id/reactivate', (req, res) => {
  const row = account(res, req.params.id)
  if (!row) return
  run('UPDATE users SET suspended_at = NULL WHERE id = ?', row.id)
  res.json({ ok: true })
})

/** Deletes any account. For a super user this removes their super-user rights. */
adminRoutes.delete('/accounts/:id', (req, res) => {
  const row = account(res, req.params.id)
  if (!row) return
  if (row.id === me(res).id) return fail(res, 400, 'You can’t delete your own account.')
  if (isLastSuperUser(row)) return fail(res, 400, 'This is the only active super user, so it can’t be removed.')
  deleteAccount(row.id)
  res.json({ ok: true })
})

adminRoutes.post('/accounts/:id/password-reset', (req, res) => {
  const row = account(res, req.params.id)
  if (!row) return
  if (row.suspended_at !== null) return fail(res, 400, 'Reactivate this account before sending a password reset.')
  if (!sendPasswordReset(row)) return fail(res, 429, 'A reset link was sent to this account moments ago.')
  res.json({ ok: true })
})

/* ---------- Super users ---------- */

/**
 * Gives a matchmaker super-user rights: a separate admin account with the same email. They
 * choose its password from an emailed link.
 */
adminRoutes.post('/accounts/:id/promote', async (req, res) => {
  const row = account(res, req.params.id)
  if (!row) return
  const mm = matchmakerRow(row.id)
  if (row.role !== 'matchmaker' || !mm?.approved_at) return fail(res, 400, 'Only approved matchmakers can be promoted.')
  if (row.suspended_at !== null) return fail(res, 400, 'Reactivate this account before promoting it.')
  if (get(`SELECT 1 FROM users WHERE role = 'admin' AND (email = ? OR promoted_from = ?)`, row.email, row.id)) {
    return fail(res, 409, `${mm.display_name} is already a super user.`)
  }
  const admin = await createSuperUser(row.email, undefined, row.id)
  sendPasswordReset(admin, superUserWelcomeEmail)
  res.status(201).json({ ok: true })
})

/* ---------- Matchmaker applications ---------- */

/** Approves a public matchmaker application: they can now see members and take on requests. */
adminRoutes.post('/applications/:id/approve', (req, res) => {
  const applicant = matchmakerRow(req.params.id)
  if (!applicant || applicant.approved_at) return fail(res, 404, 'Application not found.')
  run('UPDATE matchmakers SET approved_at = ? WHERE user_id = ?', Date.now(), applicant.user_id)
  const link = `${APP_URL}${REALM_PATHS.matchmaker}`
  sendEmail(applicationDecisionEmail(applicant.email, applicant.display_name, true, link)).catch((error) =>
    console.error('Could not send approval email:', error),
  )
  res.json({ ok: true })
})

/** Declines an application and removes the pending account. */
adminRoutes.post('/applications/:id/decline', (req, res) => {
  const applicant = matchmakerRow(req.params.id)
  if (!applicant || applicant.approved_at) return fail(res, 404, 'Application not found.')
  deleteAccount(applicant.user_id)
  sendEmail(applicationDecisionEmail(applicant.email, applicant.display_name, false, `${APP_URL}/`)).catch((error) =>
    console.error('Could not send decline email:', error),
  )
  res.json({ ok: true })
})
