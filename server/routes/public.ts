import express from 'express'
import { signedInUsers } from '../auth.ts'
import { anyCanViewProfile, galleryRows, matchmakerRow, profileRow, publicCards } from '../data.ts'
import { all, get } from '../db.ts'
import { fail } from '../http.ts'
import { sendPhoto } from '../photos.ts'
import { findInvite } from './auth.ts'

/** Routes anyone can call; photo routes apply their own access checks. */
export const publicRoutes = express.Router()

publicRoutes.get('/public/featured', async (_req, res) => {
  res.json({ members: await publicCards() })
})

/** Lets the matchmaker sign-up page check an invitation before showing the form. */
publicRoutes.get('/public/invites/:token', async (req, res) => {
  const invite = await findInvite(req.params.token)
  res.json({ valid: !!invite, email: invite?.email ?? null })
})

publicRoutes.get('/examples', async (_req, res) => {
  const rows = await all<{ key: string; updated_at: number }>('SELECT key, updated_at FROM examples')
  res.json({
    examples: Object.fromEntries(
      rows.map((r) => [r.key, `/api/examples/photo/${encodeURIComponent(r.key)}?v=${r.updated_at}`]),
    ),
  })
})

publicRoutes.get('/examples/photo/:key', async (req, res) => {
  const row = await get<{ photo_file: string }>('SELECT photo_file FROM examples WHERE key = ?', req.params.key)
  if (!row) return fail(res, 404, 'Not found.')
  res.set('Cache-Control', 'public, max-age=86400')
  await sendPhoto(req, res, row.photo_file)
})

publicRoutes.get('/photos/:profileId', async (req, res) => {
  const row = await profileRow(req.params.profileId)
  // Same 404 whether the photo doesn't exist or the viewer isn't allowed to see it.
  // Visible if a signed-in user of either realm may see it (public listings need no one signed in).
  if (!row?.photo_file) return fail(res, 404, 'Not found.')
  if (row.public_listing !== 1 && !(await anyCanViewProfile(signedInUsers(res), row.id))) return fail(res, 404, 'Not found.')
  res.set('Cache-Control', row.public_listing ? 'public, max-age=3600' : 'private, max-age=3600')
  await sendPhoto(req, res, row.photo_file)
})

/** One of a member's photos. Unlike the main photo, these aren't public even on a public listing. */
publicRoutes.get('/photos/:profileId/:photoId', async (req, res) => {
  const { profileId, photoId } = req.params
  const photo = (await galleryRows(profileId)).find((g) => g.id === photoId)
  if (!photo || !(await anyCanViewProfile(signedInUsers(res), profileId, { publicListingCounts: false }))) {
    return fail(res, 404, 'Not found.')
  }
  res.set('Cache-Control', 'private, max-age=86400')
  await sendPhoto(req, res, photo.file)
})

/** Matchmakers' photos are part of their professional profile, so they're public. */
publicRoutes.get('/matchmakers/:id/photo', async (req, res) => {
  const row = await matchmakerRow(req.params.id)
  if (!row?.photo_file) return fail(res, 404, 'Not found.')
  res.set('Cache-Control', 'public, max-age=3600')
  await sendPhoto(req, res, row.photo_file)
})
