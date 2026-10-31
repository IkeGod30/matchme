import { randomBytes, randomUUID } from 'node:crypto'
import express from 'express'
import { createUser, currentUser, endSession, hashPassword, rateLimit, startSession, userById, verifyPassword } from '../auth.ts'
import { all, get, run, transaction } from '../db.ts'
import { matchmakerApplicationEmail, passwordChangedEmail, passwordResetEmail } from '../emails.ts'
import { APP_URL, EMAIL, fail, optionalText, sha256, textList } from '../http.ts'
import { sendEmail } from '../mailer.ts'

/** Sign-up, login, logout, password reset and matchmaker sign-up by invitation. */
export const authRoutes = express.Router()

function validCredentials(email: unknown, password: unknown): string | null {
  if (typeof email !== 'string' || !EMAIL.test(email.trim())) return 'Enter a valid email address.'
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters.'
  return null
}

const emailTaken = (email: string) => !!get('SELECT 1 FROM users WHERE email = ?', email.trim().toLowerCase())

/** Seekers sign up freely. Matchmakers can only join through an invitation (below). */
authRoutes.post('/signup', rateLimit, async (req, res) => {
  const { email, password } = req.body ?? {}
  const problem = validCredentials(email, password)
  if (problem) return fail(res, 400, problem)
  if (emailTaken(email)) return fail(res, 409, 'An account with that email already exists. Try logging in.')
  const user = await createUser(email, password, 'seeker')
  startSession(res, user.id)
  res.status(201).json({ user })
})

authRoutes.post('/login', rateLimit, async (req, res) => {
  const { email, password } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string') return fail(res, 400, 'Enter your email and password.')
  const row = get<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE email = ?',
    email.trim().toLowerCase(),
  )
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return fail(res, 401, 'Email or password is incorrect.')
  }
  startSession(res, row.id)
  res.json({ user: userById(row.id) })
})

authRoutes.post('/logout', (req, res) => {
  endSession(req, res)
  res.json({ ok: true })
})

authRoutes.get('/me', (_req, res) => {
  res.json({ user: currentUser(res) ?? null })
})

/* ---------- Matchmaker sign-up by invitation ---------- */

interface InviteRow {
  id: string
  email: string | null
  expires_at: number
  used_at: number | null
}

export function findInvite(token: unknown): InviteRow | undefined {
  if (typeof token !== 'string' || !token) return undefined
  const invite = get<InviteRow>('SELECT id, email, expires_at, used_at FROM invites WHERE token_hash = ?', sha256(token))
  return invite && !invite.used_at && invite.expires_at > Date.now() ? invite : undefined
}

authRoutes.post('/signup-matchmaker', rateLimit, async (req, res) => {
  const { token, email, password, displayName } = req.body ?? {}
  const invite = findInvite(token)
  if (!invite) return fail(res, 400, 'This invitation has expired or has already been used. Ask your team for a new one.')
  const problem = validCredentials(email, password)
  if (problem) return fail(res, 400, problem)
  if (invite.email && invite.email.toLowerCase() !== email.trim().toLowerCase()) {
    return fail(res, 400, `This invitation is for ${invite.email}. Sign up with that address.`)
  }
  if (typeof displayName !== 'string' || !displayName.trim() || displayName.trim().length > 60) {
    return fail(res, 400, 'Enter the name seekers will see (up to 60 characters).')
  }
  if (emailTaken(email)) return fail(res, 409, 'An account with that email already exists.')

  const passwordHash = await hashPassword(password)
  const userId = randomUUID()
  const now = Date.now()
  const ok = transaction(() => {
    // Claim the invitation atomically so it can only be used once.
    if (Number(run('UPDATE invites SET used_at = ? WHERE id = ? AND used_at IS NULL', now, invite.id).changes) !== 1) return false
    run(
      'INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      userId,
      email.trim().toLowerCase(),
      passwordHash,
      'matchmaker',
      now,
    )
    // Invited by a teammate, so approved straight away.
    run(
      'INSERT INTO matchmakers (user_id, display_name, updated_at, approved_at) VALUES (?, ?, ?, ?)',
      userId,
      displayName.trim(),
      now,
      now,
    )
    run('UPDATE invites SET used_by = ? WHERE id = ?', userId, invite.id)
    return true
  })
  if (!ok) return fail(res, 400, 'This invitation has already been used.')
  startSession(res, userId)
  res.status(201).json({ user: userById(userId) })
})

/* ---------- Matchmaker applications (public) ---------- */

/**
 * Anyone can apply to be a matchmaker. The account is created as *pending*: it can log in
 * but sees no members or requests until an approved matchmaker approves the application.
 */
