import express from 'express'
import { currentUser } from '../auth.ts'
import { canViewProfile, matchmakerRow, profileRow, publicCards } from '../data.ts'
import { all, get } from '../db.ts'
import { fail } from '../http.ts'
import { photoPath } from '../photos.ts'
import { findInvite } from './auth.ts'

/** Routes anyone can call; photo routes apply their own access checks. */
export const publicRoutes = express.Router()

publicRoutes.get('/public/featured', (_req, res) => {
  res.json({ members: publicCards() })
})

/** Lets the matchmaker sign-up page check an invitation before showing the form. */
publicRoutes.get('/public/invites/:token', (req, res) => {
  const invite = findInvite(req.params.token)
  res.json({ valid: !!invite, email: invite?.email ?? null })
})

publicRoutes.get('/examples', (_req, res) => {
  const rows = all<{ key: string; updated_at: number }>('SELECT key, updated_at FROM examples')
  res.json({
    examples: Object.fromEntries(
      rows.map((r) => [r.key, `/api/examples/photo/${encodeURIComponent(r.key)}?v=${r.updated_at}`]),
    ),
  })
})

publicRoutes.get('/examples/photo/:key', (req, res) => {
  const row = get<{ photo_file: string }>('SELECT photo_file FROM examples WHERE key = ?', req.params.key)
  if (!row) return fail(res, 404, 'Not found.')
  res.set('Cache-Control', 'public, max-age=86400')
  res.sendFile(photoPath(row.photo_file))
})

publicRoutes.get('/photos/:profileId', (req, res) => {
  const row = profileRow(req.params.profileId)
  // Same 404 whether the photo doesn't exist or the viewer isn't allowed to see it.
  if (!row?.photo_file || !canViewProfile(currentUser(res), row.id)) return fail(res, 404, 'Not found.')
  res.set('Cache-Control', row.public_listing ? 'public, max-age=3600' : 'private, max-age=3600')
  res.sendFile(photoPath(row.photo_file))
})

/** Matchmakers' photos are part of their professional profile, so they're public. */
publicRoutes.get('/matchmakers/:id/photo', (req, res) => {
  const row = matchmakerRow(req.params.id)
  if (!row?.photo_file) return fail(res, 404, 'Not found.')
  res.set('Cache-Control', 'public, max-age=3600')
  res.sendFile(photoPath(row.photo_file))
})
