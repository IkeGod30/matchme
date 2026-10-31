import { randomBytes, randomUUID } from 'node:crypto'
import express from 'express'
import { requestStatus } from '../../src/lib/requests.ts'
import { currentUser, requireRole } from '../auth.ts'
import {
  allProfiles,
  allRequests,
  approvedMatchmakerRow,
  matchmakerRow,
  pendingApplications,
  pendingInvites,
  profileRow,
  requestById,
  team,
  teamMember,
  withInternalNotes,
} from '../data.ts'
import { get, run, transaction } from '../db.ts'
import { applicationDecisionEmail, matchmakerInviteEmail } from '../emails.ts'
import { APP_URL, EMAIL, fail, optionalText, recordInterest, sha256, textList } from '../http.ts'
import { sendEmail } from '../mailer.ts'
import { BadRequest, deletePhoto, savePhoto } from '../photos.ts'

/** The matchmaker section: requests, members, team, example photos and their own profile. */
export const matchmakerRoutes = express.Router()
matchmakerRoutes.use(requireRole('matchmaker'))

const INVITE_TTL_MS = 7 * 24 * 3600_000

matchmakerRoutes.get('/state', (_req, res) => {
  const me = currentUser(res)!
  res.json({
    me: teamMember(me.id),
    team: team(),
    invites: pendingInvites(),
    applications: pendingApplications(),
    profiles: allProfiles(),
    requests: withInternalNotes(allRequests()),
  })
})

/* ---------- Requests ---------- */

matchmakerRoutes.post('/requests/:id/assign', (req, res) => {
  const request = requestById(req.params.id)
  if (!request) return fail(res, 404, 'Request not found.')
  const { matchmakerId } = req.body ?? {}
  if (matchmakerId !== null && (typeof matchmakerId !== 'string' || !approvedMatchmakerRow(matchmakerId))) {
    return fail(res, 400, 'Choose a matchmaker on the team.')
  }
  run(
    'UPDATE requests SET matchmaker_id = ?, assigned_at = ? WHERE id = ?',
    matchmakerId,
    matchmakerId ? Date.now() : null,
    request.id,
  )
  res.json({ ok: true })
})

matchmakerRoutes.post('/requests/:id/internal-notes', (req, res) => {
  const request = requestById(req.params.id)
  if (!request) return fail(res, 404, 'Request not found.')
  const text = optionalText(req.body?.text, 'Note', 2000)
  if (!text) return fail(res, 400, 'Write a note first.')
  run(
    'INSERT INTO request_notes (id, request_id, author_id, text, created_at) VALUES (?, ?, ?, ?, ?)',
    randomUUID(),
    request.id,
    currentUser(res)!.id,
    text,
    Date.now(),
  )
  res.status(201).json({ ok: true })
})

matchmakerRoutes.post('/requests/:id/proposals', (req, res) => {
  const request = requestById(req.params.id)
  if (!request) return fail(res, 404, 'Request not found.')
  if (['closed', 'matched'].includes(requestStatus(request))) return fail(res, 409, 'This request is no longer open.')
  const { picks, message } = req.body ?? {}
  if (!Array.isArray(picks) || picks.length === 0 || picks.length > 20) return fail(res, 400, 'Choose 1–20 people to propose.')
  const proposed = new Set(request.proposals.map((p) => p.candidateId))
  const clean = picks.map((pick: unknown) => {
    const { candidateId, note } = (pick ?? {}) as { candidateId?: unknown; note?: unknown }
    if (typeof candidateId !== 'string' || !profileRow(candidateId)) throw new BadRequest('A chosen member no longer exists.')
    if (candidateId === request.seekerId) throw new BadRequest('You can’t propose seekers to themselves.')
    if (proposed.has(candidateId)) throw new BadRequest('One of these people was already proposed.')
    proposed.add(candidateId)
    return { candidateId, note: optionalText(note, 'Note') ?? '' }
  })
  const text = optionalText(message, 'Message', 2000)
  const now = Date.now()
  transaction(() => {
    for (const pick of clean) {
      run(
        'INSERT INTO proposals (id, request_id, candidate_id, note, proposed_at) VALUES (?, ?, ?, ?, ?)',
        randomUUID(),
        request.id,
        pick.candidateId,
        pick.note,
        now,
      )
    }
    if (text) run('UPDATE requests SET notes = ? WHERE id = ?', JSON.stringify([...request.notes, { at: now, text }]), request.id)
    // Whoever sends matches on an unassigned request takes it on.
    if (!request.matchmakerId) {
      run('UPDATE requests SET matchmaker_id = ?, assigned_at = ? WHERE id = ?', currentUser(res)!.id, now, request.id)
    }
  })
  res.status(201).json({ ok: true })
})

