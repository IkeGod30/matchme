import { STATUS_LABELS, type RequestStatus } from '../lib/requests'
import type { ProposalResponse } from '../types'

export function StatusChip({ status, audience }: { status: RequestStatus; audience: 'seeker' | 'matchmaker' }) {
  return (
    <span className="status-chip" data-status={status}>
      {STATUS_LABELS[status][audience]}
    </span>
  )
}

const RESPONSE_LABELS: Record<ProposalResponse, string> = {
  pending: 'Awaiting response',
  accepted: 'Accepted',
  declined: 'Declined',
}

export function ResponseChip({ response }: { response: ProposalResponse }) {
  return (
    <span className="status-chip" data-response={response}>
      {RESPONSE_LABELS[response]}
    </span>
  )
}
