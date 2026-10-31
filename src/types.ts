import type { FeatureKey, SelfFeatureKey } from './data/attributes'

export type Gender = 'woman' | 'man' | 'nonbinary'

/** The seeker's own bodily attributes. */
export type PhysicalProfile = { heightCm: number } & Record<SelfFeatureKey, string>

/** Bodily features desired in a partner. An empty list means "no preference". */
export type PhysicalPreferences = Record<FeatureKey, string[]>

/** What the seeker asks the matchmaker for. Empty lists mean "open to all". */
export interface PartnerRequest {
  message: string
  seeking: Gender[]
  ageMin: number
  ageMax: number
  locations: string[]
  races: string[]
  nationalities: string[]
  professions: string[]
  relationshipStatuses: string[]
  physical: PhysicalPreferences
}

export interface Profile {
  id: string
  name: string
  age: number
  gender: Gender
  city: string
  country: string
  nationality: string
  race: string
  /** One of RELATIONSHIP_STATUSES. May be missing on profiles saved before it existed. */
  relationshipStatus: string
  profession: string
  jobTitle: string
  bio: string
  /** Image URL (uploaded data URL or bundled demo photo). Without one, an illustrated portrait is drawn from `physical`. */
  photo?: string
  /** Sample member that is not a real person; labelled as such wherever shown. */
  isDemo?: boolean
  /**
   * Opt-in: show a limited public card on the Featured page. Off (private) by default —
   * otherwise only the member, their matchmaker and people they're matched with see the profile.
   */
  publicListing?: boolean
  physical: PhysicalProfile
  request: PartnerRequest
}

export type ProposalResponse = 'pending' | 'accepted' | 'declined'

/** A candidate the matchmaker presents to a seeker. */
export interface Proposal {
  id: string
  candidateId: string
  /** Matchmaker's reason for suggesting this person. */
  note: string
  proposedAt: number
  response: ProposalResponse
  respondedAt?: number
  /** Seeker's optional comment when accepting or declining. */
  comment?: string
  /** The proposed person's answer, asked only after the seeker accepts. */
  candidateResponse?: CandidateResponse
  candidateRespondedAt?: number
  candidateComment?: string
  /** Set once the seeker pays for a mutual match. */
  paidAt?: number
  paymentRef?: string
}

export type CandidateResponse = 'pending' | 'interested' | 'not_interested'

/** A matchmaker as seekers see them. */
export interface MatchmakerProfile {
  id: string
  displayName: string
  bio: string
  specialties: string[]
  languages: string[]
  photo?: string
}

/** A matchmaker as their teammates see them. */
export interface TeamMember extends MatchmakerProfile {
  email: string
}

/** Someone who applied to be a matchmaker and is waiting for approval. */
export interface Application {
  id: string
  displayName: string
  email: string
  experience: string
  languages: string[]
  appliedAt: number
}

/** A private note matchmakers keep on a request. */
export interface InternalNote {
  id: string
  authorId?: string
  text: string
  at: number
}

/** A pending invitation for a new matchmaker. */
export interface Invite {
  id: string
  email?: string
  createdBy?: string
  createdAt: number
  expiresAt: number
}

/** A seeker's request to be matched, handled by a matchmaker. */
export interface MatchRequest {
  id: string
  seekerId: string
  createdAt: number
  /** The matchmaker looking after this request; undefined while unassigned. */
  matchmakerId?: string
  assignedAt?: number
  /** Included for the seeker: who is looking after their request. */
  matchmaker?: MatchmakerProfile
  /** Included for matchmakers only. */
  internalNotes?: InternalNote[]
  /** Messages from the matchmaker to the seeker. */
  notes: { at: number; text: string }[]
  proposals: Proposal[]
  /** Set when the seeker declined everything and asked for another round. */
  moreRequestedAt?: number
  closedAt?: number
}
