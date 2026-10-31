import type {
  Application,
  CandidateResponse,
  InternalNote,
  Invite,
  MatchmakerProfile,
  MatchRequest,
  Profile,
  Proposal,
  ProposalResponse,
  TeamMember,
} from '../src/types.ts'
import type { User } from './auth.ts'
import { all, get } from './db.ts'

interface ProfileRow {
  id: string
  user_id: string | null
  data: string
  photo_file: string | null
  is_demo: number
  public_listing: number
  updated_at: number
}

interface RequestRow {
  id: string
  seeker_id: string
  created_at: number
  closed_at: number | null
  more_requested_at: number | null
  notes: string
  matchmaker_id: string | null
  assigned_at: number | null
}

interface ProposalRow {
  id: string
  request_id: string
  candidate_id: string
  note: string
  proposed_at: number
  response: ProposalResponse
  responded_at: number | null
  comment: string | null
  candidate_response: CandidateResponse | null
  candidate_responded_at: number | null
  candidate_comment: string | null
  paid_at: number | null
  payment_ref: string | null
}

const opt = <T>(value: T | null): T | undefined => (value === null ? undefined : value)

/* ---------- Profiles ---------- */

export function toProfile(row: ProfileRow): Profile {
  const data = JSON.parse(row.data) as Profile
  return {
    ...data,
    id: row.id,
    isDemo: row.is_demo === 1,
    publicListing: row.public_listing === 1,
    // Photos are served through an access-checked route, never as public files.
    photo: row.photo_file ? `/api/photos/${row.id}?v=${row.updated_at}` : undefined,
  }
}

export function profileRow(id: string): ProfileRow | undefined {
  return get<ProfileRow>('SELECT * FROM profiles WHERE id = ?', id)
}

export function profileRowForUser(userId: string): ProfileRow | undefined {
  return get<ProfileRow>('SELECT * FROM profiles WHERE user_id = ?', userId)
}

export function profilesById(ids: Iterable<string>): Profile[] {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []
  const rows = all<ProfileRow>(`SELECT * FROM profiles WHERE id IN (${unique.map(() => '?').join(',')})`, ...unique)
  return rows.map(toProfile)
}

export function allProfiles(): Profile[] {
  return all<ProfileRow>('SELECT * FROM profiles ORDER BY is_demo, updated_at').map(toProfile)
}

/** Limited card for the public Featured page: only what members agreed to show. */
export function publicCards() {
  return all<ProfileRow>('SELECT * FROM profiles WHERE public_listing = 1 ORDER BY updated_at DESC').map((row) => {
    const p = toProfile(row)
    return {
      id: p.id,
      name: p.name,
      age: p.age,
      gender: p.gender,
      city: p.city,
      profession: p.profession,
      jobTitle: p.jobTitle,
      bio: p.bio,
      photo: p.photo,
      isDemo: p.isDemo,
      publicListing: true,
      lookingFor: p.request.message,
      // Only what's needed to draw an illustrated portrait when there's no photo.
      portrait: {
        skinTone: p.physical.skinTone,
        hairColor: p.physical.hairColor,
        hairLength: p.physical.hairLength,
        eyeColor: p.physical.eyeColor,
        facialHair: p.physical.facialHair,
      },
    }
  })
}

/* ---------- Requests & proposals ---------- */

function toProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    note: row.note,
    proposedAt: row.proposed_at,
    response: row.response,
    respondedAt: opt(row.responded_at),
    comment: opt(row.comment),
    candidateResponse: opt(row.candidate_response),
    candidateRespondedAt: opt(row.candidate_responded_at),
    candidateComment: opt(row.candidate_comment),
    paidAt: opt(row.paid_at),
    paymentRef: opt(row.payment_ref),
  }
}

function assemble(rows: RequestRow[]): MatchRequest[] {
  if (rows.length === 0) return []
  const proposals = all<ProposalRow>(
    `SELECT * FROM proposals WHERE request_id IN (${rows.map(() => '?').join(',')}) ORDER BY proposed_at`,
    ...rows.map((r) => r.id),
  )
  return rows.map((r) => ({
    id: r.id,
    seekerId: r.seeker_id,
    createdAt: r.created_at,
    closedAt: opt(r.closed_at),
    moreRequestedAt: opt(r.more_requested_at),
    matchmakerId: opt(r.matchmaker_id),
    assignedAt: opt(r.assigned_at),
    notes: JSON.parse(r.notes) as MatchRequest['notes'],
    proposals: proposals.filter((p) => p.request_id === r.id).map(toProposal),
  }))
}

export function allRequests(): MatchRequest[] {
  return assemble(all<RequestRow>('SELECT * FROM requests ORDER BY created_at DESC'))
}

export function requestsForSeeker(seekerId: string): MatchRequest[] {
  return assemble(all<RequestRow>('SELECT * FROM requests WHERE seeker_id = ? ORDER BY created_at DESC', seekerId))
}

export function requestById(id: string): MatchRequest | undefined {
  return assemble(all<RequestRow>('SELECT * FROM requests WHERE id = ?', id))[0]
}

/** The request a proposal belongs to, plus the proposal itself. */
export function proposalContext(proposalId: string): { request: MatchRequest; proposal: Proposal } | undefined {
  const row = get<{ request_id: string }>('SELECT request_id FROM proposals WHERE id = ?', proposalId)
  const request = row && requestById(row.request_id)
  const proposal = request?.proposals.find((p) => p.id === proposalId)
  return request && proposal ? { request, proposal } : undefined
}

/**
 * Proposals where this member is the candidate and the seeker has already said yes —
 * the only point at which a candidate learns about (and can see) the seeker.
 */
