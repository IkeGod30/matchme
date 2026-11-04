import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { NextFunction, Request, Response } from 'express'
import { get, run } from './db.ts'

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>

/**
 * Each role is its own realm: seekers use the public site, matchmakers the backoffice at
 * /matchmaker, and super users (admin) the account administration at /admin. The realms have
 * separate log-ins and separate session cookies, so an account only ever works in its own realm.
 */
export type Role = 'seeker' | 'matchmaker' | 'admin'

export interface User {
  id: string
  email: string
  role: Role
  /** 'pending' = a matchmaker whose application hasn't been approved yet. */
  status: 'active' | 'pending'
}

/** The user columns plus approval status, for any query that joins users as `u`. */
export const USER_COLUMNS = `u.id, u.email, u.role,
  CASE WHEN u.role = 'matchmaker' AND (SELECT approved_at FROM matchmakers WHERE user_id = u.id) IS NULL
       THEN 'pending' ELSE 'active' END AS status`

export function userById(id: string): User | undefined {
  return get<User>(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = ?`, id)
}

const SESSION_COOKIES: Record<Role, string> = {
  seeker: 'mm_session',
  matchmaker: 'mm_staff_session',
  admin: 'mm_admin_session',
}
const ROLES = Object.keys(SESSION_COOKIES) as Role[]
const SESSION_DAYS = 30

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(actual, expected)
}

export async function createUser(email: string, password: string, role: Role): Promise<User> {
  const user: User = { id: randomUUID(), email: email.trim().toLowerCase(), role, status: 'active' }
  run(
    'INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
    user.id,
    user.email,
    await hashPassword(password),
    role,
    Date.now(),
  )
  return user
}

/**
 * Signs the user in to their own realm (the session cookie is chosen by their role). Only one
 * realm is signed in per browser: starting a session in one ends any session in the other.
 */
export function startSession(req: Request, res: Response, user: Pick<User, 'id' | 'role'>) {
  for (const other of ROLES) if (other !== user.role) endSession(req, res, other)
  const token = randomBytes(32).toString('base64url')
  const maxAge = SESSION_DAYS * 24 * 3600 * 1000
  run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', token, user.id, Date.now() + maxAge)
  res.cookie(SESSION_COOKIES[user.role], token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
    path: '/',
  })
}

/** Signs a user out everywhere, e.g. when their account is suspended. */
export function endAllSessions(userId: string) {
  run('DELETE FROM sessions WHERE user_id = ?', userId)
}

/** Signs out of one realm only; a session in the other realm is left alone. */
export function endSession(req: Request, res: Response, role: Role) {
  const token = readCookie(req, SESSION_COOKIES[role])
  if (token) run('DELETE FROM sessions WHERE token = ?', token)
  res.clearCookie(SESSION_COOKIES[role], { path: '/' })
}

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

/**
 * Attaches the signed-in user of each realm (if any) to res.locals.users. A session only
 * counts in the realm whose cookie carries it and only for a user of that role, so e.g. a
 * matchmaker's session in the seeker cookie (from before the realms were split) is dropped.
 */
export function loadUser(req: Request, res: Response, next: NextFunction) {
  const users: Partial<Record<Role, User>> = {}
  for (const role of ROLES) {
    const token = readCookie(req, SESSION_COOKIES[role])
    if (!token) continue
    const user = get<User & { expires_at: number; suspended_at: number | null }>(
      `SELECT ${USER_COLUMNS}, s.expires_at, u.suspended_at FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
      token,
    )
    // A suspended account's sessions stop working at once.
    if (user && user.expires_at > Date.now() && user.role === role && user.suspended_at === null) {
      users[role] = { id: user.id, email: user.email, role: user.role, status: user.status }
    } else if (user) {
      run('DELETE FROM sessions WHERE token = ?', token)
    }
  }
  res.locals.users = users
  next()
}

/** The signed-in user of one realm. */
export function currentUser(res: Response, role: Role): User | undefined {
  return (res.locals.users as Partial<Record<Role, User>> | undefined)?.[role]
}

/** Every signed-in user on this request (at most one per realm). */
export function signedInUsers(res: Response): User[] {
  return Object.values((res.locals.users ?? {}) as Partial<Record<Role, User>>)
}

export function requireRole(role: Role) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = currentUser(res, role)
    if (!user) return res.status(401).json({ error: 'Please log in.' })
    // Matchmakers who applied publicly see nothing until a teammate approves them.
    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Your matchmaker application is still being reviewed.', pending: true })
    }
    next()
  }
}

// Simple in-memory limiter for login/sign-up: blocks an IP after too many *failed* attempts.
const FAILURE_LIMIT = 20
const WINDOW_MS = 15 * 60_000
const failures = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip ?? 'unknown'
  const now = Date.now()
  const entry = failures.get(key)
  if (entry && entry.resetAt > now && entry.count >= FAILURE_LIMIT) {
    return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' })
  }
  res.on('finish', () => {
    if (res.statusCode < 400) return
    const current = failures.get(key)
    if (!current || current.resetAt < Date.now()) failures.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS })
    else current.count++
  })
  next()
}
