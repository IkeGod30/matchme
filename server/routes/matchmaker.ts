import { randomBytes, randomUUID } from 'node:crypto'
import express from 'express'
import { requestStatus } from '../../src/lib/requests.ts'
import { currentUser, requireRole } from '../auth.ts'
import {
  allProfiles,
  allRequests,
  approvedMatchmakerRow,
  matchmakerRow,
  pendingInvites,
  profileRow,
  requestById,
  team,
  teamMember,
  withInternalNotes,
} from '../data.ts'
import { get, run, transaction } from '../db.ts'
import { matchmakerInviteEmail } from '../emails.ts'
import { APP_URL, EMAIL, fail, optionalText, recordInterest, sha256, textList } from '../http.ts'
import { sendEmailInBackground } from '../mailer.ts'
import { BadRequest, deleteUnusedPhotos, savePhoto } from '../photos.ts'

/** The matchmaker section: requests, members, team, example photos and their own profile. */
export const matchmakerRoutes = express.Router()
matchmakerRoutes.use(requireRole('matchmaker'))

const INVITE_TTL_MS = 7 * 24 * 3600_000

matchmakerRoutes.get('/state', async (_req, res) => {
  const me = currentUser(res, 'matchmaker')!
  res.json({
    me: await teamMember(me.id),
    team: await team(),
    invites: await pendingInvites(),
    profiles: await allProfiles(),
    requests: await withInternalNotes(await allRequests()),
  })
})

/* ---------- Requests ---------- */

matchmakerRoutes.post('/requests/:id/assign', async (req, res) => {
  const request = await requestById(req.params.id)
  if (!request) return fail(res, 404, 'Request not found.')
  const { matchmakerId } = req.body ?? {}
  if (matchmakerId !== null && (typeof matchmakerId !== 'string' || !(await approvedMatchmakerRow(matchmakerId)))) {
    return fail(res, 400, 'Choose a matchmaker on the team.')
  }
  await run(
    'UPDATE requests SET matchmaker_id = ?, assigned_at = ? WHERE id = ?',
    matchmakerId,
    matchmakerId ? Date.now() : null,
    request.id,
  )
  res.json({ ok: true })
})

matchmakerRoutes.post('/requests/:id/internal-notes', async (req, res) => {
  const request = await requestById(req.params.id)
  if (!request) return fail(res, 404, 'Request not found.')
  const text = optionalText(req.body?.text, 'Note', 2000)
  if (!text) return fail(res, 400, 'Write a note first.')
  await run(
    'INSERT INTO request_notes (id, request_id, author_id, text, created_at) VALUES (?, ?, ?, ?, ?)',
    randomUUID(),
    request.id,
    currentUser(res, 'matchmaker')!.id,
    text,
    Date.now(),
  )
  res.status(201).json({ ok: true })
})

matchmakerRoutes.post('/requests/:id/proposals', async (req, res) => {
  const { picks, message } = req.body ?? {}
  const text = optionalText(message, 'Message', 2000)
  const me = currentUser(res, 'matchmaker')!.id
  const now = Date.now()
  // Checked and written in one transaction, so two matchmakers proposing the same person to the
  // same request at once can't both succeed.
  const outcome = await transaction(async (tx) => {
    const request = await requestById(req.params.id, tx)
    if (!request) return 'not-found' as const
    if (['closed', 'matched'].includes(requestStatus(request))) return 'not-open' as const
    if (!Array.isArray(picks) || picks.length === 0 || picks.length > 20) return 'bad-picks' as const
    const proposed = new Set(request.proposals.map((p) => p.candidateId))
    const clean: { candidateId: string; note: string }[] = []
    for (const pick of picks as unknown[]) {
      const { candidateId, note } = (pick ?? {}) as { candidateId?: unknown; note?: unknown }
      if (typeof candidateId !== 'string' || !(await profileRow(candidateId, tx))) throw new BadRequest('A chosen member no longer exists.')
      if (candidateId === request.seekerId) throw new BadRequest('You can’t propose seekers to themselves.')
      if (proposed.has(candidateId)) throw new BadRequest('One of these people was already proposed.')
      proposed.add(candidateId)
      clean.push({ candidateId, note: optionalText(note, 'Note') ?? '' })
    }
    for (const pick of clean) {
      await tx.run(
        'INSERT INTO proposals (id, request_id, candidate_id, note, proposed_at) VALUES (?, ?, ?, ?, ?)',
        randomUUID(),
        request.id,
        pick.candidateId,
        pick.note,
        now,
      )
    }
    if (text) {
      await tx.run('UPDATE requests SET notes = ? WHERE id = ?', JSON.stringify([...request.notes, { at: now, text }]), request.id)
    }
    // Whoever sends matches on an unassigned request takes it on.
    if (!request.matchmakerId) {
      await tx.run('UPDATE requests SET matchmaker_id = ?, assigned_at = ? WHERE id = ?', me, now, request.id)
    }
    return 'ok' as const
  })
  if (outcome === 'not-found') return fail(res, 404, 'Request not found.')
  if (outcome === 'not-open') return fail(res, 409, 'This request is no longer open.')
  if (outcome === 'bad-picks') return fail(res, 400, 'Choose 1–20 people to propose.')
  res.status(201).json({ ok: true })
})

