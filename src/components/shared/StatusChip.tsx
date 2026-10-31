import { PROPOSAL_LABELS, STATUS_LABELS, proposalState, type RequestStatus } from '../../lib/requests'
import type { Proposal } from '../../types'

export function StatusChip({ status, audience }: { status: RequestStatus; audience: 'seeker' | 'matchmaker' }) {
  return (
    <span className="status-chip" data-status={status}>
      {STATUS_LABELS[status][audience]}
    </span>
  )
}

export function ProposalChip({ proposal }: { proposal: Proposal }) {
  const state = proposalState(proposal)
  return (
    <span className="status-chip" data-proposal={state}>
      {PROPOSAL_LABELS[state]}
    </span>
  )
}
