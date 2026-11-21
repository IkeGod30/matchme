import { existsSync, renameSync } from 'node:fs'
import path from 'node:path'

/**
 * Local development keeps the database file and uploaded photos here (git-ignored). Override with
 * MATCHMEHUB_DATA_DIR (MATCHME_DATA_DIR, from before the rename to MatchMeHub, still works).
 * In production (TURSO_DATABASE_URL / BLOB_READ_WRITE_TOKEN set) neither is used.
 */
export const DATA_DIR =
  process.env.MATCHMEHUB_DATA_DIR ?? process.env.MATCHME_DATA_DIR ?? path.resolve(import.meta.dirname, 'data')
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')

let dbFile: string | undefined

/**
 * The local database file. One created before the rename is called matchme.db: it's renamed to
 * matchmehub.db (with SQLite's side files) so existing members and accounts carry over. If it
 * can't be renamed right now — e.g. another server still has it open — it's used as it is.
 * Worked out on first use only, so nothing touches the disk when a hosted database is used.
 */
export function localDbFile(): string {
  dbFile ??= resolveDbFile(path.join(DATA_DIR, 'matchmehub.db'), path.join(DATA_DIR, 'matchme.db'))
  return dbFile
}

function resolveDbFile(file: string, oldFile: string): string {
  if (existsSync(file) || !existsSync(oldFile)) return file
  try {
    // The main file first: while the database is open it can't be moved, and then nothing is.
    renameSync(oldFile, file)
  } catch {
    return oldFile
  }
  for (const suffix of ['-wal', '-shm']) {
    if (existsSync(oldFile + suffix)) renameSync(oldFile + suffix, file + suffix)
  }
  return file
}
