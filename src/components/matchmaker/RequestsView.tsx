import { useState } from 'react'
import { timeAgo } from '../../lib/format'
import { STATUS_LABELS, requestStatus, type RequestStatus } from '../../lib/requests'
import { findMember, type AppData, type MatchmakerData } from '../../lib/store'
import { MatchmakerAvatar } from '../shared/MatchmakerCard'
import { Portrait } from '../shared/Portrait'
import { StatusChip } from '../shared/StatusChip'
import { RequestDetail } from './RequestDetail'

export type Scope = 'mine' | 'unassigned' | 'all'
type Filter = RequestStatus | 'open' | 'all'

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'mine', label: 'Mine' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'all', label: 'All' },
]
const FILTERS: Filter[] = ['open', 'new', 'checking', 'awaiting', 'payment', 'matched', 'responded', 'closed', 'all']
const filterLabel = (f: Filter) => (f === 'open' ? 'Open' : f === 'all' ? 'Everything' : STATUS_LABELS[f].matchmaker)

interface RequestsViewProps {
  data: AppData
  matchmaker: MatchmakerData
  scope: Scope
  onScope: (scope: Scope) => void
  selectedId: string | null
  onSelect: (requestId: string | null) => void
}

export function RequestsView({ data, matchmaker, scope, onScope, selectedId, onSelect }: RequestsViewProps) {
  const [filter, setFilter] = useState<Filter>('open')
  const myId = matchmaker.me.id

  const rows = data.requests
    .map((request) => ({ request, status: requestStatus(request), seeker: findMember(data, request.seekerId) }))
    .filter((row) => row.seeker)
    .sort((a, b) => b.request.createdAt - a.request.createdAt)
  const inScope = (s: Scope) =>
    rows.filter((r) => (s === 'mine' ? r.request.matchmakerId === myId : s === 'unassigned' ? !r.request.matchmakerId : true))
  const matches = (f: Filter, status: RequestStatus) => (f === 'all' ? true : f === 'open' ? status !== 'closed' : status === f)

  const scoped = inScope(scope)
  const visible = scoped.filter((r) => matches(filter, r.status))
  const selected = rows.find((r) => r.request.id === selectedId)
  const teammate = (id: string | undefined) => matchmaker.team.find((m) => m.id === id)

  return (
    <div className="mm-layout">
      <aside className="card mm-queue">
        <div className="segmented" role="tablist" aria-label="Whose requests">
          {SCOPES.map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={scope === s.id} onClick={() => onScope(s.id)}>
              {s.label} <span className="count">{inScope(s.id).filter((r) => r.status !== 'closed').length}</span>
            </button>
          ))}
        </div>
        <div className="filter-tabs" role="tablist" aria-label="Status">
          {FILTERS.map((f) => {
            const count = scoped.filter((r) => matches(f, r.status)).length
            if (count === 0 && f !== filter && f !== 'open') return null
            return (
              <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
                {filterLabel(f)} <span className="count">{count}</span>
              </button>
            )
          })}
        </div>
        {visible.length === 0 ? (
          <p className="muted small">
            {scope === 'mine' ? 'No requests assigned to you here. Check Unassigned to take one on.' : 'No requests here.'}
          </p>
        ) : (
          <ul className="queue">
            {visible.map(({ request, status, seeker }) => {
              const owner = teammate(request.matchmakerId)
              return (
                <li key={request.id}>
                  <button type="button" aria-current={request.id === selectedId} onClick={() => onSelect(request.id)}>
                    <Portrait profile={seeker!} size={44} round />
                    <span className="queue-text">
                      <strong>
                        {seeker!.name}, {seeker!.age}
                      </strong>
                      <span className="muted small">
                        {seeker!.city} · {timeAgo(request.createdAt)}
                      </span>
                    </span>
                    <span className="queue-side">
                      <StatusChip status={status} audience="matchmaker" />
                      {owner ? (
                        <span className="owner" title={`Looked after by ${owner.displayName}`}>
                          <MatchmakerAvatar matchmaker={owner} size={20} />
                          {owner.id === myId ? 'You' : owner.displayName.split(' ')[0]}
                        </span>
                      ) : (
                        <span className="owner muted">Unassigned</span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      <section>
        {selected ? (
          <RequestDetail
            key={selected.request.id}
            request={selected.request}
            seeker={selected.seeker!}
            data={data}
            matchmaker={matchmaker}
          />
        ) : (
          <div className="card empty">
            <h3>Select a request</h3>
            <p className="muted">Pick a seeker’s request from the list to review it, take it on and propose matches.</p>
          </div>
        )}
      </section>
    </div>
  )
}
