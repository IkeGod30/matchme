// Creates or upgrades the database schema: `npm run migrate`. Runs on every Vercel deploy too.
// Uses TURSO_DATABASE_URL / TURSO_AUTH_TOKEN when set, otherwise the local file in server/data/.

import './target-env.ts'

const { dbLabel } = await import('./db.ts')
const { migrate } = await import('./migrate.ts')
await migrate()
console.log(`Database schema is up to date (${dbLabel}).`)
