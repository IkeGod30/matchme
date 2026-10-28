import { useSyncExternalStore } from 'react'
import { SAMPLE_PROFILES } from '../data/sampleProfiles'
import type { CandidateResponse, MatchRequest, Profile, Proposal, ProposalResponse } from '../types'
import { latestRequestFor, requestStatus } from './requests'

// Single shared store for seekers and the matchmaker, persisted to localStorage.
// Tabs stay in sync via the `storage` event, so a seeker tab and a matchmaker tab
// can be open side by side. Swap this module for a real backend later.

const DATA_KEY = 'matchme.data.v3'

export interface AppData {
  /** Members created in this app (sample members live in SAMPLE_PROFILES). */
  profiles: Profile[]
  requests: MatchRequest[]
  /** Real-life example photos uploaded by the matchmaker, keyed by exampleKey(). */
  examples: Record<string, string>
}

export const exampleKey = (feature: string, option: string) => `${feature}:${option}`

const HOUR = 3_600_000
const DAY = 24 * HOUR

function seed(): AppData {
  const now = Date.now()
  return {
    profiles: [],
    examples: {},
    requests: [
      { id: 'req-seed-1', seekerId: 'sample-1', createdAt: now - 2 * DAY, notes: [], proposals: [] },
      { id: 'req-seed-2', seekerId: 'sample-15', createdAt: now - 5 * HOUR, notes: [], proposals: [] },
      {
        id: 'req-seed-3',
        seekerId: 'sample-12',
        createdAt: now - 4 * DAY,
        notes: [{ at: now - 2 * DAY, text: 'Nia, I think both of these gentlemen could be a lovely fit. Let me know!' }],
        proposals: [
          {
            id: 'prop-seed-1',
            candidateId: 'sample-15',
            note: 'Faith-driven, ambitious and family-minded — very much what you described.',
            proposedAt: now - 2 * DAY,
            response: 'declined',
            respondedAt: now - DAY,
            comment: 'He seems wonderful, but I would really prefer someone already in the US.',
          },
          {
            id: 'prop-seed-2',
            candidateId: 'sample-4',
            note: 'Tall, athletic and ready to settle down. He has visited New York often.',
            proposedAt: now - 2 * DAY,
            response: 'accepted',
            respondedAt: now - 20 * HOUR,
            comment: 'Yes please! Would love an introduction.',
            candidateResponse: 'interested',
            candidateRespondedAt: now - 6 * HOUR,
            candidateComment: 'Happy to meet her — she sounds lovely.',
          },
        ],
      },
    ],
  }
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppData
      if (Array.isArray(parsed.profiles) && Array.isArray(parsed.requests)) return { ...parsed, examples: parsed.examples ?? {} }
    }
  } catch {
    // fall through to seed data
  }
  return seed()
}

let data = load()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** Returns false when the change could not be persisted (e.g. storage quota exceeded). */
function commit(next: AppData): boolean {
  data = next
  let saved = true
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(next))
  } catch {
    // Storage full or unavailable – keep working in memory.
    saved = false
  }
  emit()
  return saved
}

function onStorage(event: StorageEvent) {
  if (event.key !== DATA_KEY) return
  data = load()
  emit()
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener('storage', onStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, () => data)
}

/** Everyone the matchmaker can match: sample members plus members created here. */
export function allMembers(d: AppData): Profile[] {
  return [...SAMPLE_PROFILES, ...d.profiles]
}

export function findMember(d: AppData, id: string): Profile | undefined {
  return allMembers(d).find((p) => p.id === id)
}

function updateRequest(requestId: string, change: (r: MatchRequest) => MatchRequest) {
  commit({ ...data, requests: data.requests.map((r) => (r.id === requestId ? change(r) : r)) })
}

function updateProposal(requestId: string, proposalId: string, change: (p: Proposal) => Proposal) {
  updateRequest(requestId, (r) => ({ ...r, proposals: r.proposals.map((p) => (p.id === proposalId ? change(p) : p)) }))
}

export const actions = {
  saveProfile(profile: Profile) {
    const exists = data.profiles.some((p) => p.id === profile.id)
    commit({
      ...data,
      profiles: exists ? data.profiles.map((p) => (p.id === profile.id ? profile : p)) : [...data.profiles, profile],
    })
  },

  /** Sets or (with null) removes the example photo for one feature option. */
  setExample(feature: string, option: string, photo: string | null): boolean {
    const examples = { ...data.examples }
    if (photo) examples[exampleKey(feature, option)] = photo
    else delete examples[exampleKey(feature, option)]
    return commit({ ...data, examples })
  },

  deleteProfile(id: string) {
    commit({
      ...data,
      profiles: data.profiles.filter((p) => p.id !== id),
      requests: data.requests.filter((r) => r.seekerId !== id),
    })
  },

  /** Sends the seeker's current preferences to the matchmaker (one open request at a time). */
  submitRequest(seekerId: string) {
    const latest = latestRequestFor(data.requests, seekerId)
    if (latest && requestStatus(latest) !== 'closed') return
    const request: MatchRequest = {
      id: crypto.randomUUID(),
      seekerId,
      createdAt: Date.now(),
      notes: [],
      proposals: [],
    }
    commit({ ...data, requests: [...data.requests, request] })
  },

  sendProposals(requestId: string, picks: { candidateId: string; note: string }[], message: string) {
    const now = Date.now()
    updateRequest(requestId, (r) => ({
      ...r,
      notes: message.trim() ? [...r.notes, { at: now, text: message.trim() }] : r.notes,
      proposals: [
        ...r.proposals,
        ...picks.map((pick) => ({
          id: crypto.randomUUID(),
          candidateId: pick.candidateId,
          note: pick.note.trim(),
          proposedAt: now,
          response: 'pending' as const,
        })),
      ],
    }))
  },

  /** Seeker's answer. Accepting asks the candidate next; nothing is charged yet. */
  respond(requestId: string, proposalId: string, response: Exclude<ProposalResponse, 'pending'>, comment: string) {
    updateProposal(requestId, proposalId, (p) => ({
      ...p,
      response,
      respondedAt: Date.now(),
      comment: comment.trim() || undefined,
      candidateResponse: response === 'accepted' ? 'pending' : undefined,
    }))
  },

  /** The proposed person's answer — given in-app by a member, or recorded by the matchmaker. */
  recordCandidateResponse(
    requestId: string,
    proposalId: string,
    answer: Exclude<CandidateResponse, 'pending'>,
    comment = '',
  ) {
    updateProposal(requestId, proposalId, (p) => ({
      ...p,
      candidateResponse: answer,
      candidateRespondedAt: Date.now(),
      candidateComment: comment.trim() || undefined,
    }))
  },

  /** Placeholder payment: records a test reference. Replace with a real payment provider. */
  recordPayment(requestId: string, proposalId: string): string {
    const ref = `TEST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
    updateProposal(requestId, proposalId, (p) => ({ ...p, paidAt: Date.now(), paymentRef: ref }))
    return ref
  },

  askForMore(requestId: string) {
    updateRequest(requestId, (r) => ({ ...r, moreRequestedAt: Date.now() }))
  },

  closeRequest(requestId: string) {
    updateRequest(requestId, (r) => ({ ...r, closedAt: Date.now() }))
  },
}
