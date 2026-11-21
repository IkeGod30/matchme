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
  AccountSummary,
} from '../src/types.ts'
import type { User } from './auth.ts'
import { db, placeholders, type Queries } from './db.ts'

// Reads used by the routes. Functions that a route also calls inside a transaction take an
// optional `q` (the transaction's helpers); otherwise they use the database directly.

const { all, get } = db

export interface ProfileRow {
  id: string
  user_id: string | null
  data: string
  photo_file: string | null
  is_demo: number
  public_listing: number
  updated_at: number
}

export interface GalleryRow {
  id: string
  file: string
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

/** A member's photos in display order; the first is their main photo. */
export function galleryRows(profileId: string, q: Queries = db): Promise<GalleryRow[]> {
  return q.all<GalleryRow>('SELECT id, file FROM profile_photos WHERE profile_id = ? ORDER BY position', profileId)
}

/** Where one of a member's photos is served. Each photo id is a new file, so the URL never changes. */
export const galleryUrl = (profileId: string, photoId: string) => `/api/photos/${profileId}/${photoId}`

function buildProfile(row: ProfileRow, gallery: GalleryRow[]): Profile {
  const data = JSON.parse(row.data) as Profile
  // Photos are served through access-checked routes, never as public files.
  const photo = row.photo_file ? `/api/photos/${row.id}?v=${row.updated_at}` : undefined
  const urls = gallery.map((g) => galleryUrl(row.id, g.id))
  return {
    ...data,
    id: row.id,
    isDemo: row.is_demo === 1,
    publicListing: row.public_listing === 1,
    photo,
    photos: urls.length ? urls : photo ? [photo] : [],
  }
}

/** Profiles for many rows, with every gallery fetched in one query. */
export async function toProfiles<R extends ProfileRow>(rows: R[]): Promise<(Profile & { row: R })[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const photos = await all<GalleryRow & { profile_id: string }>(
    `SELECT id, file, profile_id FROM profile_photos WHERE profile_id IN (${placeholders(ids)}) ORDER BY position`,
    ...ids,
  )
  const byProfile = new Map<string, GalleryRow[]>()
  for (const p of photos) byProfile.set(p.profile_id, [...(byProfile.get(p.profile_id) ?? []), { id: p.id, file: p.file }])
  return rows.map((row) => ({ ...buildProfile(row, byProfile.get(row.id) ?? []), row }))
}

/** One profile as the client sees it. */
export async function toProfile(row: ProfileRow): Promise<Profile> {
  return buildProfile(row, await galleryRows(row.id))
}

export function profileRow(id: string, q: Queries = db): Promise<ProfileRow | undefined> {
  return q.get<ProfileRow>('SELECT * FROM profiles WHERE id = ?', id)
}

export function profileRowForUser(userId: string, q: Queries = db): Promise<ProfileRow | undefined> {
  return q.get<ProfileRow>('SELECT * FROM profiles WHERE user_id = ?', userId)
}

const withoutRow = ({ row: _row, ...profile }: Profile & { row: unknown }): Profile => profile

export async function profilesById(ids: Iterable<string>): Promise<Profile[]> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []
  const rows = await all<ProfileRow>(`SELECT * FROM profiles WHERE id IN (${placeholders(unique)})`, ...unique)
  return (await toProfiles(rows)).map(withoutRow)
}

/** Every member, for matchmakers. Members a super user suspended are marked so they aren't proposed. */
export async function allProfiles(): Promise<Profile[]> {
  const rows = await all<ProfileRow & { suspended_at: number | null }>(
    `SELECT p.*, u.suspended_at FROM profiles p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.is_demo, p.updated_at`,
  )
  return (await toProfiles(rows)).map((p) => ({ ...withoutRow(p), ...(p.row.suspended_at !== null && { suspended: true }) }))
}

/** Limited card for the public Featured page: only what members agreed to show. */
export async function publicCards() {
  // Suspended members are taken off the Featured page (sample members have no account).
  const rows = await all<ProfileRow>(
    `SELECT p.* FROM profiles p LEFT JOIN users u ON u.id = p.user_id
     WHERE p.public_listing = 1 AND u.suspended_at IS NULL ORDER BY p.updated_at DESC`,
  )
  return (await toProfiles(rows)).map((p) => ({
    id: p.id,
    name: p.name,
    // Age is private: never on public cards.
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
  }))
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

async function assemble(rows: RequestRow[], q: Queries = db): Promise<MatchRequest[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const proposals = await q.all<ProposalRow>(
    `SELECT * FROM proposals WHERE request_id IN (${placeholders(ids)}) ORDER BY proposed_at`,
    ...ids,
  )
  const asked = await q.all<{ request_id: string; candidate_id: string; created_at: number }>(
    `SELECT * FROM requested_members WHERE request_id IN (${placeholders(ids)}) ORDER BY created_at`,
    ...ids,
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
    requestedMembers: asked
      .filter((a) => a.request_id === r.id)
      .map((a) => ({ candidateId: a.candidate_id, at: a.created_at })),
  }))
}

