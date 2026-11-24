import { randomUUID } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { del, get as getBlob, put } from '@vercel/blob'
import type { Request, Response } from 'express'
import { UPLOAD_DIR } from './db-paths.ts'
import { get } from './db.ts'

// Photos are stored in Vercel Blob (a private store) when a store is configured — BLOB_STORE_ID,
// which Vercel adds when the store is connected (it signs in with the deployment's OIDC token), or
// a BLOB_READ_WRITE_TOKEN — otherwise in server/data/uploads/ for local development. Either way the database keeps only the file
// name, and photos are only ever served through the access-checked /api routes.

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/
const MAX_BYTES = 2 * 1024 * 1024

export class BadRequest extends Error {}

export const usesBlobStorage = !!(process.env.BLOB_STORE_ID?.trim() || process.env.BLOB_READ_WRITE_TOKEN?.trim())
if (!usesBlobStorage && process.env.VERCEL) {
  throw new Error('No Blob store configured (BLOB_STORE_ID). Connect a private Blob store to this Vercel environment.')
}

/** Where a photo lives in the Blob store. The database value (file name) stays the same. */
export const blobPathname = (file: string) => `photos/${path.basename(file)}`
const localPath = (file: string) => path.join(UPLOAD_DIR, path.basename(file))

const CONTENT_TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
export const contentTypeOf = (file: string) => CONTENT_TYPES[path.extname(file).slice(1).toLowerCase()] ?? 'application/octet-stream'

/** Stores a photo's bytes under the given file name (used by uploads, the seed and the photo import). */
export async function storePhoto(file: string, bytes: Buffer): Promise<void> {
  if (usesBlobStorage) {
    await put(blobPathname(file), bytes, {
      access: 'private',
      contentType: contentTypeOf(file),
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    return
  }
  mkdirSync(UPLOAD_DIR, { recursive: true })
  writeFileSync(localPath(file), bytes)
}

/** Saves a base64 image data URL and returns its new file name. */
export async function savePhoto(dataUrl: string): Promise<string> {
  const match = DATA_URL.exec(dataUrl)
  if (!match) throw new BadRequest('Photos must be JPEG, PNG or WebP images.')
  const bytes = Buffer.from(match[2], 'base64')
  if (bytes.length > MAX_BYTES) throw new BadRequest('That photo is too large (2 MB maximum).')
  const file = `${randomUUID()}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`
  await storePhoto(file, bytes)
  return file
}

/** Removes a stored photo. Call only once no row refers to it (see deleteUnusedPhotos). */
async function removePhoto(file: string) {
  if (usesBlobStorage) await del(blobPathname(file))
  else rmSync(localPath(file), { force: true })
}

/** True if any row still refers to this photo file. */
export async function photoInUse(file: string): Promise<boolean> {
  return !!(await get(
    `SELECT 1 FROM profiles WHERE photo_file = ?1
     UNION ALL SELECT 1 FROM profile_photos WHERE file = ?1
     UNION ALL SELECT 1 FROM matchmakers WHERE photo_file = ?1
     UNION ALL SELECT 1 FROM examples WHERE photo_file = ?1
     LIMIT 1`,
    file,
  ))
}

/**
 * Deletes the photo files no row refers to any more. Called after the database change that let
 * go of them has been committed, so a row never points at a missing photo — even when two saves
 * overlap. A failure only leaves an unused file behind; it never fails the request.
 */
export async function deleteUnusedPhotos(files: Iterable<string | null | undefined>): Promise<void> {
  for (const file of new Set(files)) {
    if (!file) continue
    try {
      if (!(await photoInUse(file))) await removePhoto(file)
    } catch (error) {
      console.error(`Could not delete unused photo ${file}:`, error)
    }
  }
}

/**
 * Sends a photo the caller has already checked the viewer may see. Answers 304 when the browser's
 * copy is current (ETag), like res.sendFile does for local files, and 404 if the file is missing.
 */
export async function sendPhoto(req: Request, res: Response, file: string): Promise<void> {
  if (!usesBlobStorage) {
    await new Promise<void>((resolve) => {
      res.sendFile(localPath(file), (error) => {
        if (error && !res.headersSent) res.status(404).json({ error: 'Not found.' })
        resolve()
      })
    })
    return
  }
  const ifNoneMatch = req.headers['if-none-match']
  const result = await getBlob(blobPathname(file), { access: 'private', ...(ifNoneMatch && { ifNoneMatch }) }).catch(
    (error: unknown) => {
      if ((error as Error)?.name === 'BlobNotFoundError') return null
      throw error
    },
  )
  if (!result) {
    res.status(404).json({ error: 'Not found.' })
    return
  }
  res.set('ETag', result.blob.etag)
  res.set('Last-Modified', result.blob.uploadedAt.toUTCString())
  if (result.statusCode === 304) {
    res.status(304).end()
    return
  }
  res.set('Content-Type', result.blob.contentType || contentTypeOf(file))
  res.set('Content-Length', String(result.blob.size))
  await pipeline(Readable.fromWeb(result.stream as import('node:stream/web').ReadableStream), res)
}
