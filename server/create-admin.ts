// Creates a super user (log in at /admin) on an existing database.
//
//   npm run create-admin
//   npm run create-admin -- --target production   (on the hosted database, from .env.production)
//
// Uses ADMIN_EMAIL / ADMIN_PASSWORD, otherwise admin@matchmehub.local with a generated password
// that is printed once. Once signed in, a super user can promote matchmakers to super users.

import './target-env.ts'

const { migrate } = await import('./migrate.ts')
await migrate()
const { createSuperUserFromEnv } = await import('./accounts.ts')
await createSuperUserFromEnv()
