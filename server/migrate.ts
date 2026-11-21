import { all, client, get, isRemoteDb, run } from './db.ts'

// Creates the schema and upgrades databases made by earlier versions. Safe to run any number of
// times: every step checks first. Runs on each deploy (`npm run vercel-build`), from
// `npm run migrate`, and when the local dev server starts.

const SCHEMA = `
  -- Seekers (public site), matchmakers (/matchmaker) and super users (/admin) are separate
  -- realms: the same email can have one account in each, and each realm has its own log-in
  -- and session cookie.
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('seeker', 'matchmaker', 'admin')),
    created_at    INTEGER NOT NULL,
    UNIQUE (email, role)
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

  -- A member's photos in display order. The first one is also kept in profiles.photo_file as
  -- their main photo (portraits, public cards).
  CREATE TABLE IF NOT EXISTS profile_photos (
    id         TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    file       TEXT NOT NULL,
    position   INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS profile_photos_by_profile ON profile_photos (profile_id, position);

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

  -- Failed log-in / sign-up attempts per IP address (the rate limiter). Kept in the database
  -- so every server instance shares the same count.
  CREATE TABLE IF NOT EXISTS login_failures (
    ip       TEXT PRIMARY KEY,
    count    INTEGER NOT NULL,
    reset_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS requests_seeker ON requests(seeker_id);
  CREATE INDEX IF NOT EXISTS request_notes_request ON request_notes(request_id);
  CREATE INDEX IF NOT EXISTS proposals_request ON proposals(request_id);
  CREATE INDEX IF NOT EXISTS proposals_candidate ON proposals(candidate_id);
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
`

/** Adds a column if it's missing; returns true when it was just added. */
async function addColumn(table: string, column: string, definition: string): Promise<boolean> {
  const columns = await all<{ name: string }>(`PRAGMA table_info(${table})`)
  if (columns.some((c) => c.name === column)) return false
  try {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    return true
  } catch (error) {
    // Another deploy added it a moment ago.
    if (/duplicate column/i.test(String(error))) return false
    throw error
  }
}

/** Row counts of every table, to prove a rebuild kept every row. */
async function rowCounts(): Promise<Record<string, number>> {
  const tables = await all<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_new'`,
  )
  const counts: Record<string, number> = {}
  for (const { name } of tables) counts[name] = (await get<{ n: number }>(`SELECT COUNT(*) AS n FROM "${name}"`))!.n
  return counts
}

/**
 * Emails used to be unique across all accounts; now they're unique per realm. Later the super
 * user ('admin') role was added. SQLite can't change a constraint in place, so the table is
 * rebuilt once for each. Foreign keys must be off while the old table is dropped, otherwise the
 * drop would cascade to every profile, session and request — so this runs as one script on one
 * connection, and only on a local file (a hosted database is always created from an already
 * upgraded file, or from scratch).
 */
async function upgradeUsersTable() {
  const usersSql = (await get<{ sql: string }>(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'`))!.sql
  if (/UNIQUE\s*\(\s*email\s*,\s*role\s*\)/i.test(usersSql) && usersSql.includes("'admin'")) return
  if (isRemoteDb) {
    throw new Error(
      'The hosted database has an old users table. Run `npm run migrate` on the local database file first, then copy it again.',
    )
  }
  const before = await rowCounts()
  await client.executeMultiple(`
    PRAGMA foreign_keys = OFF;
    BEGIN;
    CREATE TABLE users_new (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN ('seeker', 'matchmaker', 'admin')),
      created_at    INTEGER NOT NULL,
      UNIQUE (email, role)
    );
    INSERT INTO users_new (id, email, password_hash, role, created_at)
      SELECT id, email, password_hash, role, created_at FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
    COMMIT;
    PRAGMA foreign_keys = ON;
  `)
  const after = await rowCounts()
  const changed = Object.keys(before).filter((t) => before[t] !== after[t])
  const broken = await all('PRAGMA foreign_key_check')
  if (changed.length > 0 || broken.length > 0) {
    throw new Error(
      `Users table upgrade changed row counts (${changed.join(', ') || 'none'}) or broke ${broken.length} foreign key(s). ` +
        'Restore the database from your backup.',
    )
  }
}

export async function migrate(): Promise<void> {
  await client.executeMultiple(SCHEMA)
  await upgradeUsersTable()

  // A super user can suspend any account: it can't log in, and its sessions are ended.
  await addColumn('users', 'suspended_at', 'INTEGER')
  // When the person accepted the terms, privacy policy and (matchmakers) code of conduct at sign-up.
  await addColumn('users', 'terms_accepted_at', 'INTEGER')
  // A super user promoted from a matchmaker account points back to it (for display).
  await addColumn('users', 'promoted_from', 'TEXT REFERENCES users(id) ON DELETE SET NULL')

  // Which matchmaker looks after a request (NULL = unassigned).
  await addColumn('requests', 'matchmaker_id', 'TEXT REFERENCES users(id) ON DELETE SET NULL')
  await addColumn('requests', 'assigned_at', 'INTEGER')

  // Matchmakers who applied publicly wait for approval (approved_at NULL) before they can see anything.
  // Matchmakers that existed before approvals were introduced are approved once, here.
  if (await addColumn('matchmakers', 'approved_at', 'INTEGER')) {
    await run('UPDATE matchmakers SET approved_at = updated_at')
  }
  // The application (experience, motivation) a matchmaker submitted, as JSON.
  await addColumn('matchmakers', 'application', 'TEXT')

  // Members whose single photo predates photo galleries (or was just seeded) get it as their first photo.
  await run(`
    INSERT INTO profile_photos (id, profile_id, file, position, created_at)
    SELECT lower(hex(randomblob(16))), p.id, p.photo_file, 0, p.updated_at
    FROM profiles p
    WHERE p.photo_file IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profile_photos g WHERE g.profile_id = p.id)
  `)

  // Every matchmaker account gets a profile, named after their email until they edit it.
  // (Accounts created before profiles existed were already trusted, so they're approved.)
  await run(`
    INSERT INTO matchmakers (user_id, display_name, updated_at, approved_at)
    SELECT u.id, substr(u.email, 1, instr(u.email, '@') - 1), u.created_at, u.created_at
    FROM users u LEFT JOIN matchmakers m ON m.user_id = u.id
    WHERE u.role = 'matchmaker' AND m.user_id IS NULL
  `)
}
