import { useState } from 'react'
import { GENDERS } from '../../data/attributes'
import { RELATIONSHIP_STATUSES } from '../../data/options'
import { timeAgo } from '../../lib/format'
import { requestStatus } from '../../lib/requests'
import { allMembers, findMember, type AppData } from '../../lib/store'
import type { Profile } from '../../types'
import { MemberLine } from '../shared/CandidateCard'
import { PhysicalSummary } from '../shared/PhysicalSummary'
import { Portrait } from '../shared/Portrait'
import { RequestSummary } from '../shared/RequestSummary'
import { ProposalChip, StatusChip } from '../shared/StatusChip'

type Visibility = 'any' | 'featured' | 'private'
type Kind = 'any' | 'real' | 'demo'

interface MemberDirectoryProps {
  data: AppData
  onOpenRequest: (requestId: string) => void
}

/** Every member, searchable, with their full profile and the requests they're part of. */
export function MemberDirectory({ data, onOpenRequest }: MemberDirectoryProps) {
  const [query, setQuery] = useState('')
  const [gender, setGender] = useState('')
  const [status, setStatus] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('any')
  const [kind, setKind] = useState<Kind>('any')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const members = allMembers(data).filter((p) => {
    const haystack = [p.name, p.city, p.country, p.jobTitle, p.profession, p.nationality].join(' ').toLowerCase()
    return (
      (!q || haystack.includes(q)) &&
      (!gender || p.gender === gender) &&
      (!status || p.relationshipStatus === status) &&
      (visibility === 'any' || (visibility === 'featured') === !!p.publicListing) &&
      (kind === 'any' || (kind === 'demo') === !!p.isDemo)
    )
  })
  const selected = selectedId ? findMember(data, selectedId) : undefined

  return (
    <div className="stack">
      <div className="card directory-filters">
        <label className="field directory-search">
          <span className="sr-only">Search members</span>
          <input type="search" placeholder="Search by name, city, job or nationality" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select aria-label="Gender" value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">Any gender</option>
          {GENDERS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        <select aria-label="Relationship status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any relationship status</option>
          {RELATIONSHIP_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select aria-label="Visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
          <option value="any">Private and featured</option>
          <option value="private">Private only</option>
          <option value="featured">Featured publicly</option>
        </select>
        <select aria-label="Member type" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          <option value="any">Real and demo members</option>
          <option value="real">Real members</option>
          <option value="demo">Demo members</option>
        </select>
        <span className="muted small">{members.length} members</span>
      </div>

      <div className="mm-layout">
        <aside className="card mm-queue">
          {members.length === 0 ? (
            <p className="muted small">No members match these filters.</p>
          ) : (
            <ul className="queue">
              {members.map((p) => (
                <li key={p.id}>
                  <button type="button" aria-current={p.id === selectedId} onClick={() => setSelectedId(p.id)}>
                    <Portrait profile={p} size={44} round />
                    <span className="queue-text">
                      <strong>
                        {p.name}, {p.age}
                      </strong>
                      <span className="muted small">
                        {p.city} · {p.jobTitle || p.profession}
                      </span>
                    </span>
                    {!p.isDemo && <span className="badge">Real</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section>
          {selected ? (
            <MemberDetail key={selected.id} member={selected} data={data} onOpenRequest={onOpenRequest} />
          ) : (
            <div className="card empty">
              <h3>Select a member</h3>
              <p className="muted">See their full profile, what they’re looking for and every request they’re part of.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function MemberDetail({ member, data, onOpenRequest }: { member: Profile; data: AppData; onOpenRequest: (id: string) => void }) {
  const ownRequests = data.requests.filter((r) => r.seekerId === member.id)
  const proposedIn = data.requests.flatMap((r) =>
    r.proposals.filter((p) => p.candidateId === member.id).map((proposal) => ({ request: r, proposal })),
  )

  return (
    <div className="stack">
      <article className="card stack">
        <header className="candidate-top">
          <Portrait profile={member} size={96} />
          <div className="candidate-info">
            <h2>
              {member.name}, {member.age}
            </h2>
            <MemberLine profile={member} />
          </div>
        </header>
        {member.bio && <p className="bio">{member.bio}</p>}
        <h3>Physical profile</h3>
        <PhysicalSummary physical={member.physical} gender={member.gender} />
      </article>

      <article className="card">
        <h3>What {member.name} is looking for</h3>
        <RequestSummary request={member.request} />
      </article>

      <article className="card">
        <h3>Requests</h3>
        {ownRequests.length === 0 && proposedIn.length === 0 && (
          <p className="muted small">{member.name} hasn’t asked for a match or been proposed to anyone yet.</p>
        )}
        {ownRequests.length > 0 && (
          <ul className="sent-list">
            {ownRequests.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>Their own request</strong> <span className="muted small">· {timeAgo(r.createdAt)}</span>
                </div>
                <StatusChip status={requestStatus(r)} audience="matchmaker" />
                <button type="button" className="btn ghost small-btn" onClick={() => onOpenRequest(r.id)}>
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
        {proposedIn.length > 0 && (
          <>
            <p className="criteria-title">Proposed as a match to</p>
            <ul className="sent-list">
              {proposedIn.map(({ request, proposal }) => {
                const seeker = findMember(data, request.seekerId)
                return (
                  <li key={proposal.id}>
                    {seeker && <Portrait profile={seeker} size={36} round />}
                    <div>
                      <strong>{seeker?.name ?? 'A seeker'}</strong>{' '}
                      <span className="muted small">· {timeAgo(proposal.proposedAt)}</span>
                    </div>
                    <ProposalChip proposal={proposal} />
                    <button type="button" className="btn ghost small-btn" onClick={() => onOpenRequest(request.id)}>
                      Open
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </article>
    </div>
  )
}