matchmakerRoutes.post('/proposals/:id/interest', (req, res) => recordInterest(req, res, () => true))

matchmakerRoutes.post('/requests/:id/close', async (req, res) => {
  const request = await requestById(req.params.id)
  if (!request) return fail(res, 404, 'Request not found.')
  await run('UPDATE requests SET closed_at = ? WHERE id = ? AND closed_at IS NULL', Date.now(), request.id)
  res.json({ ok: true })
})

/* ---------- My profile ---------- */

matchmakerRoutes.put('/profile', async (req, res) => {
  const me = currentUser(res, 'matchmaker')!
  const body = req.body ?? {}
  const displayName = optionalText(body.displayName, 'Name', 60)
  if (!displayName) return fail(res, 400, 'Enter the name seekers will see.')
  const bio = optionalText(body.bio, 'About you', 1000) ?? ''
  const specialties = textList(body.specialties, 'Specialties', 10, 60)
  const languages = textList(body.languages, 'Languages', 10, 40)

  const previous = (await matchmakerRow(me.id))?.photo_file ?? null
  let photoFile = previous
  if (typeof body.photo === 'string') photoFile = await savePhoto(body.photo)
  else if (body.photo === null) photoFile = null

  try {
    await run(
      `UPDATE matchmakers SET display_name = ?, bio = ?, specialties = ?, languages = ?, photo_file = ?, updated_at = ?
       WHERE user_id = ?`,
      displayName,
      bio,
      JSON.stringify(specialties),
      JSON.stringify(languages),
      photoFile,
      Date.now(),
      me.id,
    )
  } catch (error) {
    // Don't leave the new upload behind.
    if (photoFile !== previous) await deleteUnusedPhotos([photoFile])
    throw error
  }
  // The old photo goes only once the profile no longer points at it.
  if (photoFile !== previous) await deleteUnusedPhotos([previous])
  res.json({ me: await teamMember(me.id) })
})

/* ---------- Team & invitations ---------- */

matchmakerRoutes.post('/invites', async (req, res) => {
  const me = currentUser(res, 'matchmaker')!
  const email = optionalText(req.body?.email, 'Email', 200)?.toLowerCase() ?? null
  if (email && !EMAIL.test(email)) return fail(res, 400, 'Enter a valid email address, or leave it empty.')
  if (email && (await get('SELECT 1 FROM users WHERE email = ?', email))) {
    return fail(res, 409, 'Someone already has an account with that email.')
  }

  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  await run(
    'INSERT INTO invites (id, token_hash, email, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    randomUUID(),
    sha256(token),
    email,
    me.id,
    now,
    now + INVITE_TTL_MS,
  )
  const link = `${APP_URL}/#invite=${token}`
  if (email) {
    const inviter = (await matchmakerRow(me.id))?.display_name ?? 'A MatchMeHub matchmaker'
    sendEmailInBackground(matchmakerInviteEmail(email, link, inviter), 'invite')
  }
  // The link is shown once so it can also be shared directly; only its hash is stored.
  res.status(201).json({ link, emailed: !!email })
})

matchmakerRoutes.delete('/invites/:id', async (req, res) => {
  await run('DELETE FROM invites WHERE id = ? AND used_at IS NULL', req.params.id)
  res.json({ ok: true })
})

/* ---------- Example photos ---------- */

matchmakerRoutes.put('/examples', async (req, res) => {
  const { feature, option, photo } = req.body ?? {}
  if (typeof feature !== 'string' || typeof option !== 'string' || feature.length > 40 || option.length > 40) {
    return fail(res, 400, 'Feature and option are required.')
  }
  const key = `${feature}:${option}`
  const existing = await get<{ photo_file: string }>('SELECT photo_file FROM examples WHERE key = ?', key)
  if (typeof photo === 'string') {
    const file = await savePhoto(photo)
    await run(
      `INSERT INTO examples (key, photo_file, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET photo_file = excluded.photo_file, updated_at = excluded.updated_at`,
      key,
      file,
      Date.now(),
    )
  } else if (photo === null) {
    await run('DELETE FROM examples WHERE key = ?', key)
  } else {
    return fail(res, 400, 'Photo must be an image or null.')
  }
  await deleteUnusedPhotos([existing?.photo_file])
  res.json({ ok: true })
})
