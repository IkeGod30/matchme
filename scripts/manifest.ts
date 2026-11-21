// Fingerprints a database and its photos, to prove a copy is complete:
//
//   npm run manifest -- --out migration/baseline.json                  the local database + uploads
//   npm run manifest -- --target staging --out migration/staging.json   a hosted database + Blob store
//
// For every table: the row count and a SHA-256 of all its rows (sorted, so the order rows are
// stored in doesn't matter). For every photo the database refers to: its size and SHA-256, read
// from the uploads folder or the Blob store. Plus SQLite's integrity and foreign-key checks.
// Compare two manifests with `npm run verify-migration`. The file holds no personal data.

import '../server/target-env.ts'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

const { values: args } = parseArgs({
  options: { target: { type: 'string' }, out: { type: 'string' }, 'uploads-dir': { type: 'string' } },
})

const { all, dbLabel } = await import('../server/db.ts')
const { UPLOAD_DIR } = await import('../server/db-paths.ts')
const { usesBlobStorage, blobPathname } = await import('../server/photos.ts')
const { get: getBlob, list } = await import('@vercel/blob')

const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')
const uploadsDir = args['uploads-dir'] ?? UPLOAD_DIR

export interface Manifest {
  createdAt: string
  database: string
  photoStore: string
  tables: Record<string, { rows: number; sha256: string }>
  photos: Record<string, { bytes: number; sha256: string } | 'missing'>
  unreferencedPhotos: number
  integrityCheck: string
  foreignKeyViolations: number
}

/* ---------- Tables ---------- */

const tableNames = (
  await all<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
).map((t) => t.name)

const tables: Manifest['tables'] = {}
for (const name of tableNames) {
  const columns = (await all<{ name: string }>(`PRAGMA table_info("${name}")`)).map((c) => c.name).sort()
  const select = columns.map((c) => `"${c}"`).join(', ')
  const rows = await all<Record<string, unknown>>(`SELECT ${select} FROM "${name}" ORDER BY ${columns.map((_, i) => i + 1).join(', ')}`)
  const hash = createHash('sha256')
  for (const row of rows) hash.update(JSON.stringify(columns.map((c) => row[c])) + '\n')
  tables[name] = { rows: rows.length, sha256: hash.digest('hex') }
}

/* ---------- Photos ---------- */

const referenced = (
  await all<{ file: string }>(
    `SELECT photo_file AS file FROM profiles WHERE photo_file IS NOT NULL
     UNION SELECT file FROM profile_photos
     UNION SELECT photo_file FROM matchmakers WHERE photo_file IS NOT NULL
     UNION SELECT photo_file FROM examples`,
  )
)
  .map((r) => r.file)
  .sort()

async function photoBytes(file: string): Promise<Buffer | undefined> {
  if (!usesBlobStorage) {
    const local = path.join(uploadsDir, path.basename(file))
    return existsSync(local) ? readFileSync(local) : undefined
  }
  const result = await getBlob(blobPathname(file), { access: 'private', useCache: false }).catch(() => null)
  if (!result || result.statusCode !== 200) return undefined
  return Buffer.from(await new Response(result.stream).arrayBuffer())
}

const photos: Manifest['photos'] = {}
for (const file of referenced) {
  const bytes = await photoBytes(file)
  photos[file] = bytes ? { bytes: bytes.length, sha256: sha(bytes) } : 'missing'
}

async function storedFiles(): Promise<string[]> {
  if (!usesBlobStorage) return existsSync(uploadsDir) ? readdirSync(uploadsDir) : []
  const names: string[] = []
  let cursor: string | undefined
  do {
    const page = await list({ prefix: 'photos/', cursor })
    names.push(...page.blobs.map((b) => path.posix.basename(b.pathname)))
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  return names
}
const stored = await storedFiles()
const referencedSet = new Set(referenced)

/* ---------- Checks ---------- */

let integrityCheck = 'not available on this database'
try {
  integrityCheck = (await all<{ integrity_check: string }>('PRAGMA integrity_check')).map((r) => r.integrity_check).join('; ')
} catch {
  // Turso may not allow this pragma; the row hashes still prove the data is identical.
}
const foreignKeyViolations = (await all('PRAGMA foreign_key_check')).length

const manifest: Manifest = {
  createdAt: new Date().toISOString(),
  database: dbLabel,
  photoStore: usesBlobStorage ? 'Vercel Blob' : uploadsDir,
  tables,
  photos,
  unreferencedPhotos: stored.filter((f) => !referencedSet.has(f)).length,
  integrityCheck,
  foreignKeyViolations,
}

const out = args.out ?? path.join('migration', `manifest-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
writeFileSync(out, JSON.stringify(manifest, null, 2))

const missing = Object.values(photos).filter((p) => p === 'missing').length
console.log(`Manifest of ${dbLabel} → ${out}`)
console.log(`  ${tableNames.length} tables, ${Object.values(tables).reduce((n, t) => n + t.rows, 0)} rows`)
console.log(`  ${referenced.length} photos referenced (${missing} missing), ${manifest.unreferencedPhotos} stored but unused`)
console.log(`  integrity: ${integrityCheck}; foreign key violations: ${foreignKeyViolations}`)
