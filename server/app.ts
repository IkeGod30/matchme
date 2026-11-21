import express, { type NextFunction, type Request, type Response } from 'express'
import { cleanUpExpired, loadUser } from './auth.ts'
import { fail } from './http.ts'
import { BadRequest } from './photos.ts'
import { adminRoutes } from './routes/admin.ts'
import { authRoutes } from './routes/auth.ts'
import { matchmakerRoutes } from './routes/matchmaker.ts'
import { publicRoutes } from './routes/public.ts'
import { seekerRoutes } from './routes/seeker.ts'

// MatchMeHub API. Routes are grouped by who uses them:
//   /api/auth/*        sign-up, login, password reset, matchmaker invitations
//   /api/*             public pages and access-checked photos
//   /api/seeker/*      seekers (role: seeker)
//   /api/matchmaker/*  matchmakers (role: matchmaker)
//   /api/admin/*       super users (role: admin): every account, matchmaker applications
//   /api/internal/*    the daily clean-up job (Vercel Cron)
//
// The same app runs locally (server/index.ts) and as the Vercel function (server/vercel.ts).

export const app = express()
app.disable('x-powered-by')
// On Vercel, requests arrive through its proxy: the visitor's address is in X-Forwarded-For,
// which the rate limiter needs. (Locally there is no proxy, so the header isn't trusted.)
if (process.env.VERCEL) app.set('trust proxy', 1)
app.use(express.json({ limit: '4mb' }))

/** Daily clean-up of expired sessions and reset links. Vercel Cron sends the CRON_SECRET. */
app.get('/api/internal/cleanup', async (req, res) => {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return fail(res, 401, 'Unauthorized.')
  res.json({ removed: await cleanUpExpired() })
})

app.use(loadUser)

app.use('/api/auth', authRoutes)
app.use('/api/seeker', seekerRoutes)
app.use('/api/matchmaker', matchmakerRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api', publicRoutes)
app.use('/api', (_req, res) => fail(res, 404, 'Not found.'))

/** Errors from the routes. Kept separate so index.ts can add the static web app before it. */
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return
  if (error instanceof BadRequest) return fail(res, 400, error.message)
  if ((error as { type?: string }).type === 'entity.too.large') return fail(res, 413, 'That upload is too large.')
  // Two requests raced to create the same thing (e.g. a double-clicked sign-up).
  const message = String((error as Error)?.message ?? '')
  if (/UNIQUE constraint failed: users\.email/i.test(message)) {
    return fail(res, 409, 'An account with that email already exists.')
  }
  if (/UNIQUE constraint failed/i.test(message)) return fail(res, 409, 'That was just saved. Please reload the page and try again.')
  console.error(error)
  fail(res, 500, 'Something went wrong on our side. Please try again.')
}
