import { app, errorHandler } from './app.ts'

// The Vercel function: every /api request is handled by the Express app. Bundled into
// .vercel/output by scripts/build-vercel.ts. The schema is migrated during the build, not here.

app.use(errorHandler)

export default app
