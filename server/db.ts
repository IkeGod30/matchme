import { mkdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { DB_FILE, UPLOAD_DIR } from './db-paths.ts'

export { DATA_DIR, DB_FILE, UPLOAD_DIR } from './db-paths.ts'

mkdirSync(UPLOAD_DIR, { recursive: true })

export const db = new DatabaseSync(DB_FILE)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('seeker', 'matchmaker')),
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  -- One-time password reset links. Only a SHA-256 hash of the token is stored.
  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used_at    INTEGER
  );

  -- Member profiles. Sample (demo) members have no user account.
  CREATE TABLE IF NOT EXISTS profiles (
    id             TEXT PRIMARY KEY,
    user_id        TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    data           TEXT NOT NULL,
    photo_file     TEXT,
    is_demo        INTEGER NOT NULL DEFAULT 0,
    public_listing INTEGER NOT NULL DEFAULT 0,
    updated_at     INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS requests (
    id                TEXT PRIMARY KEY,
    seeker_id         TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at        INTEGER NOT NULL,
    closed_at         INTEGER,
    more_requested_at INTEGER,
    notes             TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS proposals (
    id                     TEXT PRIMARY KEY,
    request_id             TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    candidate_id           TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    note                   TEXT NOT NULL DEFAULT '',
    proposed_at            INTEGER NOT NULL,
    response               TEXT NOT NULL DEFAULT 'pending',
    responded_at           INTEGER,
    comment                TEXT,
    candidate_response     TEXT,
    candidate_responded_at INTEGER,
    candidate_comment      TEXT,
    paid_at                INTEGER,
    payment_ref            TEXT
  );

  -- Featured members a seeker asked to be matched with, by name, from the Featured page.
  CREATE TABLE IF NOT EXISTS requested_members (
    request_id   TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    candidate_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at   INTEGER NOT NULL,
    PRIMARY KEY (request_id, candidate_id)
  );

  CREATE TABLE IF NOT EXISTS examples (
    key        TEXT PRIMARY KEY,
    photo_file TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Matchmakers' public-facing profile (shown to the seekers they look after).
  CREATE TABLE IF NOT EXISTS matchmakers (
    user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    bio          TEXT NOT NULL DEFAULT '',
    specialties  TEXT NOT NULL DEFAULT '[]',
    languages    TEXT NOT NULL DEFAULT '[]',
    photo_file   TEXT,
    updated_at   INTEGER NOT NULL
  );

  -- Private notes matchmakers keep on a request. Never sent to seekers.
  CREATE TABLE IF NOT EXISTS request_notes (
    id         TEXT PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    author_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
    text       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  -- Invitations for new matchmakers. Only a SHA-256 hash of the token is stored.
  CREATE TABLE IF NOT EXISTS invites (
    id         TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    email      TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at    INTEGER,
    used_by    TEXT REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS requests_seeker ON requests(seeker_id);
  CREATE INDEX IF NOT EXISTS request_notes_request ON request_notes(request_id);
  CREATE INDEX IF NOT EXISTS proposals_request ON proposals(request_id);
  CREATE INDEX IF NOT EXISTS proposals_candidate ON proposals(candidate_id);
`)

/* ---------- Upgrades for databases created by earlier versions ---------- */

/** Adds a column if it's missing; returns true when it was just added. */
function addColumn(table: string, column: string, definition: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (columns.some((c) => c.name === column)) return false
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  return true
}

// Which matchmaker looks after a request (NULL = unassigned).
addColumn('requests', 'matchmaker_id', 'TEXT REFERENCES users(id) ON DELETE SET NULL')
addColumn('requests', 'assigned_at', 'INTEGER')

// Matchmakers who applied publicly wait for approval (approved_at NULL) before they can see anything.
// Matchmakers that existed before approvals were introduced are approved once, here.
if (addColumn('matchmakers', 'approved_at', 'INTEGER')) {
  db.exec('UPDATE matchmakers SET approved_at = updated_at')
}
// The application (experience, motivation) a matchmaker submitted, as JSON.
addColumn('matchmakers', 'application', 'TEXT')

// Every matchmaker account gets a profile, named after their email until they edit it.
// (Accounts created before profiles existed were already trusted, so they're approved.)
db.exec(`
  INSERT INTO matchmakers (user_id, display_name, updated_at, approved_at)
  SELECT u.id, substr(u.email, 1, instr(u.email, '@') - 1), u.created_at, u.created_at
  FROM users u LEFT JOIN matchmakers m ON m.user_id = u.id
  WHERE u.role = 'matchmaker' AND m.user_id IS NULL
`)

/** Typed helpers around node:sqlite's untyped rows. */
export function all<T>(sql: string, ...params: (string | number | null)[]): T[] {
  return db.prepare(sql).all(...params) as unknown as T[]
}

export function get<T>(sql: string, ...params: (string | number | null)[]): T | undefined {
  return db.prepare(sql).get(...params) as unknown as T | undefined
}

export function run(sql: string, ...params: (string | number | null)[]) {
  return db.prepare(sql).run(...params)
}

/** Runs `fn` atomically. */
export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