export function incomingForCandidate(candidateId: string): MatchRequest[] {
  const rows = all<RequestRow>(
    `SELECT DISTINCT r.* FROM requests r JOIN proposals p ON p.request_id = r.id
     WHERE p.candidate_id = ? AND p.response = 'accepted' AND r.closed_at IS NULL`,
    candidateId,
  )
  // Strip every proposal except the ones about this candidate.
  return assemble(rows).map((r) => ({
    ...r,
    notes: [],
    proposals: r.proposals.filter((p) => p.candidateId === candidateId && p.response === 'accepted'),
  }))
}

/* ---------- Matchmakers ---------- */

interface MatchmakerRow {
  user_id: string
  email: string
  display_name: string
  bio: string
  specialties: string
  languages: string
  photo_file: string | null
  updated_at: number
  approved_at: number | null
  application: string | null
}

function toMatchmaker(row: MatchmakerRow): MatchmakerProfile {
  return {
    id: row.user_id,
    displayName: row.display_name,
    bio: row.bio,
    specialties: JSON.parse(row.specialties) as string[],
    languages: JSON.parse(row.languages) as string[],
    photo: row.photo_file ? `/api/matchmakers/${row.user_id}/photo?v=${row.updated_at}` : undefined,
  }
}

const MATCHMAKER_SELECT = 'SELECT m.*, u.email FROM matchmakers m JOIN users u ON u.id = m.user_id'

export function matchmakerRow(userId: string): MatchmakerRow | undefined {
  return get<MatchmakerRow>(`${MATCHMAKER_SELECT} WHERE m.user_id = ?`, userId)
}

/** An approved matchmaker (pending applicants don't count as part of the team). */
export function approvedMatchmakerRow(userId: string): MatchmakerRow | undefined {
  return get<MatchmakerRow>(`${MATCHMAKER_SELECT} WHERE m.user_id = ? AND m.approved_at IS NOT NULL`, userId)
}

/** Matchmaker applications waiting for a decision. */
export function pendingApplications(): Application[] {
  return all<MatchmakerRow & { created_at: number }>(
    `${MATCHMAKER_SELECT.replace('u.email', 'u.email, u.created_at')} WHERE m.approved_at IS NULL ORDER BY u.created_at`,
  ).map((row) => ({
    id: row.user_id,
    displayName: row.display_name,
    email: row.email,
    experience: (JSON.parse(row.application ?? '{}') as { experience?: string }).experience ?? row.bio,
    languages: JSON.parse(row.languages) as string[],
    appliedAt: row.created_at,
  }))
}

export function matchmakerProfile(userId: string): MatchmakerProfile | undefined {
  const row = matchmakerRow(userId)
  return row && toMatchmaker(row)
}

export function teamMember(userId: string): TeamMember | undefined {
  const row = matchmakerRow(userId)
  return row && { ...toMatchmaker(row), email: row.email }
}

export function team(): TeamMember[] {
  return all<MatchmakerRow>(
    `${MATCHMAKER_SELECT} WHERE m.approved_at IS NOT NULL ORDER BY m.display_name COLLATE NOCASE`,
  ).map((row) => ({
    ...toMatchmaker(row),
    email: row.email,
  }))
}

/** Seekers see who is looking after each of their requests (public matchmaker profile only). */
export function withMatchmakers(requests: MatchRequest[]): MatchRequest[] {
  return requests.map((r) => ({ ...r, matchmaker: r.matchmakerId ? matchmakerProfile(r.matchmakerId) : undefined }))
}

/** Matchmakers see the private notes kept on each request. */
export function withInternalNotes(requests: MatchRequest[]): MatchRequest[] {
  const rows = all<{ id: string; request_id: string; author_id: string | null; text: string; created_at: number }>(
    'SELECT * FROM request_notes ORDER BY created_at',
  )
  return requests.map((r) => ({
    ...r,
    internalNotes: rows
      .filter((n) => n.request_id === r.id)
      .map((n): InternalNote => ({ id: n.id, authorId: opt(n.author_id), text: n.text, at: n.created_at })),
  }))
}

export function pendingInvites(): Invite[] {
  return all<{ id: string; email: string | null; created_by: string | null; created_at: number; expires_at: number }>(
    'SELECT * FROM invites WHERE used_at IS NULL AND expires_at > ? ORDER BY created_at DESC',
    Date.now(),
  ).map((row) => ({
    id: row.id,
    email: opt(row.email),
    createdBy: opt(row.created_by),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }))
}

/* ---------- Access control ---------- */

/**
 * Who may see a member's profile and photo: the member, the matchmaker, seekers the
 * member was proposed to, candidates who were accepted by the member — or anyone, if
 * the member opted in to a public listing.
 */
export function canViewProfile(viewer: User | undefined, profileId: string): boolean {
  const row = profileRow(profileId)
  if (!row) return false
  if (row.public_listing === 1) return true
  if (!viewer) return false
  // Approved matchmakers see everyone; applicants still under review see nobody.
  if (viewer.role === 'matchmaker') return viewer.status === 'active'
  const mine = profileRowForUser(viewer.id)
  if (!mine) return false
  if (mine.id === profileId) return true
  return !!get(
    `SELECT 1 FROM proposals p JOIN requests r ON r.id = p.request_id
     WHERE (r.seeker_id = ? AND p.candidate_id = ?)
        OR (p.candidate_id = ? AND r.seeker_id = ? AND p.response = 'accepted')
     LIMIT 1`,
    mine.id,
    profileId,
    mine.id,
    profileId,
  )
}
