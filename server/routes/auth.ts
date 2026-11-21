import { randomBytes, randomUUID } from 'node:crypto'
import express from 'express'
import {
  createUser,
  currentUser,
  endSession,
  hashPassword,
  rateLimit,
  startSession,
  userById,
  verifyPassword,
  type Role,
} from '../auth.ts'
import { all, get, run, transaction } from '../db.ts'
import { matchmakerApplicationEmail, passwordChangedEmail, passwordResetEmail } from '../emails.ts'
import { APP_URL, EMAIL, fail, optionalText, sha256, textList } from '../http.ts'
import { sendEmailInBackground, type Email } from '../mailer.ts'

/**
 * Sign-up, login, logout, password reset and matchmaker sign-up by invitation.
 * Seekers (public site), matchmakers (/staff/*) and super users (/admin/*) are separate realms.
 */
export const authRoutes = express.Router()

function validCredentials(email: unknown, password: unknown): string | null {
  if (typeof email !== 'string' || !EMAIL.test(email.trim())) return 'Enter a valid email address.'
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters.'
  return null
}

const SUSPENDED = 'This account has been suspended. Please contact MatchMeHub support.'

/** Each realm's area of the site, used in links in emails. */
export const REALM_PATHS: Record<Role, string> = { seeker: '/', matchmaker: '/matchmaker', admin: '/admin' }

/** The realm names the client uses ('staff' is the matchmaker realm). */
type Realm = 'seeker' | 'staff' | 'admin'
const REALM_ROLES: Record<Realm, Role> = { seeker: 'seeker', staff: 'matchmaker', admin: 'admin' }
const realmOf = (role: Role): Realm => (role === 'matchmaker' ? 'staff' : role)

/** Emails are unique per realm: a seeker and a matchmaker account may share one. */
const emailTaken = async (email: string, role: Role) =>
  !!(await get('SELECT 1 FROM users WHERE email = ? AND role = ?', email.trim().toLowerCase(), role))

/** Seekers sign up freely. Matchmakers can only join through an invitation (below). */
authRoutes.post('/signup', rateLimit, async (req, res) => {
  const { email, password, agreeTerms } = req.body ?? {}
  const problem = validCredentials(email, password)
  if (problem) return fail(res, 400, problem)
  if (agreeTerms !== true) {
    return fail(res, 400, 'Please confirm you’re 18 or over and agree to the terms and privacy policy.')
  }
  if (await emailTaken(email, 'seeker')) return fail(res, 409, 'An account with that email already exists. Try logging in.')
  const user = await createUser(email, password, 'seeker')
  await run('UPDATE users SET terms_accepted_at = ? WHERE id = ?', Date.now(), user.id)
  await startSession(req, res, user)
  res.status(201).json({ user })
})

/**
 * Log-in, log-out and "who am I" for one realm. A log-in only matches accounts of its own
 * realm; any other account gets the same answer as a wrong password.
 */
function realmRoutes(prefix: string, role: Role) {
  authRoutes.post(`${prefix}/login`, rateLimit, async (req, res) => {
    const { email, password } = req.body ?? {}
    if (typeof email !== 'string' || typeof password !== 'string') return fail(res, 400, 'Enter your email and password.')
    const row = await get<{ id: string; password_hash: string; suspended_at: number | null }>(
      'SELECT id, password_hash, suspended_at FROM users WHERE email = ? AND role = ?',
      email.trim().toLowerCase(),
      role,
    )
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      return fail(res, 401, 'Email or password is incorrect.')
    }
    // Only said after the right password, so it doesn't reveal which accounts exist.
    if (row.suspended_at !== null) return fail(res, 403, SUSPENDED)
    // Signing in to the backoffice signs the browser out of the public site first.
    await startSession(req, res, { id: row.id, role })
    res.json({ user: await userById(row.id) })
  })

  authRoutes.post(`${prefix}/logout`, async (req, res) => {
    await endSession(req, res, role)
    res.json({ ok: true })
  })

  authRoutes.get(`${prefix}/me`, (_req, res) => {
    res.json({ user: currentUser(res, role) ?? null })
  })
}

realmRoutes('', 'seeker')
realmRoutes('/staff', 'matchmaker')
realmRoutes('/admin', 'admin')

/* ---------- Matchmaker sign-up by invitation ---------- */

interface InviteRow {
  id: string
  email: string | null
  expires_at: number
  used_at: number | null
}

