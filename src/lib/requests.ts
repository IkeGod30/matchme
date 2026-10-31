import type { MatchRequest, Proposal } from '../types'

/**
 * Where a single proposal stands:
 * pending → seeker hasn't answered; declined → seeker said no;
 * checking → seeker said yes, waiting for the candidate; not_interested → candidate said no;
 * mutual → both said yes, awaiting the seeker's payment; paid → match confirmed.
 */
export type ProposalState = 'pending' | 'declined' | 'checking' | 'not_interested' | 'mutual' | 'paid'

export function proposalState(p: Proposal): ProposalState {
  if (p.response === 'pending') return 'pending'
  if (p.response === 'declined') return 'declined'
  if (p.paidAt) return 'paid'
  // Proposals accepted before the mutual-interest step existed count as awaiting the candidate.
  const candidate = p.candidateResponse ?? 'pending'
  if (candidate === 'pending') return 'checking'
  return candidate === 'interested' ? 'mutual' : 'not_interested'
}

export const PROPOSAL_LABELS: Record<ProposalState, string> = {
  pending: 'Awaiting seeker',
  declined: 'Declined',
  checking: 'Checking their interest',
  not_interested: 'Not interested',
  mutual: 'Mutual — awaiting payment',
  paid: 'Paid · matched',
}

export type RequestStatus = 'new' | 'awaiting' | 'checking' | 'payment' | 'matched' | 'responded' | 'closed'

export const STATUS_LABELS: Record<RequestStatus, { matchmaker: string; seeker: string }> = {
  new: { matchmaker: 'Needs matches', seeker: 'With your matchmaker' },
  awaiting: { matchmaker: 'Awaiting seeker', seeker: 'Matches to review' },
  checking: { matchmaker: 'Ask candidate', seeker: 'Checking their interest' },
  payment: { matchmaker: 'Mutual — awaiting payment', seeker: 'Mutual match!' },
  matched: { matchmaker: 'Paid — introduce', seeker: 'Matched' },
  responded: { matchmaker: 'Needs follow-up', seeker: 'Responded' },
  closed: { matchmaker: 'Closed', seeker: 'Closed' },
}

export function requestStatus(r: MatchRequest): RequestStatus {
  if (r.closedAt) return 'closed'
  const states = r.proposals.map(proposalState)
  if (states.includes('paid')) return 'matched'
  if (states.includes('mutual')) return 'payment'
  if (states.includes('checking')) return 'checking'
  if (states.includes('pending')) return 'awaiting'
  if (r.proposals.length === 0) return 'new'
  const lastProposed = Math.max(...r.proposals.map((p) => p.proposedAt))
  if (r.moreRequestedAt && r.moreRequestedAt > lastProposed) return 'new'
  // Asking for a featured member by name also puts the request back in front of the matchmaker.
  if (unproposedRequests(r).some((a) => a.at > lastProposed)) return 'new'
  return 'responded'
}

/** Featured members the seeker asked for who haven't been proposed to them yet. */
export function unproposedRequests(r: MatchRequest): MatchRequest['requestedMembers'] {
  const proposed = new Set(r.proposals.map((p) => p.candidateId))
  return (r.requestedMembers ?? []).filter((a) => !proposed.has(a.candidateId))
}

/** The seeker's most recent request, if any. */
export function latestRequestFor(requests: MatchRequest[], seekerId: string): MatchRequest | undefined {
  return requests.filter((r) => r.seekerId === seekerId).sort((a, b) => b.createdAt - a.createdAt)[0]
}
