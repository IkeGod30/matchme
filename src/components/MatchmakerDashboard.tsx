import { useState } from 'react'
import { timeAgo } from '../lib/format'
import { STATUS_LABELS, requestStatus, type RequestStatus } from '../lib/requests'
import { findMember, type AppData } from '../lib/store'
import { Portrait } from './Portrait'
import { RequestDetail } from './RequestDetail'
import { StatusChip } from './StatusChip'

type Filter = RequestStatus | 'all'
const FILTERS: Filter[] = ['new', 'awaiting', 'responded', 'matched', 'closed', 'all']

export function MatchmakerDashboard({ data }: { data: AppData }) {
  const [filter, setFilter] = useState<Filter>('new')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const rows = data.requests
    .map((request) => ({ request, status: requestStatus(request), seeker: findMember(data, request.seekerId) }))
    .filter((row) => row.seeker)
    .sort((a, b) => b.request.createdAt - a.request.createdAt)
  const count = (f: Filter) => (f === 'all' ? rows.length : rows.filter((r) => r.status === f).length)
  const visible = rows.filter((r) => filter === 'all' || r.status === filter)
  const selected = rows.find((r) => r.request.id === selectedId)

  return (
    <div className="mm-layout">
      <aside className="card mm-queue">
        <h2>Match requests</h2>
        <div className="filter-tabs" role="tablist">
          {FILTERS.map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : STATUS_LABELS[f].matchmaker} <span className="count">{count(f)}</span>
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="muted small">No requests here.</p>
        ) : (
          <ul className="queue">
            {visible.map(({ request, status, seeker }) => (
              <li key={request.id}>
                <button
                  type="button"
                  aria-current={request.id === selectedId}
                  onClick={() => setSelectedId(request.id)}
                >
                  <Portrait profile={seeker!} size={44} round />
                  <span className="queue-text">
                    <strong>
                      {seeker!.name}, {seeker!.age}
                    </strong>
                    <span className="muted small">
                      {seeker!.city} · {timeAgo(request.createdAt)}
                    </span>
                  </span>
                  <StatusChip status={status} audience="matchmaker" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section>
        {selected ? (
          <RequestDetail key={selected.request.id} request={selected.request} seeker={selected.seeker!} data={data} />
        ) : (
          <div className="card empty">
            <h3>Select a request</h3>
            <p className="muted">Pick a seeker's request from the queue to review it and propose matches.</p>
          </div>
        )}
      </section>
    </div>
  )
}