export async function findInvite(token: unknown): Promise<InviteRow | undefined> {
  if (typeof token !== 'string' || !token) return undefined
  const invite = await get<InviteRow>('SELECT id, email, expires_at, used_at FROM invites WHERE token_hash = ?', sha256(token))
  return invite && !invite.used_at && invite.expires_at > Date.now() ? invite : undefined
}

const MATCHMAKER_AGREEMENT =
  'Please agree to the matchmaker code of conduct and keep members’ information confidential.'

authRoutes.post('/signup-matchmaker', rateLimit, async (req, res) => {
  const { token, email, password, displayName, agreeConfidentiality } = req.body ?? {}
  const invite = await findInvite(token)
  if (!invite) return fail(res, 400, 'This invitation has expired or has already been used. Ask your team for a new one.')
  const problem = validCredentials(email, password)
  if (problem) return fail(res, 400, problem)
  if (agreeConfidentiality !== true) return fail(res, 400, MATCHMAKER_AGREEMENT)
  if (invite.email && invite.email.toLowerCase() !== email.trim().toLowerCase()) {
    return fail(res, 400, `This invitation is for ${invite.email}. Sign up with that address.`)
  }
  if (typeof displayName !== 'string' || !displayName.trim() || displayName.trim().length > 60) {
    return fail(res, 400, 'Enter the name seekers will see (up to 60 characters).')
  }
  if (await emailTaken(email, 'matchmaker')) return fail(res, 409, 'A staff account with that email already exists.')

  const passwordHash = await hashPassword(password)
  const userId = randomUUID()
  const now = Date.now()
  const ok = await transaction(async (tx) => {
    // Claim the invitation atomically so it can only be used once.
    if ((await tx.run('UPDATE invites SET used_at = ? WHERE id = ? AND used_at IS NULL', now, invite.id)).changes !== 1) return false
    await tx.run(
      'INSERT INTO users (id, email, password_hash, role, created_at, terms_accepted_at) VALUES (?, ?, ?, ?, ?, ?)',
      userId,
      email.trim().toLowerCase(),
      passwordHash,
      'matchmaker',
      now,
      now,
    )
    // Invited by a teammate, so approved straight away.
    await tx.run(
      'INSERT INTO matchmakers (user_id, display_name, updated_at, approved_at) VALUES (?, ?, ?, ?)',
      userId,
      displayName.trim(),
      now,
      now,
    )
    await tx.run('UPDATE invites SET used_by = ? WHERE id = ?', userId, invite.id)
    return true
  })
  if (!ok) return fail(res, 400, 'This invitation has already been used.')
  await startSession(req, res, { id: userId, role: 'matchmaker' })
  res.status(201).json({ user: await userById(userId) })
})

/* ---------- Matchmaker applications (public) ---------- */

/**
 * Anyone can apply to be a matchmaker. The account is created as *pending*: it isn't signed in,
 * and if it logs in at /matchmaker it sees nothing until a super user approves the application.
 */
