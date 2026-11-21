// Concurrency test: fires many identical requests at once at every action that must only ever
// happen once (answering a proposal, paying, using a reset link or an invitation, approving an
// application, signing up, ...) and checks that exactly one succeeds and the data stays right.
//
//   npm run race-test -- --data <a COPY of server/data>     local database copy (never your real one)
//   npm run race-test -- --target staging                   the staging database (Turso)
//
// It starts the API in this process, adds its own test accounts (ids start with "race-"),
// and removes them all again at the end — so it is safe on staging. Don't run it on production.

import '../server/target-env.ts'
import { randomBytes } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { parseArgs } from 'node:util'

const { values: args } = parseArgs({ options: { target: { type: 'string' }, data: { type: 'string' } } })
if (args.target === 'production') {
  console.error('Not on production: the test creates and deletes accounts.')
  process.exit(1)
}
if (!args.target && !args.data) {
  console.error('Use --data <copy of server/data> or --target staging.')
  process.exit(1)
}
if (args.data) {
  const dir = path.resolve(args.data)
  if (dir === path.resolve(import.meta.dirname, '..', 'server', 'data')) {
    console.error('Use a copy of server/data, not the real folder.')
    process.exit(1)
  }
  process.env.MATCHMEHUB_DATA_DIR = dir
}

const { run, get, all, dbLabel } = await import('../server/db.ts')
const { migrate } = await import('../server/migrate.ts')
const { hashPassword } = await import('../server/auth.ts')
const { sha256 } = await import('../server/http.ts')
const { deleteAccount } = await import('../server/accounts.ts')
const { app, errorHandler } = await import('../server/app.ts')

await migrate()
app.use(errorHandler)
const server = app.listen(0)
await new Promise((resolve) => server.once('listening', resolve))
const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
console.log(`Race test on ${dbLabel}\n`)

/* ---------- Test accounts ---------- */

const now = Date.now()
const DAY = 86_400_000
const tag = randomBytes(3).toString('hex')
const id = (name: string) => `race-${tag}-${name}`
const password = await hashPassword('race-password-1')
const tokens: Record<string, string> = {}
const userIds: string[] = []

async function user(name: string, role: 'seeker' | 'matchmaker' | 'admin', { approved = true } = {}) {
  const uid = id(name)
  await run('INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)', uid, `${uid}@example.com`, password, role, now)
  if (role === 'matchmaker') {
    await run('INSERT INTO matchmakers (user_id, display_name, updated_at, approved_at) VALUES (?, ?, ?, ?)', uid, name, now, approved ? now : null)
  }
  tokens[name] = `tok-${uid}`
  await run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', tokens[name], uid, now + DAY)
  userIds.push(uid)
  return uid
}

const profileData = (name: string, gender: string, seeking: string[]) =>
  JSON.stringify({
    name,
    age: 30,
    gender,
    city: 'Lagos',
    country: 'Nigeria',
    bio: 'Race test',
    profession: 'Law',
    jobTitle: '',
    contact: { method: 'Email', value: 'race@example.com' },
    physical: { skinTone: 'Olive', hairColor: 'Black', hairLength: 'Short', eyeColor: 'Brown', facialHair: 'None' },
    request: { message: 'hi', seeking, ageMin: 18, ageMax: 99, locations: [], races: [], nationalities: [], professions: [], relationshipStatuses: [], physical: {} },
  })

async function profile(name: string, userId: string | null, gender: string, seeking: string[], publicListing = 0) {
  await run(
    'INSERT INTO profiles (id, user_id, data, photo_file, is_demo, public_listing, updated_at) VALUES (?, ?, ?, NULL, 0, ?, ?)',
    id(name),
    userId,
    profileData(name, gender, seeking),
    publicListing,
    now,
  )
  return id(name)
}

const seeker = await user('seeker', 'seeker')
const seeker2 = await user('seeker2', 'seeker')
const candidateUser = await user('candidate', 'seeker')
await user('mm1', 'matchmaker')
await user('mm2', 'matchmaker')
await user('admin', 'admin')
const applicant = await user('applicant', 'matchmaker', { approved: false })
const pSeeker = await profile('p-seeker', seeker, 'woman', ['man'])
const pSeeker2 = await profile('p-seeker2', seeker2, 'woman', ['man'])
const pCandidate = await profile('p-candidate', candidateUser, 'man', ['woman'], 1)