export async function allRequests(): Promise<MatchRequest[]> {
  return assemble(await all<RequestRow>('SELECT * FROM requests ORDER BY created_at DESC'))
}

export async function requestsForSeeker(seekerId: string, q: Queries = db): Promise<MatchRequest[]> {
  return assemble(await q.all<RequestRow>('SELECT * FROM requests WHERE seeker_id = ? ORDER BY created_at DESC', seekerId), q)
}

export async function requestById(id: string, q: Queries = db): Promise<MatchRequest | undefined> {
  return (await assemble(await q.all<RequestRow>('SELECT * FROM requests WHERE id = ?', id), q))[0]
}

/** The request a proposal belongs to, plus the proposal itself. */
export async function proposalContext(proposalId: string): Promise<{ request: MatchRequest; proposal: Proposal } | undefined> {
  const row = await get<{ request_id: string }>('SELECT request_id FROM proposals WHERE id = ?', proposalId)
  const request = row && (await requestById(row.request_id))
  const proposal = request?.proposals.find((p) => p.id === proposalId)
  return request && proposal ? { request, proposal } : undefined
}

/**
 * Proposals where this member is the candidate and the seeker has already said yes —
 * the only point at which a candidate learns about (and can see) the seeker.
 */
export async function incomingForCandidate(candidateId: string): Promise<MatchRequest[]> {
  const rows = await all<RequestRow>(
    `SELECT DISTINCT r.* FROM requests r JOIN proposals p ON p.request_id = r.id
     WHERE p.candidate_id = ? AND p.response = 'accepted' AND r.closed_at IS NULL`,
    candidateId,
  )
  // Strip every proposal except the ones about this candidate.
  return (await assemble(rows)).map((r) => ({
    ...r,
    notes: [],
    requestedMembers: [],
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

export function matchmakerRow(userId: string): Promise<MatchmakerRow | undefined> {
  return get<MatchmakerRow>(`${MATCHMAKER_SELECT} WHERE m.user_id = ?`, userId)
}

/** An approved matchmaker (pending applicants don't count as part of the team). */
export function approvedMatchmakerRow(userId: string): Promise<MatchmakerRow | undefined> {
  return get<MatchmakerRow>(`${MATCHMAKER_SELECT} WHERE m.user_id = ? AND m.approved_at IS NOT NULL`, userId)
}

/** Matchmaker applications waiting for a decision. */
export async function pendingApplications(): Promise<Application[]> {
  const rows = await all<MatchmakerRow & { created_at: number }>(
    `${MATCHMAKER_SELECT.replace('u.email', 'u.email, u.created_at')} WHERE m.approved_at IS NULL ORDER BY u.created_at`,
  )
  return rows.map((row) => ({
    id: row.user_id,
    displayName: row.display_name,
    email: row.email,
    experience: (JSON.parse(row.application ?? '{}') as { experience?: string }).experience ?? row.bio,
    languages: JSON.parse(row.languages) as string[],
    appliedAt: row.created_at,
  }))
}

export async function matchmakerProfile(userId: string): Promise<MatchmakerProfile | undefined> {
  const row = await matchmakerRow(userId)
  return row && toMatchmaker(row)
}

export async function teamMember(userId: string): Promise<TeamMember | undefined> {
  const row = await matchmakerRow(userId)
  return row && { ...toMatchmaker(row), email: row.email }
}

export async function team(): Promise<TeamMember[]> {
  const rows = await all<MatchmakerRow>(
    `${MATCHMAKER_SELECT} WHERE m.approved_at IS NOT NULL ORDER BY m.display_name COLLATE NOCASE`,
  )
  return rows.map((row) => ({ ...toMatchmaker(row), email: row.email }))
}

/** Seekers see who is looking after each of their requests (public matchmaker profile only). */
export async function withMatchmakers(requests: MatchRequest[]): Promise<MatchRequest[]> {
  const ids = [...new Set(requests.map((r) => r.matchmakerId).filter((id): id is string => !!id))]
  const profiles = new Map<string, MatchmakerProfile>()
  if (ids.length > 0) {
    const rows = await all<MatchmakerRow>(`${MATCHMAKER_SELECT} WHERE m.user_id IN (${placeholders(ids)})`, ...ids)
    for (const row of rows) profiles.set(row.user_id, toMatchmaker(row))
  }
  return requests.map((r) => ({ ...r, matchmaker: r.matchmakerId ? profiles.get(r.matchmakerId) : undefined }))
}

/** Matchmakers see the private notes kept on each request. */
export async function withInternalNotes(requests: MatchRequest[]): Promise<MatchRequest[]> {
  const rows = await all<{ id: string; request_id: string; author_id: string | null; text: string; created_at: number }>(
    'SELECT * FROM request_notes ORDER BY created_at',
  )
  return requests.map((r) => ({
    ...r,
    internalNotes: rows
      .filter((n) => n.request_id === r.id)
      .map((n): InternalNote => ({ id: n.id, authorId: opt(n.author_id), text: n.text, at: n.created_at })),
  }))
}

export async function pendingInvites(): Promise<Invite[]> {
  const rows = await all<{ id: string; email: string | null; created_by: string | null; created_at: number; expires_at: number }>(
    'SELECT * FROM invites WHERE used_at IS NULL AND expires_at > ? ORDER BY created_at DESC',
    Date.now(),
  )
  return rows.map((row) => ({
    id: row.id,
    email: opt(row.email),
    createdBy: opt(row.created_by),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }))
}

/* ---------- Accounts (super users) ---------- */

interface AccountRow {
  id: string
  email: string
  created_at: number
  suspended_at: number | null
}

const summary = (row: AccountRow): AccountSummary => ({
  id: row.id,
  email: row.email,
  createdAt: row.created_at,
  suspendedAt: opt(row.suspended_at),
})

export async function seekerAccounts(): Promise<AccountSummary[]> {
  const rows = await all<AccountRow & { profile_id: string | null; data: string | null; open_requests: number }>(
    `SELECT u.id, u.email, u.created_at, u.suspended_at, p.id AS profile_id, p.data,
       (SELECT COUNT(*) FROM requests r WHERE r.seeker_id = p.id AND r.closed_at IS NULL) AS open_requests
     FROM users u LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.role = 'seeker' ORDER BY u.created_at DESC`,
  )
  return rows.map((row) => {
    const profile = row.data ? (JSON.parse(row.data) as Profile) : undefined
    return {
      ...summary(row),
      name: profile?.name,
      location: profile && [profile.city, profile.country].filter(Boolean).join(', '),
      profileId: opt(row.profile_id),
      openRequests: row.open_requests,
    }
  })
}

/** Approved matchmakers; applicants are listed separately (pendingApplications). */
export async function matchmakerAccounts(): Promise<AccountSummary[]> {
  const rows = await all<AccountRow & { display_name: string; is_super_user: number }>(
    `SELECT u.id, u.email, u.created_at, u.suspended_at, m.display_name,
       EXISTS (SELECT 1 FROM users a WHERE a.role = 'admin' AND (a.promoted_from = u.id OR a.email = u.email))
         AS is_super_user
     FROM users u JOIN matchmakers m ON m.user_id = u.id
     WHERE u.role = 'matchmaker' AND m.approved_at IS NOT NULL ORDER BY m.display_name COLLATE NOCASE`,
  )
  return rows.map((row) => ({ ...summary(row), name: row.display_name, isSuperUser: row.is_super_user === 1 }))
}

export async function adminAccounts(): Promise<AccountSummary[]> {
  const rows = await all<AccountRow & { promoted_from: string | null }>(
    `SELECT id, email, created_at, suspended_at, promoted_from FROM users WHERE role = 'admin' ORDER BY created_at`,
  )
  return rows.map((row) => ({ ...summary(row), promotedFrom: opt(row.promoted_from) }))
}

/* ---------- Access control ---------- */

/**
 * Who may see a member's profile and photo: the member, the matchmaker, seekers the
 * member was proposed to, candidates who were accepted by the member — or anyone, if
 * the member opted in to a public listing. A public listing shows only the main photo, so
 * the rest of a member's photos are checked with `publicListingCounts: false`.
 */
export async function canViewProfile(
  viewer: User | undefined,
  profileId: string,
  { publicListingCounts = true } = {},
): Promise<boolean> {
  const row = await profileRow(profileId)
  if (!row) return false
  if (publicListingCounts && row.public_listing === 1) return true
  if (!viewer) return false
  // Super users and approved matchmakers see everyone; applicants still under review see nobody.
  if (viewer.role === 'admin') return true
  if (viewer.role === 'matchmaker') return viewer.status === 'active'
  const mine = await profileRowForUser(viewer.id)
  if (!mine) return false
  if (mine.id === profileId) return true
  return !!(await get(
    `SELECT 1 FROM proposals p JOIN requests r ON r.id = p.request_id
     WHERE (r.seeker_id = ? AND p.candidate_id = ?)
        OR (p.candidate_id = ? AND r.seeker_id = ? AND p.response = 'accepted')
     LIMIT 1`,
    mine.id,
    profileId,
    mine.id,
    profileId,
  ))
}

/** True if any of the signed-in users may see the profile (checked one after another). */
export async function anyCanViewProfile(viewers: User[], profileId: string, options?: { publicListingCounts?: boolean }) {
  for (const viewer of viewers) if (await canViewProfile(viewer, profileId, options)) return true
  return false
}
