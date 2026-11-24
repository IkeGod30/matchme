// Makes a safe, complete copy of the local data before (and at) the move to Vercel + Turso:
//
//   npm run backup-local
//
// 1. Checks that no MatchMeHub server is using the database (stop `npm run dev` first).
// 2. Folds SQLite's write-ahead log (matchmehub.db-wal) into matchmehub.db. Recent changes can
//    live only in that log; copying the .db file alone would lose them.
// 3. Copies server/data/ to server/data-backup-<date-time>/.
// 4. Fingerprints the backup (rows + photos) into migration/baseline-<date-time>.json, which the
//    hosted copy is later checked against with `npm run verify-migration`.

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { DATA_DIR, localDbFile } from '../server/db-paths.ts'

const root = path.resolve(import.meta.dirname, '..')
const file = localDbFile()
if (!existsSync(file)) {
  console.error(`No database at ${file}.`)
  process.exit(1)
}

// A running dev server would keep writing after the copy is made.
const port = process.env.PORT ?? '3001'
const running = await fetch(`http://localhost:${port}/api/auth/me`, { signal: AbortSignal.timeout(1500) })
  .then(() => true)
  .catch(() => false)
if (running) {
  console.error(`The MatchMeHub API is still running on port ${port}. Stop it (Ctrl+C in its terminal), then run this again.`)
  process.exit(1)
}

const db = new DatabaseSync(file)
const result = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get() as { busy: number; log: number; checkpointed: number }
const integrity = (db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check
db.close()
const walSize = existsSync(`${file}-wal`) ? statSync(`${file}-wal`).size : 0
if (result.busy !== 0 || walSize !== 0) {
  console.error('The database is still in use by another program, so its latest changes could not be saved into the file.')
  console.error('Close anything using it (dev server, DB browser), then run this again.')
  process.exit(1)
}
if (integrity !== 'ok') {
  console.error(`The database failed SQLite's integrity check: ${integrity}`)
  process.exit(1)
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-')
const backup = path.join(root, 'server', `data-backup-${stamp}`)
cpSync(DATA_DIR, backup, { recursive: true })
console.log(`Backed up ${DATA_DIR}\n       to ${backup}`)

const baseline = path.join(root, 'migration', `baseline-${stamp}.json`)
mkdirSync(path.dirname(baseline), { recursive: true })
const manifest = spawnSync(
  process.execPath,
  ['--disable-warning=ExperimentalWarning', path.join(root, 'scripts', 'manifest.ts'), '--out', baseline],
  { env: { ...process.env, MATCHMEHUB_DATA_DIR: backup, TURSO_DATABASE_URL: '', BLOB_STORE_ID: '', BLOB_READ_WRITE_TOKEN: '', VERCEL_OIDC_TOKEN: '' }, stdio: 'inherit' },
)
if (manifest.status !== 0) process.exit(manifest.status ?? 1)

console.log('\nNext steps use these paths:')
console.log(`  database: ${path.relative(root, path.join(backup, path.basename(file)))}`)
console.log(`  photos:   ${path.relative(root, path.join(backup, 'uploads'))}`)
console.log(`  baseline: ${path.relative(root, baseline)}`)
console.log('Also copy the backup folder somewhere outside this project (e.g. OneDrive or a USB drive).')
