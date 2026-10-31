import { randomUUID } from 'node:crypto'
import { rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { UPLOAD_DIR } from './db.ts'

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/
const MAX_BYTES = 2 * 1024 * 1024

export class BadRequest extends Error {}

/** Saves a base64 image data URL to the uploads folder and returns its file name. */
export function savePhoto(dataUrl: string): string {
  const match = DATA_URL.exec(dataUrl)
  if (!match) throw new BadRequest('Photos must be JPEG, PNG or WebP images.')
  const bytes = Buffer.from(match[2], 'base64')
  if (bytes.length > MAX_BYTES) throw new BadRequest('That photo is too large (2 MB maximum).')
  const file = `${randomUUID()}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`
  writeFileSync(path.join(UPLOAD_DIR, file), bytes)
  return file
}

export function deletePhoto(file: string | null | undefined) {
  if (file) rmSync(path.join(UPLOAD_DIR, path.basename(file)), { force: true })
}

export function photoPath(file: string): string {
  return path.join(UPLOAD_DIR, path.basename(file))
}
