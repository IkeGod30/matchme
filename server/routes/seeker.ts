import { randomUUID } from 'node:crypto'
import express, { type Response } from 'express'
import { latestRequestFor, proposalState, requestStatus } from '../../src/lib/requests.ts'
import type { MatchRequest, Profile } from '../../src/types.ts'
import { currentUser, endSession, requireRole } from '../auth.ts'
import {
  incomingForCandidate,
  profileRow,
  profileRowForUser,
  profilesById,
  proposalContext,
  requestById,
  requestsForSeeker,
  toProfile,
  withMatchmakers,
} from '../data.ts'
import { run, transaction } from '../db.ts'
import { fail, optionalText, recordInterest } from '../http.ts'
import { deletePhoto, savePhoto } from '../photos.ts'
import { validateProfile } from '../validate.ts'

/** Everything a signed-in seeker can do. */
export const seekerRoutes = express.Router()
seekerRoutes.use(requireRole('seeker'))

/** Other members as a seeker sees them: profile details, but only the message from their own request. */
function asMember(p: Profile): Profile {
  return {
    ...p,
    request: {
      message: p.request.message,
      seeking: [],
      ageMin: 18,
      ageMax: 99,
      locations: [],
      races: [],
      nationalities: [],
      professions: [],
      relationshipStatuses: [],
      physical: {} as Profile['request']['physical'],
    },
  }
}

/** The signed-in seeker's profile id, or a 409 telling them to create one first. */
function myProfileId(res: Response): string | undefined {
  const row = profileRowForUser(currentUser(res)!.id)
  if (!row) fail(res, 409, 'Create your profile first.')
  return row?.id
}

function myRequest(res: Response, requestId: string): MatchRequest | undefined {
  const mine = myProfileId(res)
  if (!mine) return undefined
  const request = requestById(requestId)
  if (!request || request.seekerId !== mine) {
    fail(res, 404, 'Request not found.')
    return undefined
  }
  return request
}

seekerRoutes.get('/state', (_req, res) => {
  const row = profileRowForUser(currentUser(res)!.id)
  if (!row) return res.json({ profile: null, requests: [], incoming: [], members: [] })
  const requests = withMatchmakers(requestsForSeeker(row.id))
  const incoming = incomingForCandidate(row.id)
  const memberIds = [...requests.flatMap((r) => r.proposals.map((p) => p.candidateId)), ...incoming.map((r) => r.seekerId)]
  res.json({ profile: toProfile(row), requests, incoming, members: profilesById(memberIds).map(asMember) })
})

seekerRoutes.put('/profile', (req, res) => {
  const user = currentUser(res)!
  const body = req.body ?? {}
  const clean = validateProfile(body.profile)
  const existing = profileRowForUser(user.id)
  const id = existing?.id ?? randomUUID()

  let photoFile = existing?.photo_file ?? null
  if (typeof body.photo === 'string') {
    const saved = savePhoto(body.photo)
    deletePhoto(photoFile)
    photoFile = saved
  } else if (body.photo === null) {
    deletePhoto(photoFile)
    photoFile = null
  }

  run(
    `INSERT INTO profiles (id, user_id, data, photo_file, is_demo, public_listing, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, photo_file = excluded.photo_file,
       public_listing = excluded.public_listing, updated_at = excluded.updated_at`,
    id,
    user.id,
    JSON.stringify({ ...clean, id }),
    photoFile,
    body.publicListing === true ? 1 : 0,
    Date.now(),
  )
  res.json({ profile: toProfile(profileRow(id)!) })
})

seekerRoutes.delete('/account', (req, res) => {
  const user = currentUser(res)!
  deletePhoto(profileRowForUser(user.id)?.photo_file)
  // Cascades to the profile, its requests and proposals, and sessions.
  run('DELETE FROM users WHERE id = ?', user.id)
  endSession(req, res)
  res.json({ ok: true })
})

seekerRoutes.post('/requests', (_req, res) => {
  const mine = myProfileId(res)
  if (!mine) return
  const latest = latestRequestFor(requestsForSeeker(mine), mine)
  if (latest && requestStatus(latest) !== 'closed') return fail(res, 409, 'You already have an open request.')
  run('INSERT INTO requests (id, seeker_id, created_at) VALUES (?, ?, ?)', randomUUID(), mine, Date.now())
  res.status(201).json({ ok: true })
})

