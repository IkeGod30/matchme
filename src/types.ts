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
  profession: string
  jobTitle: string
  bio: string
  /** Resized JPEG data URL. Without one, an illustrated portrait is drawn from `physical`. */
  photo?: string
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
}

/** A seeker's request to be matched, handled by the matchmaker. */
export interface MatchRequest {
  id: string
  seekerId: string
  createdAt: number
  /** Messages from the matchmaker to the seeker. */
  notes: { at: number; text: string }[]
  proposals: Proposal[]
  /** Set when the seeker declined everything and asked for another round. */
  moreRequestedAt?: number
  closedAt?: number
}
