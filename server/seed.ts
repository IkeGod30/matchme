// Seeds the database with the sample (demo) members, their placeholder photos, a few
// demo match requests and a matchmaker account.
//
//   npm run seed                     add sample data if the database is empty
//   npm run seed -- --reset          wipe the database and uploads first
//   npm run seed -- --update-samples refresh sample members' details from src/data/sampleProfiles.ts
//                                    (keeps real accounts, photos, requests and visibility)
//
// Matchmaker login: MATCHMAKER_EMAIL / MATCHMAKER_PASSWORD env vars, otherwise
// matchmaker@matchme.local with a generated password that is printed once.

import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'
import type { Profile } from '../src/types.ts'
import { DATA_DIR, DB_FILE } from './db-paths.ts'

const root = path.resolve(import.meta.dirname, '..')

if (process.argv.includes('--reset')) {
  rmSync(DB_FILE, { force: true })
  rmSync(`${DB_FILE}-wal`, { force: true })
  rmSync(`${DB_FILE}-shm`, { force: true })
  rmSync(path.join(DATA_DIR, 'uploads'), { recursive: true, force: true })
  console.log('Database and uploads wiped.')
}

// Imported after the optional reset so the schema is recreated on a fresh file.
const { get, run, transaction, UPLOAD_DIR } = await import('./db.ts')
const { createUser } = await import('./auth.ts')

// Sample profiles live in the web app and use Vite features (bundled photo imports),
// so load them through Vite.
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { SAMPLE_PROFILES } = (await vite.ssrLoadModule('/src/data/sampleProfiles.ts')) as { SAMPLE_PROFILES: Profile[] }
await vite.close()

/** Profile fields stored in the JSON column (photo, demo flag and visibility have their own columns). */
function profileData(p: Profile): string {
  const data: Partial<Profile> = { ...p }
  delete data.photo
  delete data.isDemo
  delete data.publicListing
  return JSON.stringify(data)
}

if (process.argv.includes('--update-samples')) {
  let updated = 0
  transaction(() => {
    for (const p of SAMPLE_PROFILES) {
      updated += Number(run('UPDATE profiles SET data = ?, updated_at = ? WHERE id = ? AND is_demo = 1', profileData(p), Date.now(), p.id).changes)
    }
  })
  console.log(`Updated ${updated} sample members. Real accounts, photos and requests were left as they are.`)
  process.exit(0)
}

if (get('SELECT 1 FROM profiles LIMIT 1')) {
  console.log('The database already has members. Use `npm run seed -- --reset` to start over,')
  console.log('or `npm run seed -- --update-samples` to refresh the sample members only.')
  process.exit(0)
}

const now = Date.now()
const HOUR = 3_600_000
const DAY = 24 * HOUR

transaction(() => {
  for (const p of SAMPLE_PROFILES) {
    let photoFile: string | null = null
    if (p.photo) {
      // e.g. /src/assets/demo-photos/daniel.jpg
      const source = path.join(root, p.photo.split('?')[0])
      if (existsSync(source)) {
        photoFile = `demo-${path.basename(source)}`
        copyFileSync(source, path.join(UPLOAD_DIR, photoFile))
      }
    }
    run(
      `INSERT INTO profiles (id, user_id, data, photo_file, is_demo, public_listing, updated_at)
       VALUES (?, NULL, ?, ?, 1, ?, ?)`,
      p.id,
      profileData(p),
      photoFile,
      p.publicListing ? 1 : 0,
      now,
    )
  }

  const byName = (name: string) => SAMPLE_PROFILES.find((p) => p.name === name)!.id

  // Two new requests waiting for the matchmaker, and one further along.
  run('INSERT INTO requests (id, seeker_id, created_at) VALUES (?, ?, ?)', 'req-seed-1', byName('Amara'), now - 2 * DAY)
  run('INSERT INTO requests (id, seeker_id, created_at) VALUES (?, ?, ?)', 'req-seed-2', byName('Kwame'), now - 5 * HOUR)
  run(
    'INSERT INTO requests (id, seeker_id, created_at, notes) VALUES (?, ?, ?, ?)',
    'req-seed-3',
    byName('Nia'),
    now - 4 * DAY,
    JSON.stringify([{ at: now - 2 * DAY, text: 'Nia, I think both of these gentlemen could be a lovely fit. Let me know!' }]),
  )
  run(
    `INSERT INTO proposals (id, request_id, candidate_id, note, proposed_at, response, responded_at, comment)
     VALUES (?, ?, ?, ?, ?, 'declined', ?, ?)`,
    'prop-seed-1',
    'req-seed-3',
    byName('Kwame'),
    'Faith-driven, ambitious and family-minded — very much what you described.',
    now - 2 * DAY,
    now - DAY,
    'He seems wonderful, but I would really prefer someone already in the US.',
  )
  run(
    `INSERT INTO proposals (id, request_id, candidate_id, note, proposed_at, response, responded_at, comment,
       candidate_response, candidate_responded_at, candidate_comment)
     VALUES (?, ?, ?, ?, ?, 'accepted', ?, ?, 'interested', ?, ?)`,
    'prop-seed-2',
    'req-seed-3',
    byName('Marcus'),
    'Tall, athletic and ready to settle down. He has visited New York often.',
    now - 2 * DAY,
    now - 20 * HOUR,
    'Yes please! Would love an introduction.',
    now - 6 * HOUR,
    'Happy to meet her — she sounds lovely.',
  )
})
console.log(`Added ${SAMPLE_PROFILES.length} sample members and 3 demo requests.`)

const email = process.env.MATCHMAKER_EMAIL ?? 'matchmaker@matchme.local'
if (get('SELECT 1 FROM users WHERE email = ?', email.toLowerCase())) {
  console.log(`Matchmaker account ${email} already exists.`)
} else {
  const password = process.env.MATCHMAKER_PASSWORD ?? randomBytes(9).toString('base64url')
  const matchmaker = await createUser(email, password, 'matchmaker')
  run(
    `INSERT INTO matchmakers (user_id, display_name, bio, specialties, languages, updated_at, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    matchmaker.id,
    process.env.MATCHMAKER_NAME ?? 'Funke Adeyemi',
    'Ten years of introducing people who are serious about building a life together. I take time to understand what really matters to you.',
    JSON.stringify(['Marriage-minded professionals', 'Nigeria & diaspora']),
    JSON.stringify(['English', 'Yoruba']),
    Date.now(),
    Date.now(),
  )
  // The demo request that's already in progress belongs to this matchmaker.
  run('UPDATE requests SET matchmaker_id = ?, assigned_at = ? WHERE id = ?', matchmaker.id, Date.now(), 'req-seed-3')
  console.log('\nMatchmaker account created:')
  console.log(`  email:    ${email}`)
  console.log(`  password: ${process.env.MATCHMAKER_PASSWORD ? '(from MATCHMAKER_PASSWORD)' : password}`)
  console.log('  Save this password — it is not shown again. Re-run with --reset to create a new one.\n')
}
