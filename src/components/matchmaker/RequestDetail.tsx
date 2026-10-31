import { useMemo, useState } from 'react'
import { timeAgo } from '../../lib/format'
import { isMutuallyCompatible, requestFit } from '../../lib/matching'
import { proposalState, requestStatus, unproposedRequests } from '../../lib/requests'
import { actions, allMembers, findMember, type AppData, type MatchmakerData } from '../../lib/store'
import type { MatchRequest, Profile } from '../../types'
import { CandidateCard, MemberLine } from '../shared/CandidateCard'
import { MatchmakerAvatar } from '../shared/MatchmakerCard'
import { PhysicalSummary } from '../shared/PhysicalSummary'
import { Portrait } from '../shared/Portrait'
import { RequestSummary } from '../shared/RequestSummary'
import { ProposalChip, StatusChip } from '../shared/StatusChip'

interface RequestDetailProps {
  request: MatchRequest
  seeker: Profile
  data: AppData
  matchmaker: MatchmakerData
}

/** Who looks after the request, with claim / hand over / release controls. */
function AssignmentBar({ request, matchmaker }: { request: MatchRequest; matchmaker: MatchmakerData }) {
  const myId = matchmaker.me.id
  const owner = matchmaker.team.find((m) => m.id === request.matchmakerId)
  return (
    <div className={`card assignment${owner?.id === myId ? ' mine' : ''}`}>
      {owner ? (
        <>
          <MatchmakerAvatar matchmaker={owner} size={36} />
          <span>
            {owner.id === myId ? <strong>You’re looking after this request</strong> : <>Looked after by <strong>{owner.displayName}</strong></>}
            {request.assignedAt && <span className="muted small"> · since {timeAgo(request.assignedAt)}</span>}
          </span>
        </>
      ) : (
        <span>
          <strong>Unassigned.</strong> <span className="muted small">No matchmaker has taken this request on yet.</span>
        </span>
      )}
      <span className="assignment-actions">
        {owner?.id !== myId && (
          <button type="button" className="btn primary small-btn" onClick={() => actions.assignRequest(request.id, myId)}>
            {owner ? 'Take over' : 'Take it on'}
          </button>
        )}
        <label className="field inline small">
          <span className="sr-only">Assign to</span>
          <select
            value={request.matchmakerId ?? ''}
            onChange={(e) => actions.assignRequest(request.id, e.target.value || null)}
          >
            <option value="">Unassigned</option>
            {matchmaker.team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === myId ? `${m.displayName} (you)` : m.displayName}
              </option>
            ))}
          </select>
        </label>
      </span>
    </div>
  )
}

