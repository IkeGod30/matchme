// Creates a super user (log in at /admin) on an existing database.
//
//   npm run create-admin
//
// Uses ADMIN_EMAIL / ADMIN_PASSWORD, otherwise admin@matchme.local with a generated password
// that is printed once. Once signed in, a super user can promote matchmakers to super users.

const { createSuperUserFromEnv } = await import('./accounts.ts')
await createSuperUserFromEnv()
