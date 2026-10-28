import { useState } from 'react'
import { timeAgo } from '../lib/format'
import { requestFit } from '../lib/matching'
import { latestRequestFor, requestStatus, type RequestStatus } from '../lib/requests'
import { actions, findMember, type AppData } from '../lib/store'
import type { MatchRequest, Profile, Proposal } from '../types'
import { CandidateCard } from './CandidateCard'
import { ResponseChip, StatusChip } from './StatusChip'

const TRACK = ['Request sent', 'Matchmaker searching', 'Matches proposed', 'Your decision'] as const
const TRACK_POSITION: Record<RequestStatus, number> = { new: 1, awaiting: 2, responded: 3, matched: 4, closed: 4 }

function Tracker({ status }: { status: RequestStatus }) {
  const position = TRACK_POSITION[status]
  return (
    <ol className="tracker">
      {TRACK.map((label, i) => (
        <li key={label} data-state={i < position ? 'done' : i === position ? 'current' : 'todo'}>
          <span className="tracker-dot" aria-hidden="true">
            {i < position ? '✓' : i + 1}
          </span>
          {label}
        </li>
      ))}
    </ol>
  )
}

function ProposalCard({ me, request, proposal, candidate }: { me: Profile; request: MatchRequest; proposal: Proposal; candidate: Profile }) {
  const [comment, setComment] = useState('')

  return (
    <CandidateCard profile={candidate} fit={requestFit(me.request, candidate)} fitLabel="Fits your request" showTheirMessage>
      {proposal.note && (
        <div className="mm-note">
          <span className="criteria-title">Why your matchmaker chose {candidate.name}</span>
          <p>{proposal.note}</p>
        </div>
      )}
      {proposal.response === 'pending' ? (
        <div className="respond">
          <textarea
            rows={2}
            value={comment}
            placeholder="Optional comment for your matchmaker"
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="respond-actions">
            <button type="button" className="btn ghost" onClick={() => actions.respond(request.id, proposal.id, 'declined', comment)}>
              Decline
            </button>
            <button type="button" className="btn primary" onClick={() => actions.respond(request.id, proposal.id, 'accepted', comment)}>
              Accept match
            </button>
          </div>
        </div>
      ) : (
        <div className="responded">
          <ResponseChip response={proposal.response} />
          <span className="muted small">{proposal.respondedAt && timeAgo(proposal.respondedAt)}</span>
          {proposal.comment && <p className="small">“{proposal.comment}”</p>}
        </div>
      )}
    </CandidateCard>
  )
}

export function SeekerHome({ me, data, onEditRequest }: { me: Profile; data: AppData; onEditRequest: () => void }) {
  const request = latestRequestFor(data.requests, me.id)
  const status = request ? requestStatus(request) : undefined

  if (!request || status === 'closed') {
    return (
      <section className="card empty">
        <h2>{request ? 'Your last request is closed' : 'Ready to be matched?'}</h2>
        <p className="muted">
          Send your request to a matchmaker. They'll review your preferences and hand-pick people for you to accept or
          decline.
        </p>
        <div className="empty-actions">
          <button type="button" className="btn ghost" onClick={onEditRequest}>
            Review my request
          </button>
          <button type="button" className="btn primary" onClick={() => actions.submitRequest(me.id)}>
            Send request to matchmaker
          </button>
        </div>
      </section>
    )
  }

  const withCandidates = request.proposals
    .map((proposal) => ({ proposal, candidate: findMember(data, proposal.candidateId) }))
    .filter((x): x is { proposal: Proposal; candidate: Profile } => !!x.candidate)
  const pending = withCandidates.filter((x) => x.proposal.response === 'pending')
  const answered = withCandidates.filter((x) => x.proposal.response !== 'pending')
  const accepted = answered.filter((x) => x.proposal.response === 'accepted')

  function withdraw() {
    if (confirm('Withdraw your match request? Any pending proposals will be dropped.')) actions.closeRequest(request!.id)
  }

  return (
    <section className="stack">
      <div className="toolbar">
        <div>
          <h2>Your match request</h2>
          <p className="muted">Sent {timeAgo(request.createdAt)}</p>
        </div>
        <StatusChip status={status!} audience="seeker" />
      </div>

      <Tracker status={status!} />

      {status === 'matched' && (
        <div className="card banner success">
          <strong>It's a match!</strong> You accepted {accepted.map((x) => x.candidate.name).join(' and ')}. Your
          matchmaker will be in touch to arrange an introduction.
        </div>
      )}

      {request.notes.length > 0 && (
        <article className="card">
          <h3>From your matchmaker</h3>
          <ul className="notes">
            {[...request.notes].reverse().map((note) => (
              <li key={note.at}>
                <p>{note.text}</p>
                <span className="muted small">{timeAgo(note.at)}</span>
              </li>
            ))}
          </ul>
        </article>
      )}

      {status === 'new' && (
        <div className="card banner">
          <strong>Your matchmaker is on it.</strong>{' '}
          {request.moreRequestedAt
            ? "You asked for more options — new matches will appear here once they're picked."
            : "They're reviewing your request and searching for people who fit. Matches will appear here."}
        </div>
      )}

      {pending.length > 0 && (
        <>
          <h3>Matches to review ({pending.length})</h3>
          <div className="candidate-grid">
            {pending.map(({ proposal, candidate }) => (
              <ProposalCard key={proposal.id} me={me} request={request} proposal={proposal} candidate={candidate} />
            ))}
          </div>
        </>
      )}

      {status === 'responded' && (
        <div className="card banner">
          <strong>None of these felt right?</strong> Ask your matchmaker for another round — your comments help them
          choose better.
          <div>
            <button type="button" className="btn primary" onClick={() => actions.askForMore(request.id)}>
              Ask for more matches
            </button>
          </div>
        </div>
      )}

      {answered.length > 0 && (
        <>
          <h3>Your responses</h3>
          <div className="candidate-grid">
            {answered.map(({ proposal, candidate }) => (
              <ProposalCard key={proposal.id} me={me} request={request} proposal={proposal} candidate={candidate} />
            ))}
          </div>
        </>
      )}

      <button type="button" className="link-btn" onClick={withdraw}>
        Withdraw request
      </button>
    </section>
  )
}
