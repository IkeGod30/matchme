import { useMemo, useState } from 'react'
import { timeAgo } from '../lib/format'
import { isMutuallyCompatible, requestFit } from '../lib/matching'
import { requestStatus } from '../lib/requests'
import { actions, allMembers, findMember, type AppData } from '../lib/store'
import type { MatchRequest, Profile } from '../types'
import { CandidateCard, MemberLine } from './CandidateCard'
import { PhysicalSummary } from './PhysicalSummary'
import { Portrait } from './Portrait'
import { RequestSummary } from './RequestSummary'
import { ResponseChip, StatusChip } from './StatusChip'

interface RequestDetailProps {
  request: MatchRequest
  seeker: Profile
  data: AppData
}

export function RequestDetail({ request, seeker, data }: RequestDetailProps) {
  const status = requestStatus(request)
  /** Selected candidate id → note for the seeker. */
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [mutualOnly, setMutualOnly] = useState(true)

  const candidates = useMemo(() => {
    const alreadyProposed = new Set(request.proposals.map((p) => p.candidateId))
    return allMembers(data)
      .filter((c) => c.id !== seeker.id && !alreadyProposed.has(c.id))
      .filter((c) => !mutualOnly || isMutuallyCompatible(seeker, c))
      .map((c) => ({ profile: c, fit: requestFit(seeker.request, c), theirFit: requestFit(c.request, seeker) }))
      .sort((a, b) => b.fit.score - a.fit.score || b.theirFit.score - a.theirFit.score)
  }, [data, seeker, request.proposals, mutualOnly])

  const pickIds = Object.keys(picks)

  function togglePick(id: string) {
    setPicks(({ [id]: existing, ...rest }) => (existing === undefined ? { ...rest, [id]: '' } : rest))
  }

  function send() {
    actions.sendProposals(
      request.id,
      pickIds.map((candidateId) => ({ candidateId, note: picks[candidateId] })),
      message,
    )
    setPicks({})
    setMessage('')
  }

  function close() {
    const prompt =
      status === 'matched' ? 'Mark the introduction as made and close this request?' : 'Close this request?'
    if (confirm(prompt)) actions.closeRequest(request.id)
  }

  return (
    <div className="stack">
      <article className="card stack">
        <header className="candidate-top">
          <Portrait profile={seeker} size={96} />
          <div className="candidate-info">
            <h2>
              {seeker.name}, {seeker.age}
            </h2>
            <MemberLine profile={seeker} />
            <p className="muted small">Request received {timeAgo(request.createdAt)}</p>
          </div>
          <div className="detail-actions">
            <StatusChip status={status} audience="matchmaker" />
            {status !== 'closed' && (
              <button type="button" className="btn ghost small-btn" onClick={close}>
                {status === 'matched' ? 'Introduction made — close' : 'Close request'}
              </button>
            )}
          </div>
        </header>
        <RequestSummary request={seeker.request} />
        <details>
          <summary>{seeker.name}'s own physical profile</summary>
          <PhysicalSummary physical={seeker.physical} />
        </details>
      </article>

      {request.proposals.length > 0 && (
        <article className="card">
          <h3>Proposals sent</h3>
          <ul className="sent-list">
            {request.proposals.map((p) => {
              const candidate = findMember(data, p.candidateId)
              if (!candidate) return null
              return (
                <li key={p.id}>
                  <Portrait profile={candidate} size={48} round />
                  <div>
                    <strong>
                      {candidate.name}, {candidate.age}
                    </strong>{' '}
                    <span className="muted small">· sent {timeAgo(p.proposedAt)}</span>
                    {p.note && <p className="small muted">Your note: {p.note}</p>}
                    {p.comment && <p className="small">“{p.comment}”</p>}
                  </div>
                  <ResponseChip response={p.response} />
                </li>
              )
            })}
          </ul>
        </article>
      )}

      {status !== 'closed' && status !== 'matched' && (
        <section className="stack">
          <div className="toolbar">
            <div>
              <h3>Find matches for {seeker.name}</h3>
              <p className="muted small">
                Ranked by how well each member fits {seeker.name}'s request. Select people to propose and add a note
                explaining your choice.
              </p>
            </div>
            <label className="check">
              <input type="checkbox" checked={mutualOnly} onChange={(e) => setMutualOnly(e.target.checked)} />
              Only mutually compatible (gender &amp; age)
            </label>
          </div>

          {candidates.length === 0 ? (
            <div className="card empty">
              <p className="muted">No more candidates. Try including members who aren't mutually compatible.</p>
            </div>
          ) : (
            <div className="candidate-grid">
              {candidates.map(({ profile, fit, theirFit }) => {
                const selected = picks[profile.id] !== undefined
                return (
                  <CandidateCard
                    key={profile.id}
                    profile={profile}
                    fit={fit}
                    fitLabel={`Fits ${seeker.name}'s request`}
                    theirFit={theirFit}
                    theirFitLabel={`${seeker.name} fits theirs`}
                    showTheirMessage
                    selected={selected}
                  >
                    <label className="pick">
                      <input type="checkbox" checked={selected} onChange={() => togglePick(profile.id)} />
                      Propose {profile.name} to {seeker.name}
                    </label>
                    {selected && (
                      <textarea
                        rows={2}
                        value={picks[profile.id]}
                        placeholder={`Why is ${profile.name} a good match? (shown to ${seeker.name})`}
                        onChange={(e) => setPicks((prev) => ({ ...prev, [profile.id]: e.target.value }))}
                      />
                    )}
                  </CandidateCard>
                )
              })}
            </div>
          )}

          {pickIds.length > 0 && (
            <div className="send-bar card">
              <textarea
                rows={2}
                value={message}
                placeholder={`Optional message to ${seeker.name}`}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button type="button" className="btn primary" onClick={send}>
                Send {pickIds.length} {pickIds.length === 1 ? 'match' : 'matches'} to {seeker.name}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
