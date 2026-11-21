// Copies every row of a local database file into an empty hosted (Turso) database:
//
//   npm run copy-db -- --target staging --from server/data-backup-20261120/matchmehub.db
//
// The target's schema is created first (migrate), then all rows are inserted in ONE atomic
// batch: either everything is copied or nothing is. The target must be empty, so an existing
// database is never overwritten. Afterwards, prove the copy with manifest + verify-migration.

import '../server/target-env.ts'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { createClient, type InStatement } from '@libsql/client'

const { values: args } = parseArgs({ options: { target: { type: 'string' }, from: { type: 'string' } } })

const { client, all, dbLabel, isRemoteDb } = await import('../server/db.ts')
const { migrate } = await import('../server/migrate.ts')

// (COPY_DB_ALLOW_FILE_TARGET lets the automated tests copy into a local file instead.)
if (!isRemoteDb && process.env.COPY_DB_ALLOW_FILE_TARGET !== '1') {
  console.error('copy-db copies INTO a hosted database: add --target staging (or production).')
  process.exit(1)
}
if (!args.from) {
  console.error('Add --from <path to the local matchmehub.db>, ideally your checkpointed backup copy.')
  process.exit(1)
}
const fromFile = path.resolve(args.from)
if (!existsSync(fromFile)) {
  console.error(`${fromFile} doesn't exist.`)
  process.exit(1)
}
if (existsSync(`${fromFile}-wal`) && statSync(`${fromFile}-wal`).size > 0) {
  console.error(
    `${path.basename(fromFile)}-wal is not empty: recent changes are still in the WAL file. Checkpoint the database first ` +
      '(see the deployment guide), or copy from the checkpointed backup.',
  )
  process.exit(1)
}

const source = createClient({ url: `file:${fromFile.replace(/\\/g, '/')}` })
const sourceAll = async <T>(sql: string) => {
  const r = await source.execute(sql)
  return r.rows.map((row) => Object.fromEntries(r.columns.map((c, i) => [c, row[i]]))) as T[]
}

// Parents before children, so foreign keys hold at every step.
const ORDER = [
  'users',
  'sessions',
  'password_resets',
  'profiles',
  'profile_photos',
  'requests',
  'proposals',
  'requested_members',
  'examples',
  'matchmakers',
  'request_notes',
  'invites',
  'login_failures',
]

const sourceTables = (
  await sourceAll<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
).map((t) => t.name)
const unknown = sourceTables.filter((t) => !ORDER.includes(t))
if (unknown.length > 0) {
  console.error(`The source has tables this script doesn't know: ${unknown.join(', ')}. Add them to ORDER in scripts/copy-db.ts.`)
  process.exit(1)
}

console.log(`Creating the schema on ${dbLabel} …`)
await migrate()

for (const table of ORDER) {
  const n = (await all<{ n: number }>(`SELECT COUNT(*) AS n FROM "${table}"`))[0].n
  if (n > 0) {
    console.error(`The target is not empty (${table} has ${n} rows). copy-db only copies into an empty database.`)
    process.exit(1)
  }
}

const statements: InStatement[] = []
const promotedFrom: { id: string; promoted_from: string }[] = []
const counts: Record<string, number> = {}

for (const table of ORDER.filter((t) => sourceTables.includes(t))) {
  const targetColumns = new Set((await all<{ name: string }>(`PRAGMA table_info("${table}")`)).map((c) => c.name))
  const rows = await sourceAll<Record<string, string | number | null>>(`SELECT * FROM "${table}"`)
  counts[table] = rows.length
  for (const row of rows) {
    const columns = Object.keys(row)
    const extra = columns.filter((c) => !targetColumns.has(c))
    if (extra.length > 0) throw new Error(`${table} has columns the target lacks: ${extra.join(', ')}`)
    const values = { ...row }
    // A super user points at the matchmaker account it was promoted from; set after all users exist.
    if (table === 'users' && values.promoted_from) {
      promotedFrom.push({ id: String(values.id), promoted_from: String(values.promoted_from) })
      values.promoted_from = null
    }
    statements.push({
      sql: `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      args: columns.map((c) => values[c]),
    })
  }
}
for (const p of promotedFrom) {
  statements.push({ sql: 'UPDATE users SET promoted_from = ? WHERE id = ?', args: [p.promoted_from, p.id] })
}

console.log(`Copying ${statements.length} rows in one transaction …`)
await client.batch(statements, 'write')
source.close()

for (const [table, n] of Object.entries(counts)) console.log(`  ${table.padEnd(20)} ${n}`)
console.log('\nDone. Now prove it: npm run manifest (on the target) and npm run verify-migration.')
