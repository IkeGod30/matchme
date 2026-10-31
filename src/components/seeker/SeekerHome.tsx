import { useState } from 'react'
import { formatFee } from '../../config'
import { timeAgo } from '../../lib/format'
import { requestFit } from '../../lib/matching'
import { latestRequestFor, proposalState, requestStatus, unproposedRequests, type RequestStatus } from '../../lib/requests'
import { actions, findMember, useFeatured, type AppData } from '../../lib/store'
import type { MatchRequest, Profile, Proposal } from '../../types'
import { CandidateCard } from '../shared/CandidateCard'
import { MatchmakerCard } from '../shared/MatchmakerCard'
import { Portrait } from '../shared/Portrait'
import { PaymentDialog } from './PaymentDialog'
import { ProposalChip, StatusChip } from '../shared/StatusChip'

const TRACK = ['Request sent', 'Matchmaker searching', 'Matches proposed', 'Their answer', 'Matched'] as const
const TRACK_POSITION: Record<RequestStatus, number> = {
  new: 1,
  awaiting: 2,
  responded: 2,
  checking: 3,
  payment: 4,
  matched: 5,
  closed: 5,
}

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

interface ProposalCardProps {
  me: Profile
  request: MatchRequest
  proposal: Proposal
  candidate: Profile
  onPay: () => void
}

function ProposalCard({ me, request, proposal, candidate, onPay }: ProposalCardProps) {
  const [comment, setComment] = useState('')
  const state = proposalState(proposal)

  return (
    <CandidateCard profile={candidate} fit={requestFit(me.request, candidate)} fitLabel="Fits your request" showTheirMessage>
      {proposal.note && (
        <div className="mm-note">
          <span className="criteria-title">Why your matchmaker chose {candidate.name}</span>
          <p>{proposal.note}</p>
        </div>
      )}

      {state === 'pending' && (
        <div className="respond">
          <textarea
            rows={2}
            value={comment}
            placeholder="Optional comment for your matchmaker"
            onChange={(e) => setComment(e.target.value)}
          />
          <p className="muted small">
            Accepting is free. We’ll ask {candidate.name} whether they’re interested too — you only pay if they say yes.
          </p>
          <div className="respond-actions">
            <button type="button" className="btn ghost" onClick={() => actions.respond(request.id, proposal.id, 'declined', comment)}>
              Decline
            </button>
            <button type="button" className="btn primary" onClick={() => actions.respond(request.id, proposal.id, 'accepted', comment)}>
              Accept match
            </button>
          </div>
        </div>
      )}

      {state === 'mutual' && (
        <div className="respond mutual">
          <strong>It’s mutual! {candidate.name} is interested in you too.</strong>
          {proposal.candidateComment && <p className="small">“{proposal.candidateComment}”</p>}
          <p className="muted small">Confirm the match to receive an introduction. This is the only payment.</p>
          <button type="button" className="btn primary" onClick={onPay}>
            Confirm match — pay {formatFee()}
          </button>
        </div>
      )}

      {state !== 'pending' && state !== 'mutual' && (
        <div className="responded">
          <ProposalChip proposal={proposal} />
          {state === 'checking' && (
            <p className="small muted">
              Your matchmaker is asking {candidate.name} whether they’re interested too. You won’t pay anything unless
              they say yes.
            </p>
          )}
          {state === 'not_interested' && (
            <p className="small muted">
              {candidate.name} isn’t available for an introduction this time. You haven’t been charged.
            </p>
          )}
          {state === 'paid' && (
            <p className="small">
              Paid {proposal.paidAt && timeAgo(proposal.paidAt)} · ref <code>{proposal.paymentRef}</code>. Your
              matchmaker will share contact details and arrange your introduction.
            </p>
          )}
          {proposal.comment && state === 'declined' && <p className="small">“{proposal.comment}”</p>}
        </div>
      )}
    </CandidateCard>
  )
}

/** Proposals where *I* am the candidate and the seeker has already said yes. */
function IncomingInterest({ me, data }: { me: Profile; data: AppData }) {
  const incoming = data.requests
    .filter((r) => !r.closedAt)
    .flatMap((request) =>
      request.proposals
        .filter((p) => p.candidateId === me.id && p.response === 'accepted' && proposalState(p) === 'checking')
        .map((proposal) => ({ request, proposal, seeker: findMember(data, request.seekerId) })),
    )
    .filter((x): x is typeof x & { seeker: Profile } => !!x.seeker)

  if (incoming.length === 0) return null

  return (
    <section className="stack">
      <div>
        <h2>Someone wants to meet you</h2>
        <p className="muted">
          A matchmaker proposed you to {incoming.length === 1 ? 'this person' : 'these people'}, and they said yes. Are
          you interested too?
        </p>
      </div>
      <div className="candidate-grid">
        {incoming.map(({ request, proposal, seeker }) => (
          <CandidateCard
            key={proposal.id}
            profile={seeker}
            fit={requestFit(me.request, seeker)}
            fitLabel="Fits your request"
            showTheirMessage
          >
            {proposal.comment && (
              <div className="mm-note">
                <span className="criteria-title">{seeker.name} said</span>
                <p>“{proposal.comment}”</p>
              </div>
            )}
            <div className="respond-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => actions.recordCandidateResponse(request.id, proposal.id, 'not_interested')}
              >
                Not interested
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => actions.recordCandidateResponse(request.id, proposal.id, 'interested')}
              >
                I’m interested
              </button>
            </div>
          </CandidateCard>
        ))}
      </div>
    </section>
  )
}

