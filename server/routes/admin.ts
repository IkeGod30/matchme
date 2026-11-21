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
import { sendEmailInBackground } from '../mailer.ts'
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

async function account(res: Response, id: string): Promise<AccountRow | undefined> {
  const row = await get<AccountRow>('SELECT id, email, role, suspended_at FROM users WHERE id = ?', id)
  if (!row) fail(res, 404, 'Account not found.')
  return row
}

adminRoutes.get('/state', async (_req, res) => {
  const user = me(res)
  res.json({
    me: { id: user.id, email: user.email },
    seekers: await seekerAccounts(),
    matchmakers: await matchmakerAccounts(),
    admins: await adminAccounts(),
    applications: await pendingApplications(),
  })
})

/** A seeker's full profile (photos and contact included), for a super user to review. */
adminRoutes.get('/seekers/:id', async (req, res) => {
  const row = await account(res, req.params.id)
  if (!row) return
  if (row.role !== 'seeker') return fail(res, 404, 'Account not found.')
  const profile = await profileRowForUser(row.id)
  res.json({ profile: profile ? await toProfile(profile) : null })
})

/* ---------- Suspend, reactivate, delete, password reset ---------- */

adminRoutes.post('/accounts/:id/suspend', async (req, res) => {
  const row = await account(res, req.params.id)
  if (!row) return
  if (row.id === me(res).id) return fail(res, 400, 'You can’t suspend your own account.')
  // The "another active super user remains" check is part of the update, so two super users
  // suspending each other at the same moment can't leave nobody in charge.
  const { changes } = await run(
    `UPDATE users SET suspended_at = ? WHERE id = ? AND suspended_at IS NULL
       AND (role <> 'admin' OR EXISTS (SELECT 1 FROM users WHERE role = 'admin' AND suspended_at IS NULL AND id <> ?))`,
    Date.now(),
    row.id,
    row.id,
  )
  if (changes === 0) {
    const now = await get<{ suspended_at: number | null }>('SELECT suspended_at FROM users WHERE id = ?', row.id)
    if (!now) return fail(res, 404, 'Account not found.')
    if (now.suspended_at === null) return fail(res, 400, 'This is the only active super user, so it can’t be suspended.')
  }
  // Signed out everywhere straight away.
  await endAllSessions(row.id)
  res.json({ ok: true })
})

adminRoutes.post('/accounts/:id/reactivate', async (req, res) => {
  const row = await account(res, req.params.id)
  if (!row) return
  await run('UPDATE users SET suspended_at = NULL WHERE id = ?', row.id)
  res.json({ ok: true })
})

/** Deletes any account. For a super user this removes their super-user rights. */
adminRoutes.delete('/accounts/:id', async (req, res) => {
  const row = await account(res, req.params.id)
  if (!row) return
  if (row.id === me(res).id) return fail(res, 400, 'You can’t delete your own account.')
  const result = await deleteAccount(row.id, { keepLastSuperUser: true })
  if (result === 'last-super-user') return fail(res, 400, 'This is the only active super user, so it can’t be removed.')
  if (result === 'not-found') return fail(res, 404, 'Account not found.')
  res.json({ ok: true })
})

adminRoutes.post('/accounts/:id/password-reset', async (req, res) => {
  const row = await account(res, req.params.id)
  if (!row) return
  if (row.suspended_at !== null) return fail(res, 400, 'Reactivate this account before sending a password reset.')
  if (!(await sendPasswordReset(row))) return fail(res, 429, 'A reset link was sent to this account moments ago.')
  res.json({ ok: true })
})

/* ---------- Super users ---------- */

/**
 * Gives a matchmaker super-user rights: a separate admin account with the same email. They
 * choose its password from an emailed link.
 */
adminRoutes.post('/accounts/:id/promote', async (req, res) => {
  const row = await account(res, req.params.id)
  if (!row) return
  const mm = await matchmakerRow(row.id)
  if (row.role !== 'matchmaker' || !mm?.approved_at) return fail(res, 400, 'Only approved matchmakers can be promoted.')
  if (row.suspended_at !== null) return fail(res, 400, 'Reactivate this account before promoting it.')
  if (await get(`SELECT 1 FROM users WHERE role = 'admin' AND (email = ? OR promoted_from = ?)`, row.email, row.id)) {
    return fail(res, 409, `${mm.display_name} is already a super user.`)
  }
  const admin = await createSuperUser(row.email, undefined, row.id)
  await sendPasswordReset(admin, superUserWelcomeEmail)
  res.status(201).json({ ok: true })
})

/* ---------- Matchmaker applications ---------- */

/** Approves a public matchmaker application: they can now see members and take on requests. */
adminRoutes.post('/applications/:id/approve', async (req, res) => {
  const applicant = await matchmakerRow(req.params.id)
  if (!applicant || applicant.approved_at) return fail(res, 404, 'Application not found.')
  // Only the first of two approvals at once goes through (and sends the email).
  const { changes } = await run(
    'UPDATE matchmakers SET approved_at = ? WHERE user_id = ? AND approved_at IS NULL',
    Date.now(),
    applicant.user_id,
  )
  if (changes !== 1) return fail(res, 404, 'Application not found.')
  const link = `${APP_URL}${REALM_PATHS.matchmaker}`
  sendEmailInBackground(applicationDecisionEmail(applicant.email, applicant.display_name, true, link), 'approval')
  res.json({ ok: true })
})

/** Declines an application and removes the pending account. */
adminRoutes.post('/applications/:id/decline', async (req, res) => {
  const applicant = await matchmakerRow(req.params.id)
  if (!applicant || applicant.approved_at) return fail(res, 404, 'Application not found.')
  if ((await deleteAccount(applicant.user_id)) !== 'deleted') return fail(res, 404, 'Application not found.')
  sendEmailInBackground(applicationDecisionEmail(applicant.email, applicant.display_name, false, `${APP_URL}/`), 'decline')
  res.json({ ok: true })
})
