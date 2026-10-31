import path from 'node:path'

/** Database file and uploaded photos live here (git-ignored). Override with MATCHME_DATA_DIR. */
export const DATA_DIR = process.env.MATCHME_DATA_DIR ?? path.resolve(import.meta.dirname, 'data')
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
export const DB_FILE = path.join(DATA_DIR, 'matchme.db')