/** Private notes matchmakers keep on a request; never shown to seekers. */
function InternalNotes({ request, matchmaker }: { request: MatchRequest; matchmaker: MatchmakerData }) {
  const [text, setText] = useState('')
  const notes = request.internalNotes ?? []
  const author = (id?: string) => matchmaker.team.find((m) => m.id === id)

  async function add() {
    if (!text.trim()) return
    await actions.addInternalNote(request.id, text)
    setText('')
  }

  return (
    <article className="card internal-notes">
      <h3>
        Team notes <span className="badge applies">Private</span>
      </h3>
      <p className="muted small">Only matchmakers can see these — the seeker never does.</p>
      {notes.length > 0 && (
        <ul className="notes">
          {notes.map((n) => {
            const by = author(n.authorId)
            return (
              <li key={n.id}>
                <p>{n.text}</p>
                <span className="muted small">
                  {by ? by.displayName : 'Former matchmaker'} · {timeAgo(n.at)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <div className="note-input">
        <textarea rows={2} value={text} placeholder="e.g. Called Kwame — prefers someone in Accra or Lagos." onChange={(e) => setText(e.target.value)} />
        <button type="button" className="btn ghost small-btn" disabled={!text.trim()} onClick={add}>
          Add note
        </button>
      </div>
    </article>
  )
}

export function RequestDetail({ request, seeker, data, matchmaker }: RequestDetailProps) {
  const status = requestStatus(request)
  /** Selected candidate id → note for the seeker. */
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [mutualOnly, setMutualOnly] = useState(true)

  // Featured members the seeker asked for by name: always listed, and first.
  const asked = useMemo(() => new Set(unproposedRequests(request).map((a) => a.candidateId)), [request])
  const askedMembers = [...asked].map((id) => findMember(data, id)).filter((p): p is Profile => !!p)

  const candidates = useMemo(() => {
    const alreadyProposed = new Set(request.proposals.map((p) => p.candidateId))
    return allMembers(data)
      .filter((c) => c.id !== seeker.id && !alreadyProposed.has(c.id))
      .filter((c) => asked.has(c.id) || !mutualOnly || isMutuallyCompatible(seeker, c))
      .map((c) => ({ profile: c, fit: requestFit(seeker.request, c), theirFit: requestFit(c.request, seeker) }))
      .sort(
        (a, b) =>
          Number(asked.has(b.profile.id)) - Number(asked.has(a.profile.id)) ||
          b.fit.score - a.fit.score ||
          b.theirFit.score - a.theirFit.score,
      )
  }, [data, seeker, request.proposals, mutualOnly, asked])

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
      <AssignmentBar request={request} matchmaker={matchmaker} />
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
          <PhysicalSummary physical={seeker.physical} gender={seeker.gender} />
        </details>
      </article>

      {askedMembers.length > 0 && status !== 'closed' && (
        <article className="card banner">
          <strong>
            {seeker.name} asked to be matched with {askedMembers.map((p) => p.name).join(' and ')}
          </strong>{' '}
          from the Featured page. They’re at the top of the list below — propose them as usual, and once {seeker.name}{' '}
          accepts, ask whether the interest is mutual.
        </article>
      )}

      <InternalNotes request={request} matchmaker={matchmaker} />

      {request.proposals.length > 0 && (
        <article className="card">
          <h3>Proposals sent</h3>
          <ul className="sent-list">
            {request.proposals.map((p) => {
              const candidate = findMember(data, p.candidateId)
              if (!candidate) return null
              const state = proposalState(p)
              return (
                <li key={p.id}>
                  <Portrait profile={candidate} size={48} round />
                  <div>
                    <strong>
                      {candidate.name}, {candidate.age}
                    </strong>{' '}
                    <span className="muted small">· sent {timeAgo(p.proposedAt)}</span>
                    {p.note && <p className="small muted">Your note: {p.note}</p>}
                    {p.comment && (
                      <p className="small">
                        {seeker.name}: “{p.comment}”
                      </p>
                    )}
                    {p.candidateComment && (
                      <p className="small">
                        {candidate.name}: “{p.candidateComment}”
                      </p>
                    )}
                    {state === 'checking' && (
                      <div className="record-answer">
                        <p className="small">
                          {seeker.name} said yes. Contact {candidate.name} and record whether they’re interested
                          {candidate.isDemo ? '' : ' (they can also answer in the app)'}:
                        </p>
                        <div className="respond-actions">
                          <button
                            type="button"
                            className="btn ghost small-btn"
                            onClick={() => actions.recordCandidateResponse(request.id, p.id, 'not_interested')}
                          >
                            Not interested
                          </button>
                          <button
                            type="button"
                            className="btn primary small-btn"
                            onClick={() => actions.recordCandidateResponse(request.id, p.id, 'interested')}
                          >
                            Interested
                          </button>
                        </div>
                      </div>
                    )}
                    {state === 'mutual' && (
                      <p className="small muted">Both said yes — waiting for {seeker.name} to confirm and pay.</p>
                    )}
                    {state === 'paid' && (
                      <p className="small">
                        Paid {p.paidAt && timeAgo(p.paidAt)} · ref <code>{p.paymentRef}</code> — share contact details
                        and arrange the introduction.
                      </p>
                    )}
                  </div>
                  <ProposalChip proposal={p} />
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
                    {asked.has(profile.id) && <span className="badge applies">Requested by {seeker.name}</span>}
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
