import { randomUUID } from 'node:crypto'
import express, { type Response } from 'express'
import { latestRequestFor, proposalState, requestStatus } from '../../src/lib/requests.ts'
import type { MatchRequest, Profile } from '../../src/types.ts'
import { currentUser, endSession, requireRole } from '../auth.ts'
import {
  galleryRows,
  galleryUrl,
  type GalleryRow,
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
import { BadRequest, deleteUnusedPhotos, savePhoto } from '../photos.ts'
import { deleteAccount } from '../accounts.ts'
import { validateProfile } from '../validate.ts'

/** Everything a signed-in seeker can do. */
export const seekerRoutes = express.Router()
seekerRoutes.use(requireRole('seeker'))

/**
 * Other members as a seeker sees them: profile details, but only the message from their own request,
 * and never their contact details — the matchmaker shares those once a match is paid for.
 */
function asMember({ contact: _contact, ...p }: Profile): Profile {
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

/** How many photos a member may have. */
const MAX_PHOTOS = 6

/**
 * Works out a member's photos from the list the form sent, in order: a URL keeps one of their
 * current photos, a data URL is a new upload. Returns the new list, the files no longer used and
 * the files just uploaded (to remove again if saving fails).
 */
async function syncPhotos(
  profileId: string,
  sent: unknown,
): Promise<{ kept: GalleryRow[]; removed: string[]; uploaded: string[] }> {
  if (!Array.isArray(sent)) throw new BadRequest('Photos are invalid.')
  if (sent.length > MAX_PHOTOS) throw new BadRequest(`You can add up to ${MAX_PHOTOS} photos.`)
  const current = new Map((await galleryRows(profileId)).map((g) => [galleryUrl(profileId, g.id), g]))
  const kept: GalleryRow[] = []
  const uploaded: string[] = []
  try {
    for (const item of sent) {
      if (typeof item !== 'string') throw new BadRequest('Photos are invalid.')
      const existing = current.get(item.split('?')[0])
      if (existing) {
        if (!kept.includes(existing)) kept.push(existing)
      } else if (item.startsWith('data:')) {
        const file = await savePhoto(item)
        uploaded.push(file)
        kept.push({ id: randomUUID(), file })
      } else {
        throw new BadRequest('One of your photos no longer exists. Reload the page and try again.')
      }
    }
  } catch (error) {
    // Don't leave half an upload behind.
    await deleteUnusedPhotos(uploaded)
    throw error
  }
  const keptFiles = new Set(kept.map((g) => g.file))
  return { kept, uploaded, removed: [...current.values()].map((g) => g.file).filter((f) => !keptFiles.has(f)) }
}

/** The signed-in seeker's profile id, or a 409 telling them to create one first. */
async function myProfileId(res: Response): Promise<string | undefined> {
  const row = await profileRowForUser(currentUser(res, 'seeker')!.id)
  if (!row) fail(res, 409, 'Create your profile first.')
  return row?.id
}

async function myRequest(res: Response, requestId: string): Promise<MatchRequest | undefined> {
  const mine = await myProfileId(res)
  if (!mine) return undefined
  const request = await requestById(requestId)
  if (!request || request.seekerId !== mine) {
    fail(res, 404, 'Request not found.')
    return undefined
  }
  return request
}

seekerRoutes.get('/state', async (_req, res) => {
  const row = await profileRowForUser(currentUser(res, 'seeker')!.id)
  if (!row) return res.json({ profile: null, requests: [], incoming: [], members: [] })
  const requests = await withMatchmakers(await requestsForSeeker(row.id))
  const incoming = await incomingForCandidate(row.id)
  const memberIds = [...requests.flatMap((r) => r.proposals.map((p) => p.candidateId)), ...incoming.map((r) => r.seekerId)]
  res.json({
    profile: await toProfile(row),
    requests,
    incoming,
    members: (await profilesById(memberIds)).map(asMember),
  })
})

seekerRoutes.put('/profile', async (req, res) => {
  const user = currentUser(res, 'seeker')!
  const body = req.body ?? {}
  const clean = validateProfile(body.profile)
  const existing = await profileRowForUser(user.id)
  const id = existing?.id ?? randomUUID()

  // Leaving photos out keeps them as they are.
  const photos = body.photos === undefined ? undefined : await syncPhotos(id, body.photos)
  const photoFile = photos ? (photos.kept[0]?.file ?? null) : (existing?.photo_file ?? null)
  const now = Date.now()

  try {
    await transaction(async (tx) => {
      // The profile id was chosen before the transaction; if another save created the profile
      // in the meantime, stop rather than make a second one.
      const owner = await profileRowForUser(user.id, tx)
      if (owner && owner.id !== id) throw new BadRequest('Your profile was just saved in another tab. Reload the page and try again.')
      await tx.run(
        `INSERT INTO profiles (id, user_id, data, photo_file, is_demo, public_listing, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, photo_file = excluded.photo_file,
           public_listing = excluded.public_listing, updated_at = excluded.updated_at`,
        id,
        user.id,
        JSON.stringify({ ...clean, id }),
        photoFile,
        body.publicListing === true ? 1 : 0,
        now,
      )
      if (!photos) return
      await tx.run('DELETE FROM profile_photos WHERE profile_id = ?', id)
      for (const [position, g] of photos.kept.entries()) {
        await tx.run(
          'INSERT INTO profile_photos (id, profile_id, file, position, created_at) VALUES (?, ?, ?, ?, ?)',
          g.id,
          id,
          g.file,
          position,
          now,
        )
      }
    })
  } catch (error) {
    // Nothing was saved, so the photos uploaded for this save aren't needed.
    await deleteUnusedPhotos(photos?.uploaded ?? [])
    throw error
  }
  // Removed photos go only once nothing points at them (another save may still use one).
  await deleteUnusedPhotos(photos?.removed ?? [])
  res.json({ profile: await toProfile((await profileRow(id))!) })
})

seekerRoutes.delete('/account', async (req, res) => {
  const user = currentUser(res, 'seeker')!
  await deleteAccount(user.id)
  await endSession(req, res, 'seeker')
  res.json({ ok: true })
})

/** Opens a new request. A seeker may have several open at once; they all use the profile's preferences. */
seekerRoutes.post('/requests', async (_req, res) => {
  const mine = await myProfileId(res)
  if (!mine) return
  await run('INSERT INTO requests (id, seeker_id, created_at) VALUES (?, ?, ?)', randomUUID(), mine, Date.now())
  res.status(201).json({ ok: true })
})

/**
 * Asks to be matched with a featured member: added to the newest open request that isn't matched
 * yet, or a new request is opened.
 */
seekerRoutes.post('/featured/:id/request', async (req, res) => {
  const mine = await myProfileId(res)
  if (!mine) return
  const candidate = await profileRow(req.params.id)
  if (!candidate || candidate.public_listing !== 1) return fail(res, 404, 'This member is no longer featured.')
  if (candidate.id === mine) return fail(res, 400, 'You can’t request a match with yourself.')
  const them = await toProfile(candidate)
  const { seeking } = (await toProfile((await profileRow(mine))!)).request
  if (seeking.length > 0 && !seeking.includes(them.gender)) {
    return fail(res, 400, `${them.name} isn’t someone you’re looking for. Update the gender in your preferences to request them.`)
  }

  // Which request to add them to is decided inside the transaction, so two clicks at once can't
  // open two new requests.
  const now = Date.now()
  const outcome = await transaction(async (tx) => {
    const open = (await requestsForSeeker(mine, tx)).filter((r) => requestStatus(r) !== 'closed')
    if (open.some((r) => r.proposals.some((p) => p.candidateId === candidate.id))) return 'already-proposed' as const
    // Already asked for on one of the open requests: nothing more to do.
    if (open.some((r) => (r.requestedMembers ?? []).some((a) => a.candidateId === candidate.id))) return 'ok' as const
    const target = latestRequestFor(
      open.filter((r) => requestStatus(r) !== 'matched'),
      mine,
    )
    let requestId = target?.id
    if (!requestId) {
      requestId = randomUUID()
      await tx.run('INSERT INTO requests (id, seeker_id, created_at) VALUES (?, ?, ?)', requestId, mine, now)
    }
    await tx.run(
      'INSERT OR IGNORE INTO requested_members (request_id, candidate_id, created_at) VALUES (?, ?, ?)',
      requestId,
      candidate.id,
      now,
    )
    return 'ok' as const
  })
  if (outcome === 'already-proposed') return fail(res, 409, 'Your matchmaker has already proposed this person to you.')
  res.status(201).json({ ok: true })
})

seekerRoutes.post('/requests/:id/more', async (req, res) => {
  const request = await myRequest(res, req.params.id)
  if (!request) return
  if (requestStatus(request) !== 'responded') return fail(res, 409, 'You can ask for more once every proposal is answered.')
  await run('UPDATE requests SET more_requested_at = ? WHERE id = ? AND closed_at IS NULL', Date.now(), request.id)
  res.json({ ok: true })
})

seekerRoutes.post('/requests/:id/close', async (req, res) => {
  const request = await myRequest(res, req.params.id)
  if (!request) return
  await run('UPDATE requests SET closed_at = ? WHERE id = ? AND closed_at IS NULL', Date.now(), request.id)
  res.json({ ok: true })
})

seekerRoutes.post('/proposals/:id/respond', async (req, res) => {
  const mine = await myProfileId(res)
  if (!mine) return
  const ctx = await proposalContext(req.params.id)
  if (!ctx || ctx.request.seekerId !== mine) return fail(res, 404, 'Proposal not found.')
  const answered = () => fail(res, 409, 'You’ve already answered this.')
  if (ctx.request.closedAt || proposalState(ctx.proposal) !== 'pending') return answered()
  const { response } = req.body ?? {}
  if (response !== 'accepted' && response !== 'declined') return fail(res, 400, 'Answer must be accepted or declined.')
  // Only applies while the proposal is still unanswered, so a double click records one answer.
  const { changes } = await run(
    `UPDATE proposals SET response = ?, responded_at = ?, comment = ?, candidate_response = ?
     WHERE id = ? AND response = 'pending' AND request_id IN (SELECT id FROM requests WHERE closed_at IS NULL)`,
    response,
    Date.now(),
    optionalText(req.body.comment, 'Comment'),
    // Accepting asks the candidate next; nothing is charged yet.
    response === 'accepted' ? 'pending' : null,
    ctx.proposal.id,
  )
  if (changes !== 1) return answered()
  res.json({ ok: true })
})

seekerRoutes.post('/proposals/:id/interest', async (req, res) => {
  const mine = await myProfileId(res)
  if (mine) await recordInterest(req, res, (candidateId) => candidateId === mine)
})

/** PLACEHOLDER payment: records a test reference. Replace with a real provider (verify server-side). */
seekerRoutes.post('/proposals/:id/pay', async (req, res) => {
  const mine = await myProfileId(res)
  if (!mine) return
  const ctx = await proposalContext(req.params.id)
  if (!ctx || ctx.request.seekerId !== mine) return fail(res, 404, 'Proposal not found.')
  const notDue = () => fail(res, 409, 'Payment is only due once a match is mutual.')
  if (proposalState(ctx.proposal) !== 'mutual') return notDue()
  const paymentRef = `TEST-${randomUUID().slice(0, 8).toUpperCase()}`
  // Only one payment is ever recorded for a proposal, even if "Pay" is pressed twice.
  const { changes } = await run(
    `UPDATE proposals SET paid_at = ?, payment_ref = ?
     WHERE id = ? AND response = 'accepted' AND candidate_response = 'interested' AND paid_at IS NULL`,
    Date.now(),
    paymentRef,
    ctx.proposal.id,
  )
  if (changes !== 1) return notDue()
  res.json({ paymentRef })
})
