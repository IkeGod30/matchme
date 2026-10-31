import { existsSync } from 'node:fs'
import path from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import { loadUser } from './auth.ts'
import { get } from './db.ts'
import { fail } from './http.ts'
import { isEmailConfigured } from './mailer.ts'
import { BadRequest } from './photos.ts'
import { authRoutes } from './routes/auth.ts'
import { matchmakerRoutes } from './routes/matchmaker.ts'
import { publicRoutes } from './routes/public.ts'
import { seekerRoutes } from './routes/seeker.ts'

// MatchMe API. Routes are grouped by who uses them:
//   /api/auth/*        sign-up, login, password reset, matchmaker invitations
//   /api/*             public pages and access-checked photos
//   /api/seeker/*      seekers (role: seeker)
//   /api/matchmaker/*  matchmakers (role: matchmaker)

const PORT = Number(process.env.PORT ?? 3001)
const SERVE_DIST = process.argv.includes('--serve-dist')

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '4mb' }))
app.use(loadUser)

app.use('/api/auth', authRoutes)
app.use('/api/seeker', seekerRoutes)
app.use('/api/matchmaker', matchmakerRoutes)
app.use('/api', publicRoutes)
app.use('/api', (_req, res) => fail(res, 404, 'Not found.'))

/* ---------- Production: serve the built web app ---------- */

if (SERVE_DIST) {
  const dist = path.resolve(import.meta.dirname, '..', 'dist')
  if (!existsSync(dist)) throw new Error('No dist/ folder. Run `npm run build` first.')
  app.use(express.static(dist))
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next()))
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof BadRequest) return fail(res, 400, error.message)
  if ((error as { type?: string }).type === 'entity.too.large') return fail(res, 413, 'That upload is too large.')
  console.error(error)
  fail(res, 500, 'Something went wrong on our side. Please try again.')
})

const server = app.listen(PORT, () => {
  console.log(`MatchMe API listening on http://localhost:${PORT}`)
  if (!isEmailConfigured()) {
    console.log('Email: SMTP not configured — emails are printed here and saved to server/data/outbox/.')
  }
  if (!get('SELECT 1 FROM profiles LIMIT 1')) {
    console.log('The database is empty — run `npm run seed` to add the sample members and a matchmaker account.')
  }
})

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${PORT} is already in use, so the MatchMe API couldn't start.\n` +
        'Another copy of the API is probably still running — close that terminal (or stop it with Ctrl+C) and run `npm run dev` again.\n',
    )
    process.exit(1)
  }
  throw error
})