matchmakerRoutes.post('/proposals/:id/interest', (req, res) => recordInterest(req, res, () => true))

matchmakerRoutes.post('/requests/:id/close', (req, res) => {
  const request = requestById(req.params.id)
  if (!request) return fail(res, 404, 'Request not found.')
  if (!request.closedAt) run('UPDATE requests SET closed_at = ? WHERE id = ?', Date.now(), request.id)
  res.json({ ok: true })
})

/* ---------- My profile ---------- */

matchmakerRoutes.put('/profile', (req, res) => {
  const me = currentUser(res)!
  const body = req.body ?? {}
  const displayName = optionalText(body.displayName, 'Name', 60)
  if (!displayName) return fail(res, 400, 'Enter the name seekers will see.')
  const bio = optionalText(body.bio, 'About you', 1000) ?? ''
  const specialties = textList(body.specialties, 'Specialties', 10, 60)
  const languages = textList(body.languages, 'Languages', 10, 40)

  let photoFile = matchmakerRow(me.id)?.photo_file ?? null
  if (typeof body.photo === 'string') {
    const saved = savePhoto(body.photo)
    deletePhoto(photoFile)
    photoFile = saved
  } else if (body.photo === null) {
    deletePhoto(photoFile)
    photoFile = null
  }

  run(
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
  res.json({ me: teamMember(me.id) })
})

/* ---------- Team & invitations ---------- */

matchmakerRoutes.post('/invites', (req, res) => {
  const me = currentUser(res)!
  const email = optionalText(req.body?.email, 'Email', 200)?.toLowerCase() ?? null
  if (email && !EMAIL.test(email)) return fail(res, 400, 'Enter a valid email address, or leave it empty.')
  if (email && get('SELECT 1 FROM users WHERE email = ?', email)) return fail(res, 409, 'Someone already has an account with that email.')

  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  run(
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
    const inviter = matchmakerRow(me.id)?.display_name ?? 'A MatchMe matchmaker'
    sendEmail(matchmakerInviteEmail(email, link, inviter)).catch((error) => console.error('Could not send invite email:', error))
  }
  // The link is shown once so it can also be shared directly; only its hash is stored.
  res.status(201).json({ link, emailed: !!email })
})

matchmakerRoutes.delete('/invites/:id', (req, res) => {
  run('DELETE FROM invites WHERE id = ? AND used_at IS NULL', req.params.id)
  res.json({ ok: true })
})

/** Approves a public matchmaker application: they can now see members and take on requests. */
matchmakerRoutes.post('/applications/:id/approve', (req, res) => {
  const applicant = matchmakerRow(req.params.id)
  if (!applicant || applicant.approved_at) return fail(res, 404, 'Application not found.')
  run('UPDATE matchmakers SET approved_at = ? WHERE user_id = ?', Date.now(), applicant.user_id)
  sendEmail(applicationDecisionEmail(applicant.email, applicant.display_name, true, `${APP_URL}/`)).catch((error) =>
    console.error('Could not send approval email:', error),
  )
  res.json({ ok: true })
})

/** Declines an application and removes the pending account. */
matchmakerRoutes.post('/applications/:id/decline', (req, res) => {
  const applicant = matchmakerRow(req.params.id)
  if (!applicant || applicant.approved_at) return fail(res, 404, 'Application not found.')
  deletePhoto(applicant.photo_file)
  run('DELETE FROM users WHERE id = ?', applicant.user_id)
  sendEmail(applicationDecisionEmail(applicant.email, applicant.display_name, false, `${APP_URL}/`)).catch((error) =>
    console.error('Could not send decline email:', error),
  )
  res.json({ ok: true })
})

/* ---------- Example photos ---------- */

matchmakerRoutes.put('/examples', (req, res) => {
  const { feature, option, photo } = req.body ?? {}
  if (typeof feature !== 'string' || typeof option !== 'string' || feature.length > 40 || option.length > 40) {
    return fail(res, 400, 'Feature and option are required.')
  }
  const key = `${feature}:${option}`
  const existing = get<{ photo_file: string }>('SELECT photo_file FROM examples WHERE key = ?', key)
  if (typeof photo === 'string') {
    const file = savePhoto(photo)
    run(
      `INSERT INTO examples (key, photo_file, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET photo_file = excluded.photo_file, updated_at = excluded.updated_at`,
      key,
      file,
      Date.now(),
    )
  } else if (photo === null) {
    run('DELETE FROM examples WHERE key = ?', key)
  } else {
    return fail(res, 400, 'Photo must be an image or null.')
  }
  deletePhoto(existing?.photo_file)
  res.json({ ok: true })
})
