import { randomBytes } from 'node:crypto'
import { createUser, type User } from './auth.ts'
import { galleryRows, matchmakerRow, profileRowForUser } from './data.ts'
import { get, run } from './db.ts'
import { deletePhoto } from './photos.ts'

/**
 * Permanently deletes an account. The database cascades to a seeker's profile, requests and
 * proposals, a matchmaker's team profile, and sessions; requests a matchmaker looked after
 * become unassigned. Their photo files are removed too.
 */
export function deleteAccount(userId: string) {
  const files = new Set<string | null>()
  const profile = profileRowForUser(userId)
  if (profile) {
    files.add(profile.photo_file)
    for (const g of galleryRows(profile.id)) files.add(g.file)
  }
  files.add(matchmakerRow(userId)?.photo_file ?? null)
  run('DELETE FROM users WHERE id = ?', userId)
  for (const file of files) deletePhoto(file)
}

/**
 * Creates a super-user account. Without a password it gets a random one nobody knows, and the
 * person chooses their own from an emailed link.
 */
export async function createSuperUser(email: string, password?: string, promotedFrom?: string): Promise<User> {
  const user = await createUser(email, password ?? randomBytes(24).toString('base64url'), 'admin')
  if (promotedFrom) run('UPDATE users SET promoted_from = ? WHERE id = ?', promotedFrom, user.id)
  return user
}

/**
 * Creates a super user from ADMIN_EMAIL / ADMIN_PASSWORD (or admin@matchme.local and a generated
 * password) and prints the log-in once. Used by `npm run seed` and `npm run create-admin`.
 */
export async function createSuperUserFromEnv(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@matchme.local').trim().toLowerCase()
  if (get(`SELECT 1 FROM users WHERE role = 'admin' AND email = ?`, email)) {
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
