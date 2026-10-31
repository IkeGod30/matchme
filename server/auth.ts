import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { NextFunction, Request, Response } from 'express'
import { get, run } from './db.ts'

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>

export type Role = 'seeker' | 'matchmaker'

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

const SESSION_COOKIE = 'mm_session'
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

export function startSession(res: Response, userId: string) {
  const token = randomBytes(32).toString('base64url')
  const maxAge = SESSION_DAYS * 24 * 3600 * 1000
  run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', token, userId, Date.now() + maxAge)
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
    path: '/',
  })
}

export function endSession(req: Request, res: Response) {
  const token = readCookie(req, SESSION_COOKIE)
  if (token) run('DELETE FROM sessions WHERE token = ?', token)
  res.clearCookie(SESSION_COOKIE, { path: '/' })
}

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

/** Attaches the signed-in user (if any) to res.locals.user. */
export function loadUser(req: Request, res: Response, next: NextFunction) {
  const token = readCookie(req, SESSION_COOKIE)
  if (token) {
    const user = get<User & { expires_at: number }>(
      `SELECT ${USER_COLUMNS}, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
      token,
    )
    if (user && user.expires_at > Date.now()) {
      res.locals.user = { id: user.id, email: user.email, role: user.role, status: user.status } satisfies User
    } else if (user) {
      run('DELETE FROM sessions WHERE token = ?', token)
    }
  }
  next()
}

export function currentUser(res: Response): User | undefined {
  return res.locals.user as User | undefined
}

export function requireRole(role: Role) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = currentUser(res)
    if (!user) return res.status(401).json({ error: 'Please log in.' })
    if (user.role !== role) return res.status(403).json({ error: 'You don’t have access to this.' })
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
