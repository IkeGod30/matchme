// Uploads the local photos to the Vercel Blob store, keeping their file names:
//
//   npm run import-photos -- --target staging --from server/data-backup-20261120/uploads
//
// Safe to run again: a photo already in the store with the same size is skipped. The reverse,
// for a rollback (downloads every photo from the store into a folder):
//
//   npm run import-photos -- --target production --download --to restored-uploads

import '../server/target-env.ts'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { get as getBlob, head, list } from '@vercel/blob'

const { values: args } = parseArgs({
  options: { target: { type: 'string' }, from: { type: 'string' }, download: { type: 'boolean' }, to: { type: 'string' } },
})

const { storePhoto, usesBlobStorage, blobPathname } = await import('../server/photos.ts')
const { UPLOAD_DIR } = await import('../server/db-paths.ts')

if (!usesBlobStorage) {
  console.error('BLOB_READ_WRITE_TOKEN is not set: add --target staging (or production) with the token in that .env file.')
  process.exit(1)
}

if (args.download) {
  const to = path.resolve(args.to ?? 'restored-uploads')
  mkdirSync(to, { recursive: true })
  let n = 0
  let cursor: string | undefined
  do {
    const page = await list({ prefix: 'photos/', cursor })
    for (const blob of page.blobs) {
      const result = await getBlob(blob.pathname, { access: 'private', useCache: false })
      if (!result || result.statusCode !== 200) throw new Error(`Could not download ${blob.pathname}`)
      writeFileSync(path.join(to, path.posix.basename(blob.pathname)), Buffer.from(await new Response(result.stream).arrayBuffer()))
      n++
    }
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  console.log(`Downloaded ${n} photos to ${to}`)
  process.exit(0)
}

const from = path.resolve(args.from ?? UPLOAD_DIR)
if (!existsSync(from)) {
  console.error(`${from} doesn't exist.`)
  process.exit(1)
}

let uploaded = 0
let skipped = 0
const files = readdirSync(from).filter((f) => statSync(path.join(from, f)).isFile())
for (const file of files) {
  const bytes = readFileSync(path.join(from, file))
  const existing = await head(blobPathname(file)).catch(() => null)
  if (existing && existing.size === bytes.length) {
    skipped++
    continue
  }
  await storePhoto(file, bytes)
  uploaded++
  process.stdout.write(`\r  uploaded ${uploaded} …`)
}
console.log(`\nPhotos: ${uploaded} uploaded, ${skipped} already there (${files.length} in ${from}).`)
console.log('Now prove it: npm run manifest (on the target) and npm run verify-migration.')
