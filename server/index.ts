import { existsSync } from 'node:fs'
import path from 'node:path'
import { app, errorHandler } from './app.ts'
import { dbLabel, get } from './db.ts'
import { isEmailConfigured } from './mailer.ts'
import { migrate } from './migrate.ts'

// Runs the API as a normal server: `npm run dev:api` locally, or `npm start` (which also serves the
// built web app). On Vercel the same app runs as a function instead (server/vercel.ts).

const PORT = Number(process.env.PORT ?? 3001)
const SERVE_DIST = process.argv.includes('--serve-dist')

// Keeps the schema up to date (on Vercel this happens once per deploy instead).
await migrate()

/* ---------- Production: serve the built web app ---------- */

if (SERVE_DIST) {
  const dist = path.resolve(import.meta.dirname, '..', 'dist')
  if (!existsSync(dist)) throw new Error('No dist/ folder. Run `npm run build` first.')
  const { default: express } = await import('express')
  app.use(express.static(dist))
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next()))
}

app.use(errorHandler)

const hasMembers = !!(await get('SELECT 1 FROM profiles LIMIT 1'))

const server = app.listen(PORT, () => {
  console.log(`MatchMeHub API listening on http://localhost:${PORT} (database: ${dbLabel})`)
  if (!isEmailConfigured()) {
    console.log('Email: SMTP not configured — emails are printed here and saved to server/data/outbox/.')
  }
  if (!hasMembers) {
    console.log('The database is empty — run `npm run seed` to add the sample members and a matchmaker account.')
  }
})

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${PORT} is already in use, so the MatchMeHub API couldn't start.\n` +
        'Another copy of the API is probably still running — close that terminal (or stop it with Ctrl+C) and run `npm run dev` again.\n',
    )
    process.exit(1)
  }
  throw error
})