await run('INSERT INTO requests (id, seeker_id, created_at) VALUES (?, ?, ?)', id('r1'), pSeeker, now)
await run('INSERT INTO requests (id, seeker_id, created_at) VALUES (?, ?, ?)', id('r2'), pSeeker, now - 1000)
const proposal = (name: string, extra: string, values: (string | number)[]) =>
  run(
    `INSERT INTO proposals (id, request_id, candidate_id, proposed_at${extra ? ', ' + extra : ''}) VALUES (?, ?, ?, ?${', ?'.repeat(values.length)})`,
    id(name),
    id('r1'),
    pCandidate,
    now,
    ...values,
  )
await proposal('prop-pending', '', [])
await run('INSERT INTO requests (id, seeker_id, created_at) VALUES (?, ?, ?)', id('r3'), pSeeker, now - 2000)
await run(
  `INSERT INTO proposals (id, request_id, candidate_id, proposed_at, response, responded_at, candidate_response) VALUES (?, ?, ?, ?, 'accepted', ?, 'pending')`,
  id('prop-checking'),
  id('r3'),
  pCandidate,
  now,
  now,
)
await run('INSERT INTO requests (id, seeker_id, created_at) VALUES (?, ?, ?)', id('r4'), pSeeker, now - 3000)
await run(
  `INSERT INTO proposals (id, request_id, candidate_id, proposed_at, response, responded_at, candidate_response, candidate_responded_at)
   VALUES (?, ?, ?, ?, 'accepted', ?, 'interested', ?)`,
  id('prop-mutual'),
  id('r4'),
  pCandidate,
  now,
  now,
  now,
)
const resetToken = randomBytes(24).toString('base64url')
await run('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)', sha256(resetToken), seeker, now + DAY)
const inviteToken = randomBytes(24).toString('base64url')
await run(
  'INSERT INTO invites (id, token_hash, email, created_by, created_at, expires_at) VALUES (?, ?, NULL, NULL, ?, ?)',
  id('invite'),
  sha256(inviteToken),
  now,
  now + DAY,
)

/* ---------- Helpers ---------- */

const COOKIES: Record<string, string> = {
  seeker: 'mm_session',
  seeker2: 'mm_session',
  mm1: 'mm_staff_session',
  mm2: 'mm_staff_session',
  admin: 'mm_admin_session',
}

