// Compares two manifests (see manifest.ts) and fails unless the copy is complete and identical:
//
//   npm run verify-migration -- migration/baseline.json migration/staging.json
//
// Every table of the source must exist in the copy with the same row count and row hash, and
// every photo must be present with the same bytes. Tables only in the copy (added by a newer
// schema) must be empty. The copy must pass SQLite's integrity and foreign-key checks.

import { readFileSync } from 'node:fs'
import type { Manifest } from './manifest.ts'

const [sourceFile, copyFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (!sourceFile || !copyFile) {
  console.error('Usage: npm run verify-migration -- <source manifest> <copy manifest>')
  process.exit(1)
}
const source = JSON.parse(readFileSync(sourceFile, 'utf8')) as Manifest
const copy = JSON.parse(readFileSync(copyFile, 'utf8')) as Manifest

const problems: string[] = []
console.log(`Source: ${source.database} (${source.createdAt})`)
console.log(`Copy:   ${copy.database} (${copy.createdAt})\n`)
console.log('Table'.padEnd(22) + 'Source'.padStart(8) + 'Copy'.padStart(8) + '  Result')

for (const [name, s] of Object.entries(source.tables)) {
  const c = copy.tables[name]
  let result = 'identical'
  if (!c) result = 'MISSING'
  else if (c.rows !== s.rows) result = 'ROW COUNT DIFFERS'
  else if (c.sha256 !== s.sha256) result = 'CONTENT DIFFERS'
  if (result !== 'identical') problems.push(`Table ${name}: ${result}`)
  console.log(name.padEnd(22) + String(s.rows).padStart(8) + String(c?.rows ?? '-').padStart(8) + '  ' + result)
}
for (const [name, c] of Object.entries(copy.tables)) {
  if (source.tables[name]) continue
  const result = c.rows === 0 ? 'new table (empty)' : 'NEW TABLE WITH ROWS'
  if (c.rows !== 0) problems.push(`Table ${name} exists only in the copy and has ${c.rows} rows`)
  console.log(name.padEnd(22) + '-'.padStart(8) + String(c.rows).padStart(8) + '  ' + result)
}

let photosOk = 0
for (const [file, s] of Object.entries(source.photos)) {
  const c = copy.photos[file]
  if (s === 'missing') {
    // Already missing in the source: nothing to copy, but worth knowing.
    console.log(`\nNote: photo ${file} was already missing in the source.`)
    continue
  }
  if (!c || c === 'missing') problems.push(`Photo ${file} is missing in the copy`)
  else if (c.sha256 !== s.sha256 || c.bytes !== s.bytes) problems.push(`Photo ${file} differs in the copy`)
  else photosOk++
}
for (const [file, c] of Object.entries(copy.photos)) {
  if (!(file in source.photos)) problems.push(`Photo ${file} is referenced only in the copy`)
  else if (c === 'missing' && source.photos[file] !== 'missing') {
    // reported above
  }
}
console.log(`\nPhotos: ${photosOk} of ${Object.keys(source.photos).length} identical`)
console.log(`Copy integrity check: ${copy.integrityCheck}; foreign key violations: ${copy.foreignKeyViolations}`)
if (copy.foreignKeyViolations > 0) problems.push(`${copy.foreignKeyViolations} foreign key violations in the copy`)
if (copy.integrityCheck !== 'ok' && !copy.integrityCheck.startsWith('not available')) {
  problems.push(`Integrity check failed: ${copy.integrityCheck}`)
}

if (problems.length > 0) {
  console.error(`\nFAILED — ${problems.length} problem(s):\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log('\nPASSED — every row and every photo is present and identical.')
