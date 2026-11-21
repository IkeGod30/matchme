import { randomBytes } from 'node:crypto'
import { createUser, type User } from './auth.ts'
import { get, run, transaction, type Queries } from './db.ts'
import { deleteUnusedPhotos } from './photos.ts'

/** True if no *other* active super user exists (so this one must be kept). */
export async function isOnlyActiveSuperUser(q: Queries, userId: string): Promise<boolean> {
  const row = await q.get<{ role: string; suspended_at: number | null }>('SELECT role, suspended_at FROM users WHERE id = ?', userId)
  if (!row || row.role !== 'admin' || row.suspended_at !== null) return false
  return !(await q.get(`SELECT 1 FROM users WHERE role = 'admin' AND suspended_at IS NULL AND id <> ?`, userId))
}

/**
 * Permanently deletes an account, with everything that belongs to it: a seeker's profile,
 * photos, requests and proposals (and proposals of them to others), a matchmaker's team profile,
 * sessions and reset links. Requests a matchmaker looked after become unassigned, and their notes
 * and invitations stay without an author. This is exactly what the schema's ON DELETE rules do;
 * it's done explicitly, in one transaction, so it never depends on foreign-key enforcement.
 *
 * With `keepLastSuperUser`, refuses (returns 'last-super-user') when this is the only active super
 * user — checked inside the transaction, so two super users can't remove each other at once.
 */
export async function deleteAccount(
  userId: string,
  { keepLastSuperUser = false } = {},
): Promise<'deleted' | 'not-found' | 'last-super-user'> {
  const outcome = await transaction(async (tx) => {
    if (!(await tx.get('SELECT 1 FROM users WHERE id = ?', userId))) return { result: 'not-found' as const, files: [] }
    if (keepLastSuperUser && (await isOnlyActiveSuperUser(tx, userId))) return { result: 'last-super-user' as const, files: [] }

    const files: (string | null)[] = []
    const matchmaker = await tx.get<{ photo_file: string | null }>('SELECT photo_file FROM matchmakers WHERE user_id = ?', userId)
    files.push(matchmaker?.photo_file ?? null)

    for (const profile of await tx.all<{ id: string; photo_file: string | null }>(
      'SELECT id, photo_file FROM profiles WHERE user_id = ?',
      userId,
    )) {
      files.push(profile.photo_file)
      for (const g of await tx.all<{ file: string }>('SELECT file FROM profile_photos WHERE profile_id = ?', profile.id)) {
        files.push(g.file)
      }
      const theirRequests = 'SELECT id FROM requests WHERE seeker_id = ?'
      await tx.run(
        `DELETE FROM requested_members WHERE candidate_id = ? OR request_id IN (${theirRequests})`,
        profile.id,
        profile.id,
      )
      await tx.run(`DELETE FROM request_notes WHERE request_id IN (${theirRequests})`, profile.id)
      await tx.run(`DELETE FROM proposals WHERE candidate_id = ? OR request_id IN (${theirRequests})`, profile.id, profile.id)
      await tx.run('DELETE FROM requests WHERE seeker_id = ?', profile.id)
      await tx.run('DELETE FROM profile_photos WHERE profile_id = ?', profile.id)
      await tx.run('DELETE FROM profiles WHERE id = ?', profile.id)
    }

    // ON DELETE SET NULL references.
    await tx.run('UPDATE request_notes SET author_id = NULL WHERE author_id = ?', userId)
    await tx.run('UPDATE invites SET created_by = NULL WHERE created_by = ?', userId)
    await tx.run('UPDATE invites SET used_by = NULL WHERE used_by = ?', userId)
    await tx.run('UPDATE requests SET matchmaker_id = NULL WHERE matchmaker_id = ?', userId)
    await tx.run('UPDATE users SET promoted_from = NULL WHERE promoted_from = ?', userId)

    // ON DELETE CASCADE references.
    await tx.run('DELETE FROM sessions WHERE user_id = ?', userId)
    await tx.run('DELETE FROM password_resets WHERE user_id = ?', userId)
    await tx.run('DELETE FROM matchmakers WHERE user_id = ?', userId)
    await tx.run('DELETE FROM users WHERE id = ?', userId)
    return { result: 'deleted' as const, files }
  })
  // Photos go only after the rows are gone for good.
  await deleteUnusedPhotos(outcome.files)
  return outcome.result
}

/**
 * Creates a super-user account. Without a password it gets a random one nobody knows, and the
 * person chooses their own from an emailed link.
 */
export async function createSuperUser(email: string, password?: string, promotedFrom?: string): Promise<User> {
  const user = await createUser(email, password ?? randomBytes(24).toString('base64url'), 'admin')
  if (promotedFrom) await run('UPDATE users SET promoted_from = ? WHERE id = ?', promotedFrom, user.id)
  return user
}

/**
 * Creates a super user from ADMIN_EMAIL / ADMIN_PASSWORD (or admin@matchmehub.local and a generated
 * password) and prints the log-in once. Used by `npm run seed` and `npm run create-admin`.
 */
export async function createSuperUserFromEnv(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@matchmehub.local').trim().toLowerCase()
  if (await get(`SELECT 1 FROM users WHERE role = 'admin' AND email = ?`, email)) {
    console.log(`Super user ${email} already exists.`)
    return
  }
  const password = process.env.ADMIN_PASSWORD ?? randomBytes(12).toString('base64url')
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters.')
  await createSuperUser(email, password)
  console.log('\nSuper user account created (log in at /admin):')
  console.log(`  email:    ${email}`)
  console.log(`  password: ${process.env.ADMIN_PASSWORD ? '(from ADMIN_PASSWORD)' : password}`)
  console.log('  Save this password — it is not shown again. Use “Forgot your password?” at /admin to change it.\n')
}