authRoutes.post('/apply-matchmaker', rateLimit, async (req, res) => {
  const { email, password, displayName, experience, languages, agreeConfidentiality } = req.body ?? {}
  const problem = validCredentials(email, password)
  if (problem) return fail(res, 400, problem)
  if (agreeConfidentiality !== true) {
    return fail(res, 400, 'Please agree to keep members’ information confidential.')
  }
  const name = optionalText(displayName, 'Name', 60)
  if (!name) return fail(res, 400, 'Enter the name seekers will see (up to 60 characters).')
  const about = optionalText(experience, 'Experience', 2000)
  if (!about || about.length < 30) {
    return fail(res, 400, 'Tell us a little about your matchmaking experience (at least 30 characters).')
  }
  const langs = textList(languages, 'Languages', 10, 40)
  if (emailTaken(email)) return fail(res, 409, 'An account with that email already exists. Try logging in.')

  const userId = randomUUID()
  const now = Date.now()
  const passwordHash = await hashPassword(password)
  transaction(() => {
    run(
      'INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      userId,
      email.trim().toLowerCase(),
      passwordHash,
      'matchmaker',
      now,
    )
    run(
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

  // Let the approved team know there's an application to review.
  const team = all<{ email: string }>(
    `SELECT u.email FROM users u JOIN matchmakers m ON m.user_id = u.id WHERE m.approved_at IS NOT NULL`,
  )
  for (const member of team) {
    sendEmail(matchmakerApplicationEmail(member.email, name, `${APP_URL}/`)).catch((error) =>
      console.error('Could not send application email:', error),
    )
  }

  startSession(res, userId)
  res.status(201).json({ user: userById(userId) })
})

/* ---------- Password reset ---------- */

const RESET_TTL_MS = 60 * 60_000
/** Don't send another reset email to the same account within this window. */
const RESET_RESEND_MS = 2 * 60_000

authRoutes.post('/forgot', rateLimit, (req, res) => {
  const { email } = req.body ?? {}
  if (typeof email !== 'string' || !EMAIL.test(email.trim())) return fail(res, 400, 'Enter a valid email address.')
  const user = get<{ id: string; email: string }>('SELECT id, email FROM users WHERE email = ?', email.trim().toLowerCase())
  if (user) {
    const now = Date.now()
    run('DELETE FROM password_resets WHERE user_id = ? AND (used_at IS NOT NULL OR expires_at < ?)', user.id, now)
    const recent = get('SELECT 1 FROM password_resets WHERE user_id = ? AND expires_at > ?', user.id, now + RESET_TTL_MS - RESET_RESEND_MS)
    if (!recent) {
      // The token only ever exists in the email; the database keeps its hash.
      const token = randomBytes(32).toString('base64url')
      run('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)', sha256(token), user.id, now + RESET_TTL_MS)
      // In the URL fragment, so the token isn't sent to servers or leaked in Referer headers.
      sendEmail(passwordResetEmail(user.email, `${APP_URL}/#reset=${token}`)).catch((error) =>
        console.error('Could not send password reset email:', error),
      )
    }
  }
  // Same answer whether or not the account exists, so this can't be used to discover members.
  res.json({ ok: true })
})

authRoutes.post('/reset', rateLimit, async (req, res) => {
  const { token, password } = req.body ?? {}
  if (typeof token !== 'string' || !token) return fail(res, 400, 'This reset link is invalid.')
  if (typeof password !== 'string' || password.length < 8) return fail(res, 400, 'Password must be at least 8 characters.')
  const tokenHash = sha256(token)
  const reset = get<{ user_id: string; expires_at: number; used_at: number | null }>(
    'SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?',
    tokenHash,
  )
  const expired = 'This reset link has expired or has already been used. Please request a new one.'
  if (!reset || reset.used_at || reset.expires_at < Date.now()) return fail(res, 400, expired)

  const passwordHash = await hashPassword(password)
  const ok = transaction(() => {
    // Claim the token atomically so it can only ever be used once.
    const claimed = run('UPDATE password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL', Date.now(), tokenHash)
    if (Number(claimed.changes) !== 1) return false
    run('UPDATE users SET password_hash = ? WHERE id = ?', passwordHash, reset.user_id)
    // Invalidate any other outstanding links and sign out every existing session.
    run('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL', Date.now(), reset.user_id)
    run('DELETE FROM sessions WHERE user_id = ?', reset.user_id)
    return true
  })
  if (!ok) return fail(res, 400, expired)

  startSession(res, reset.user_id)
  const user = userById(reset.user_id)!
  sendEmail(passwordChangedEmail(user.email)).catch((error) => console.error('Could not send password changed email:', error))
  res.json({ user })
})