async function call(method: string, url: string, as?: string, body?: unknown): Promise<number> {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      ...(as && { cookie: `${COOKIES[as]}=${tokens[as]}` }),
      ...(body !== undefined && { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  await res.arrayBuffer()
  return res.status
}

const clearRateLimit = () => run('DELETE FROM login_failures')
const failures: string[] = []
let passed = 0

/**
 * Sends `times` requests at once. With `ok`, exactly one may succeed; with `ok` null (actions that
 * may safely repeat), only `check` decides — it inspects the data afterwards.
 */
async function race(
  label: string,
  times: number,
  request: (i: number) => Promise<number>,
  ok: ((status: number) => boolean) | null,
  check?: () => Promise<string | null>,
) {
  const statuses = await Promise.all(Array.from({ length: times }, (_, i) => request(i)))
  const wins = ok ? statuses.filter(ok).length : 1
  const problem = wins !== 1 ? `${wins} succeeded` : check ? await check() : null
  const summary = Object.entries(statuses.reduce<Record<number, number>>((m, s) => ({ ...m, [s]: (m[s] ?? 0) + 1 }), {}))
    .map(([s, n]) => `${n}×${s}`)
    .join(' ')
  if (problem) failures.push(`${label}: ${problem} (${summary})`)
  else passed++
  console.log(`${problem ? 'FAIL' : 'ok  '}  ${label.padEnd(46)} ${summary}${problem ? '  ← ' + problem : ''}`)
}

const N = 10
try {
  await race('answer a proposal (double click)', N, () => call('POST', `/api/seeker/proposals/${id('prop-pending')}/respond`, 'seeker', { response: 'accepted' }), (s) => s === 200)
  await race(
    'record the candidate’s interest',
    N,
    (i) => call('POST', `/api/matchmaker/proposals/${id('prop-checking')}/interest`, i % 2 ? 'mm1' : 'mm2', { answer: i % 2 ? 'interested' : 'not_interested' }),
    (s) => s === 200,
  )
  await race(
    'pay for a mutual match',
    N,
    () => call('POST', `/api/seeker/proposals/${id('prop-mutual')}/pay`, 'seeker'),
    (s) => s === 200,
    async () => {
      const row = await get<{ payment_ref: string | null }>('SELECT payment_ref FROM proposals WHERE id = ?', id('prop-mutual'))
      return row?.payment_ref ? null : 'no payment recorded'
    },
  )
  await clearRateLimit()
  await race('use a password reset link', N, () => call('POST', '/api/auth/reset', undefined, { token: resetToken, password: 'new-password-1' }), (s) => s === 200)
  await clearRateLimit()
  await race(
    'use a matchmaker invitation',
    N,
    (i) =>
      call('POST', '/api/auth/signup-matchmaker', undefined, {
        token: inviteToken,
        email: `${id('invited' + i)}@example.com`,
        password: 'race-password-1',
        displayName: 'Invited',
        agreeConfidentiality: true,
      }),
    (s) => s === 201,
    async () => {
      const n = (await all(`SELECT 1 FROM users WHERE email LIKE ?`, `${id('invited')}%`)).length
      return n === 1 ? null : `${n} accounts created`
    },
  )
  await race('approve a matchmaker application', N, () => call('POST', `/api/admin/applications/${applicant}/approve`, 'admin'), (s) => s === 200)
  await race(
    'propose the same person twice at once',
    N,
    (i) => call('POST', `/api/matchmaker/requests/${id('r2')}/proposals`, i % 2 ? 'mm1' : 'mm2', { picks: [{ candidateId: pCandidate }] }),
    (s) => s === 201,
    async () => {
      const n = (await all('SELECT 1 FROM proposals WHERE request_id = ?', id('r2'))).length
      return n === 1 ? null : `${n} proposals`
    },
  )
  await race(
    'request a featured member (no request yet)',
    N,
    () => call('POST', `/api/seeker/featured/${pCandidate}/request`, 'seeker2'),
    null,
    async () => {
      const requests = (await all('SELECT 1 FROM requests WHERE seeker_id = ?', pSeeker2)).length
      const asked = (await all('SELECT 1 FROM requested_members WHERE candidate_id = ?', pCandidate)).length
      return requests === 1 && asked === 1 ? null : `${requests} requests and ${asked} asks created`
    },
  )
  await clearRateLimit()
  await race(
    'sign up twice with the same email',
    N,
    () => call('POST', '/api/auth/signup', undefined, { email: `${id('dup')}@example.com`, password: 'race-password-1', agreeTerms: true }),
    (s) => s === 201,
    async () => {
      const n = (await all('SELECT 1 FROM users WHERE email = ?', `${id('dup')}@example.com`)).length
      return n === 1 ? null : `${n} accounts`
    },
  )
  await clearRateLimit()
  await race('“forgot password” pressed repeatedly', N, () => call('POST', '/api/auth/forgot', undefined, { email: `${seeker2}@example.com` }), null, async () => {
    const n = (await all('SELECT 1 FROM password_resets WHERE user_id = ?', seeker2)).length
    return n === 1 ? null : `${n} reset links created`
  })

  // Rate limiter: 20 failed log-ins are allowed per 15 minutes, the 21st is refused.
  await clearRateLimit()
  const statuses: number[] = []
  for (let i = 0; i < 21; i++) statuses.push(await call('POST', '/api/auth/login', undefined, { email: `${seeker}@example.com`, password: 'wrong-password' }))
  const limited = statuses.slice(0, 20).every((s) => s === 401) && statuses[20] === 429
  if (limited) passed++
  else failures.push(`rate limit: got ${statuses.join(',')}`)
  console.log(`${limited ? 'ok  ' : 'FAIL'}  ${'21st failed log-in is refused (429)'.padEnd(46)} ${statuses.slice(-2).join(', ')}`)
} finally {
  /* ---------- Clean up everything the test added ---------- */
  await clearRateLimit()
  const created = await all<{ id: string }>(`SELECT id FROM users WHERE id LIKE ? OR email LIKE ?`, `race-${tag}-%`, `race-${tag}-%`)
  for (const u of new Set([...userIds, ...created.map((c) => c.id)])) await deleteAccount(u)
  await run('DELETE FROM invites WHERE id = ?', id('invite'))
  server.close()
  const left = await get<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM users WHERE id LIKE ?1 OR email LIKE ?1) + (SELECT COUNT(*) FROM profiles WHERE id LIKE ?1)
       + (SELECT COUNT(*) FROM requests WHERE id LIKE ?1 OR seeker_id LIKE ?1) + (SELECT COUNT(*) FROM proposals WHERE candidate_id LIKE ?1) AS n`,
    `race-${tag}-%`,
  )
  console.log(`\nCleaned up the test accounts (${left?.n ?? '?'} test rows left).`)
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length > 0) {
  console.log(failures.map((f) => `  ${f}`).join('\n'))
  process.exit(1)
}
process.exit(0)