export function SeekerHome({ me, data, onEditRequest }: { me: Profile; data: AppData; onEditRequest: () => void }) {
  const [paying, setPaying] = useState<{ proposalId: string; candidate: Profile } | null>(null)
  const featured = useFeatured()
  const request = latestRequestFor(data.requests, me.id)
  const status = request ? requestStatus(request) : undefined

  if (!request || status === 'closed') {
    return (
      <div className="stack">
        <IncomingInterest me={me} data={data} />
        <section className="card empty">
          <h2>{request ? 'Your last request is closed' : 'Ready to be matched?'}</h2>
          <p className="muted">
            Send your request to a matchmaker. They’ll review your preferences and hand-pick people for you to accept
            or decline. No upfront fees — you only pay when a match is mutual.
          </p>
          <div className="empty-actions">
            <button type="button" className="btn ghost" onClick={onEditRequest}>
              Review my request
            </button>
            <button type="button" className="btn primary" onClick={() => actions.submitRequest()}>
              Send request to matchmaker
            </button>
          </div>
        </section>
      </div>
    )
  }

  const withCandidates = request.proposals
    .map((proposal) => ({ proposal, candidate: findMember(data, proposal.candidateId) }))
    .filter((x): x is { proposal: Proposal; candidate: Profile } => !!x.candidate)
  const toReview = withCandidates.filter((x) => proposalState(x.proposal) === 'pending')
  const inProgress = withCandidates.filter((x) => ['checking', 'mutual', 'paid'].includes(proposalState(x.proposal)))
  const finished = withCandidates.filter((x) => ['declined', 'not_interested'].includes(proposalState(x.proposal)))
  // Featured members asked for by name and not proposed yet (members who've since unlisted are left out).
  const asked = unproposedRequests(request)
    .map((a) => featured.find((p) => p.id === a.candidateId))
    .filter((p): p is Profile => !!p)
  const names = (state: string) =>
    withCandidates.filter((x) => proposalState(x.proposal) === state).map((x) => x.candidate.name).join(' and ')

  function withdraw() {
    if (confirm('Withdraw your match request? Any pending proposals will be dropped.')) actions.closeRequest(request!.id)
  }

  const renderCard = ({ proposal, candidate }: { proposal: Proposal; candidate: Profile }) => (
    <ProposalCard
      key={proposal.id}
      me={me}
      request={request}
      proposal={proposal}
      candidate={candidate}
      onPay={() => setPaying({ proposalId: proposal.id, candidate })}
    />
  )

  return (
    <div className="stack">
      <IncomingInterest me={me} data={data} />

      <section className="stack">
        <div className="toolbar">
          <div>
            <h2>Your match request</h2>
            <p className="muted">Sent {timeAgo(request.createdAt)}</p>
          </div>
          <StatusChip status={status!} audience="seeker" />
        </div>

        <Tracker status={status!} />

        {request.matchmaker ? (
          <MatchmakerCard matchmaker={request.matchmaker} />
        ) : (
          <p className="muted small">A matchmaker will take on your request shortly — you’ll see who here.</p>
        )}

        {status === 'matched' && (
          <div className="card banner success">
            <strong>You’re matched with {names('paid')}!</strong> Your matchmaker will share contact details and
            arrange your introduction.
          </div>
        )}

        {status === 'payment' && (
          <div className="card banner success">
            <strong>It’s mutual!</strong> {names('mutual')} said yes to you too. Confirm the match below to get your
            introduction — this is the only time you pay.
          </div>
        )}

        {status === 'checking' && (
          <div className="card banner">
            <strong>Waiting for their answer.</strong> Your matchmaker is checking whether {names('checking')}{' '}
            {withCandidates.filter((x) => proposalState(x.proposal) === 'checking').length > 1 ? 'are' : 'is'} interested
            in you too. You won’t be charged unless the interest is mutual.
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

        {asked.length > 0 && (
          <article className="card">
            <h3>You asked to be matched with</h3>
            <ul className="asked-list">
              {asked.map((p) => (
                <li key={p.id}>
                  <Portrait profile={p} size={40} round />
                  <span>
                    <strong>
                      {p.name}, {p.age}
                    </strong>
                    <span className="muted small"> · {p.city}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="muted small">
              Your matchmaker will propose them to you here. Once you accept, they’re asked whether they’re interested
              too.
            </p>
          </article>
        )}

        {status === 'new' && (
          <div className="card banner">
            <strong>Your matchmaker is on it.</strong>{' '}
            {request.moreRequestedAt
              ? 'You asked for more options — new matches will appear here once they’re picked.'
              : 'They’re reviewing your request and searching for people who fit. Matches will appear here.'}
          </div>
        )}

        {inProgress.length > 0 && (
          <>
            <h3>Your matches</h3>
            <div className="candidate-grid">{inProgress.map(renderCard)}</div>
          </>
        )}

        {toReview.length > 0 && (
          <>
            <h3>Matches to review ({toReview.length})</h3>
            <div className="candidate-grid">{toReview.map(renderCard)}</div>
          </>
        )}

        {status === 'responded' && (
          <div className="card banner">
            <strong>None of these worked out?</strong> Ask your matchmaker for another round — your comments help them
            choose better.
            <div>
              <button type="button" className="btn primary" onClick={() => actions.askForMore(request.id)}>
                Ask for more matches
              </button>
            </div>
          </div>
        )}

        {finished.length > 0 && (
          <>
            <h3>Past proposals</h3>
            <div className="candidate-grid">{finished.map(renderCard)}</div>
          </>
        )}

        <button type="button" className="link-btn" onClick={withdraw}>
          Withdraw request
        </button>
      </section>

      {paying && (
        <PaymentDialog
          requestId={request.id}
          proposalId={paying.proposalId}
          match={paying.candidate}
          onClose={() => setPaying(null)}
        />
      )}
    </div>
  )
}