/** Asks to be matched with a featured member: added to the open request, or a new one is opened. */
seekerRoutes.post('/featured/:id/request', (req, res) => {
  const mine = myProfileId(res)
  if (!mine) return
  const candidate = profileRow(req.params.id)
  if (!candidate || candidate.public_listing !== 1) return fail(res, 404, 'This member is no longer featured.')
  if (candidate.id === mine) return fail(res, 400, 'You can’t request a match with yourself.')

  const latest = latestRequestFor(requestsForSeeker(mine), mine)
  const status = latest && requestStatus(latest)
  if (status === 'matched') {
    return fail(res, 409, 'You’re already matched on your current request. Close it first to request someone new.')
  }
  if (latest && status !== 'closed' && latest.proposals.some((p) => p.candidateId === candidate.id)) {
    return fail(res, 409, 'Your matchmaker has already proposed this person to you.')
  }

  const now = Date.now()
  transaction(() => {
    let requestId = latest && status !== 'closed' ? latest.id : undefined
    if (!requestId) {
      requestId = randomUUID()
      run('INSERT INTO requests (id, seeker_id, created_at) VALUES (?, ?, ?)', requestId, mine, now)
    }
    run(
      'INSERT OR IGNORE INTO requested_members (request_id, candidate_id, created_at) VALUES (?, ?, ?)',
      requestId,
      candidate.id,
      now,
    )
  })
  res.status(201).json({ ok: true })
})

seekerRoutes.post('/requests/:id/more', (req, res) => {
  const request = myRequest(res, req.params.id)
  if (!request) return
  if (requestStatus(request) !== 'responded') return fail(res, 409, 'You can ask for more once every proposal is answered.')
  run('UPDATE requests SET more_requested_at = ? WHERE id = ?', Date.now(), request.id)
  res.json({ ok: true })
})

seekerRoutes.post('/requests/:id/close', (req, res) => {
  const request = myRequest(res, req.params.id)
  if (!request) return
  if (!request.closedAt) run('UPDATE requests SET closed_at = ? WHERE id = ?', Date.now(), request.id)
  res.json({ ok: true })
})

seekerRoutes.post('/proposals/:id/respond', (req, res) => {
  const mine = myProfileId(res)
  if (!mine) return
  const ctx = proposalContext(req.params.id)
  if (!ctx || ctx.request.seekerId !== mine) return fail(res, 404, 'Proposal not found.')
  if (ctx.request.closedAt || proposalState(ctx.proposal) !== 'pending') return fail(res, 409, 'You’ve already answered this.')
  const { response } = req.body ?? {}
  if (response !== 'accepted' && response !== 'declined') return fail(res, 400, 'Answer must be accepted or declined.')
  run(
    `UPDATE proposals SET response = ?, responded_at = ?, comment = ?, candidate_response = ? WHERE id = ?`,
    response,
    Date.now(),
    optionalText(req.body.comment, 'Comment'),
    // Accepting asks the candidate next; nothing is charged yet.
    response === 'accepted' ? 'pending' : null,
    ctx.proposal.id,
  )
  res.json({ ok: true })
})

seekerRoutes.post('/proposals/:id/interest', (req, res) => {
  const mine = myProfileId(res)
  if (mine) recordInterest(req, res, (candidateId) => candidateId === mine)
})

/** PLACEHOLDER payment: records a test reference. Replace with a real provider (verify server-side). */
seekerRoutes.post('/proposals/:id/pay', (req, res) => {
  const mine = myProfileId(res)
  if (!mine) return
  const ctx = proposalContext(req.params.id)
  if (!ctx || ctx.request.seekerId !== mine) return fail(res, 404, 'Proposal not found.')
  if (proposalState(ctx.proposal) !== 'mutual') return fail(res, 409, 'Payment is only due once a match is mutual.')
  const paymentRef = `TEST-${randomUUID().slice(0, 8).toUpperCase()}`
  run('UPDATE proposals SET paid_at = ?, payment_ref = ? WHERE id = ?', Date.now(), paymentRef, ctx.proposal.id)
  res.json({ paymentRef })
})
