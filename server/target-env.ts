import { existsSync } from 'node:fs'
import path from 'node:path'

// Lets the data scripts work on a hosted database: `--target staging` loads .env.staging and
// `--target production` loads .env.production (both git-ignored; see .env.example). Without
// --target they use the local database file and photos, exactly like `npm run dev`. Must be
// imported before db.ts, which reads the variables when it loads.

const flag = process.argv.indexOf('--target')
export const TARGET = flag >= 0 ? (process.argv[flag + 1] ?? '') : 'local'

if (TARGET !== 'local') {
  if (!/^[a-z0-9-]+$/.test(TARGET)) {
    console.error('Use --target staging or --target production.')
    process.exit(1)
  }
  const file = path.resolve(import.meta.dirname, '..', `.env.${TARGET}`)
  if (!existsSync(file)) {
    console.error(`--target ${TARGET} needs a ${path.basename(file)} file in the project folder (copy .env.example).`)
    process.exit(1)
  }
  process.loadEnvFile(file)
  if (!process.env.TURSO_DATABASE_URL) {
    console.error(`${path.basename(file)} has no TURSO_DATABASE_URL.`)
    process.exit(1)
  }
}
