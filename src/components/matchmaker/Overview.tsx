import { useState, type ReactNode } from 'react'
import { MATCH_FEE, formatMoney } from '../../config'
import { timeAgo } from '../../lib/format'
import { proposalState, requestStatus, type RequestStatus } from '../../lib/requests'
import { actions, findMember, type AppData, type MatchmakerData } from '../../lib/store'
import type { MatchRequest } from '../../types'
import { MatchmakerAvatar } from '../shared/MatchmakerCard'
import { Portrait } from '../shared/Portrait'
import { StatusChip } from '../shared/StatusChip'
import type { Scope } from './RequestsView'

/** What the matchmaker should do next for a request in each status (none = waiting on someone else). */
const NEXT_STEP: Partial<Record<RequestStatus, string>> = {
  new: 'Pick matches to propose',
  checking: 'Ask the candidate whether they’re interested',
  responded: 'Seeker declined everything — follow up',
  matched: 'Paid — share contact details and introduce',
}

function greeting(): string {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

function startOfMonth(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
}

interface OverviewProps {
  data: AppData
  matchmaker: MatchmakerData
  onOpenRequest: (requestId: string) => void
  onShowRequests: (scope: Scope) => void
}

export function Overview({ data, matchmaker, onOpenRequest, onShowRequests }: OverviewProps) {
  const myId = matchmaker.me.id
  const rows = data.requests.map((request) => ({ request, status: requestStatus(request) }))
  const open = rows.filter((r) => r.status !== 'closed')
  const mine = open.filter((r) => r.request.matchmakerId === myId)
  const unassigned = open.filter((r) => !r.request.matchmakerId)

  // Read the clock once per visit to this tab, not on every render.
  const [monthStart] = useState(startOfMonth)
  const [hello] = useState(greeting)
  const paidThisMonth = data.requests.flatMap((r) => r.proposals).filter((p) => p.paidAt && p.paidAt >= monthStart)
  const myPaidThisMonth = data.requests
    .filter((r) => r.matchmakerId === myId)
    .flatMap((r) => r.proposals)
    .filter((p) => p.paidAt && p.paidAt >= monthStart)

  const attention = mine
    .filter((r) => NEXT_STEP[r.status])
    .sort((a, b) => a.request.createdAt - b.request.createdAt)

  const stats = [
    { label: 'Unassigned requests', value: unassigned.length, onClick: () => onShowRequests('unassigned') },
    { label: 'My open requests', value: mine.length, onClick: () => onShowRequests('mine') },
    {
      label: 'Waiting on candidates',
      value: mine.reduce((n, r) => n + r.request.proposals.filter((p) => proposalState(p) === 'checking').length, 0),
    },
    {
      label: 'Awaiting payment',
      value: mine.reduce((n, r) => n + r.request.proposals.filter((p) => proposalState(p) === 'mutual').length, 0),
    },
    { label: 'My matches this month', value: myPaidThisMonth.length },
    {
      label: 'Team revenue this month',
      value: formatMoney(paidThisMonth.length * MATCH_FEE.amount),
      note: 'test payments',
    },
  ]

  const openCount = (id: string) => open.filter((r) => r.request.matchmakerId === id).length

  return (
    <section className="stack">
      <div>
        <h2>
          {hello}, {matchmaker.me.displayName.split(' ')[0]}
        </h2>
        <p className="muted">Here’s where your requests stand today.</p>
      </div>

      <div className="stat-grid">
        {stats.map((s) =>
          s.onClick ? (
            <button key={s.label} type="button" className="card stat stat-link" onClick={s.onClick}>
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </button>
          ) : (
            <div key={s.label} className="card stat">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">
                {s.label}
                {s.note && <span className="muted"> · {s.note}</span>}
              </span>
            </div>
          ),
        )}
      </div>

      <div className="overview-grid">
        <article className="card">
          <h3>Needs your attention</h3>
          {attention.length === 0 ? (
            <p className="muted small">Nothing waiting on you right now.</p>
          ) : (
            <ul className="attention-list">
              {attention.map(({ request, status }) => (
                <RequestLine key={request.id} data={data} request={request} status={status} onOpen={onOpenRequest}>
                  {NEXT_STEP[status]}
                </RequestLine>
              ))}
            </ul>
          )}
        </article>

        <article className="card">
          <h3>Unassigned requests</h3>
          {unassigned.length === 0 ? (
            <p className="muted small">Every request has a matchmaker.</p>
          ) : (
            <ul className="attention-list">
              {unassigned.map(({ request, status }) => (
                <RequestLine key={request.id} data={data} request={request} status={status} onOpen={onOpenRequest}>
                  <button type="button" className="btn primary small-btn" onClick={() => actions.assignRequest(request.id, myId)}>
                    Take it on
                  </button>
                </RequestLine>
              ))}
            </ul>
          )}
        </article>

        <article className="card">
          <h3>Team</h3>
          <ul className="team-mini">
            {matchmaker.team.map((m) => (
              <li key={m.id}>
                <MatchmakerAvatar matchmaker={m} size={32} />
                <span>
                  {m.displayName}
                  {m.id === myId && <span className="muted"> (you)</span>}
                </span>
                <span className="muted small">{openCount(m.id)} open</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  )
}

interface RequestLineProps {
  data: AppData
  request: MatchRequest
  status: RequestStatus
  onOpen: (requestId: string) => void
  /** Next step text or an action button, shown beside the request. */
  children: ReactNode
}

function RequestLine({ data, request, status, onOpen, children }: RequestLineProps) {
  const seeker = findMember(data, request.seekerId)
  if (!seeker) return null
  return (
    <li className="request-line">
      <button type="button" className="request-line-main" onClick={() => onOpen(request.id)}>
        <Portrait profile={seeker} size={40} round />
        <span className="queue-text">
          <strong>
            {seeker.name}, {seeker.age}
          </strong>
          <span className="muted small">
            {seeker.city} · {timeAgo(request.createdAt)}
          </span>
        </span>
        <StatusChip status={status} audience="matchmaker" />
      </button>
      <span className="request-line-action small">{children}</span>
    </li>
  )
}
