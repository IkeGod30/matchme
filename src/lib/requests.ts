import type { MatchRequest } from '../types'

export type RequestStatus = 'new' | 'awaiting' | 'responded' | 'matched' | 'closed'

export const STATUS_LABELS: Record<RequestStatus, { matchmaker: string; seeker: string }> = {
  new: { matchmaker: 'Needs matches', seeker: 'With your matchmaker' },
  awaiting: { matchmaker: 'Awaiting seeker', seeker: 'Matches to review' },
  responded: { matchmaker: 'Seeker responded', seeker: 'Responded' },
  matched: { matchmaker: 'Matched', seeker: 'Matched' },
  closed: { matchmaker: 'Closed', seeker: 'Closed' },
}

export function requestStatus(r: MatchRequest): RequestStatus {
  if (r.closedAt) return 'closed'
  if (r.proposals.some((p) => p.response === 'accepted')) return 'matched'
  if (r.proposals.some((p) => p.response === 'pending')) return 'awaiting'
  if (r.proposals.length === 0) return 'new'
  const lastProposed = Math.max(...r.proposals.map((p) => p.proposedAt))
  if (r.moreRequestedAt && r.moreRequestedAt > lastProposed) return 'new'
  return 'responded'
}

/** The seeker's most recent request, if any. */
export function latestRequestFor(requests: MatchRequest[], seekerId: string): MatchRequest | undefined {
  return requests.filter((r) => r.seekerId === seekerId).sort((a, b) => b.createdAt - a.createdAt)[0]
}