authRoutes.post('/apply-matchmaker', rateLimit, async (req, res) => {
  const { email, password, displayName, experience, languages, agreeConfidentiality } = req.body ?? {}
  const problem = validCredentials(email, password)
  if (problem) return fail(res, 400, problem)
  if (agreeConfidentiality !== true) return fail(res, 400, MATCHMAKER_AGREEMENT)
  const name = optionalText(displayName, 'Name', 60)
  if (!name) return fail(res, 400, 'Enter the name seekers will see (up to 60 characters).')
  const about = optionalText(experience, 'Experience', 2000)
  if (!about || about.length < 30) {
    return fail(res, 400, 'Tell us a little about your matchmaking experience (at least 30 characters).')
  }
  const langs = textList(languages, 'Languages', 10, 40)
  if (await emailTaken(email, 'matchmaker')) {
    return fail(res, 409, 'An application or matchmaker account with that email already exists.')
  }

  const userId = randomUUID()
  const now = Date.now()
  const passwordHash = await hashPassword(password)
  await transaction(async (tx) => {
    await tx.run(
      'INSERT INTO users (id, email, password_hash, role, created_at, terms_accepted_at) VALUES (?, ?, ?, ?, ?, ?)',
      userId,
      email.trim().toLowerCase(),
      passwordHash,
      'matchmaker',
      now,
      now,
    )
    await tx.run(
      `INSERT INTO matchmakers (user_id, display_name, bio, languages, application, updated_at, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      userId,
      name,
      about,
      JSON.stringify(langs),
      JSON.stringify({ experience: about, appliedAt: now }),
      now,
    )
  })

  // Let the super users know there's an application to review.
  const admins = await all<{ email: string }>(`SELECT email FROM users WHERE role = 'admin' AND suspended_at IS NULL`)
  for (const admin of admins) {
    sendEmailInBackground(matchmakerApplicationEmail(admin.email, name, `${APP_URL}${REALM_PATHS.admin}`), 'application')
  }

  // No session: the applicant is told the application is being processed, and hears by email.
  res.status(201).json({ ok: true })
})

/* ---------- Password reset ---------- */

const RESET_TTL_MS = 60 * 60_000
/** Don't send another reset email to the same account within this window. */
const RESET_RESEND_MS = 2 * 60_000

/**
 * Emails the user a one-time link to choose a new password, unless one was sent moments ago.
 * Used by "Forgot your password?" and by super users. Returns false if it was skipped.
 */
export async function sendPasswordReset(
  user: { id: string; email: string; role: Role },
  makeEmail: (to: string, link: string) => Email = passwordResetEmail,
): Promise<boolean> {
  const now = Date.now()
  // The token only ever exists in the email; the database keeps its hash.
  const token = randomBytes(32).toString('base64url')
  // Checked and created in one transaction, so two requests at once send one email, not two.
  const created = await transaction(async (tx) => {
    await tx.run('DELETE FROM password_resets WHERE user_id = ? AND (used_at IS NOT NULL OR expires_at < ?)', user.id, now)
    const recent = await tx.get(
      'SELECT 1 FROM password_resets WHERE user_id = ? AND expires_at > ?',
      user.id,
      now + RESET_TTL_MS - RESET_RESEND_MS,
    )
    if (recent) return false
    await tx.run('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)', sha256(token), user.id, now + RESET_TTL_MS)
    return true
  })
  if (!created) return false
  // In the URL fragment, so the token isn't sent to servers or leaked in Referer headers. The
  // path takes them back to their own area of the site.
  const link = `${APP_URL}${REALM_PATHS[user.role]}#reset=${token}`
  sendEmailInBackground(makeEmail(user.email, link), 'password reset')
  return true
}

authRoutes.post('/forgot', rateLimit, async (req, res) => {
  const { email, realm } = req.body ?? {}
  if (typeof email !== 'string' || !EMAIL.test(email.trim())) return fail(res, 400, 'Enter a valid email address.')
  // Resets are per realm too: the staff form only ever resets a staff account.
  const role = REALM_ROLES[realm as Realm] ?? 'seeker'
  const user = await get<{ id: string; email: string }>(
    'SELECT id, email FROM users WHERE email = ? AND role = ? AND suspended_at IS NULL',
    email.trim().toLowerCase(),
    role,
  )
  if (user) await sendPasswordReset({ ...user, role })
  // Same answer whether or not the account exists, so this can't be used to discover members.
  res.json({ ok: true })
})

authRoutes.post('/reset', rateLimit, async (req, res) => {
  const { token, password } = req.body ?? {}
  if (typeof token !== 'string' || !token) return fail(res, 400, 'This reset link is invalid.')
  if (typeof password !== 'string' || password.length < 8) return fail(res, 400, 'Password must be at least 8 characters.')
  const tokenHash = sha256(token)
  const reset = await get<{ user_id: string; expires_at: number; used_at: number | null }>(
    'SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?',
    tokenHash,
  )
  const expired = 'This reset link has expired or has already been used. Please request a new one.'
  if (!reset || reset.used_at || reset.expires_at < Date.now()) return fail(res, 400, expired)
  if (await get('SELECT 1 FROM users WHERE id = ? AND suspended_at IS NOT NULL', reset.user_id)) return fail(res, 403, SUSPENDED)

  const passwordHash = await hashPassword(password)
  const ok = await transaction(async (tx) => {
    // Claim the token atomically so it can only ever be used once.
    const claimed = await tx.run('UPDATE password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL', Date.now(), tokenHash)
    if (claimed.changes !== 1) return false
    await tx.run('UPDATE users SET password_hash = ? WHERE id = ?', passwordHash, reset.user_id)
    // Invalidate any other outstanding links and sign out every existing session.
    await tx.run('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL', Date.now(), reset.user_id)
    await tx.run('DELETE FROM sessions WHERE user_id = ?', reset.user_id)
    return true
  })
  if (!ok) return fail(res, 400, expired)

  // Signs in to the realm the account belongs to.
  const user = (await userById(reset.user_id))!
  await startSession(req, res, user)
  sendEmailInBackground(passwordChangedEmail(user.email), 'password changed')
  res.json({ user, realm: realmOf(user.role) })
})
