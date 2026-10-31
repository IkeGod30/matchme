import { useFeatured } from '../../lib/store'
import type { Profile } from '../../types'
import { Portrait } from '../shared/Portrait'

interface PublicCardProps {
  profile: Profile
  isMe: boolean
  /** Hide the request button (e.g. for matchmakers). */
  canRequest: boolean
  requested: boolean
  onRequest: () => void
}

/** Public card: only the fields a member agreed to show publicly. */
function PublicCard({ profile, isMe, canRequest, requested, onRequest }: PublicCardProps) {
  return (
    <article className="card public-card">
      <Portrait profile={profile} size={160} />
      <div className="public-body">
        <h3>
          {profile.name}, {profile.age}
          {isMe && <span className="badge applies">You</span>}
        </h3>
        <p className="muted small">
          {profile.jobTitle || profile.profession} · {profile.city}
        </p>
        {profile.isDemo && <span className="demo-tag">Demo profile · not a real person</span>}
        {profile.bio && <p className="small">{profile.bio}</p>}
        <div>
          <span className="criteria-title">Looking for</span>
          <blockquote className="quote small">{profile.request.message}</blockquote>
        </div>
        {!isMe && canRequest && (
          <div className="public-action">
            {requested ? (
              <p className="small">
                <span className="badge applies">✓ Requested</span> Your matchmaker will check whether {profile.name} is
                interested too.
              </p>
            ) : (
              <button type="button" className="btn primary" onClick={onRequest}>
                Request a match with {profile.name}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

interface FeaturedMembersProps {
  meId: string | null
  signedIn: boolean
  /** Matchmakers browse this page but don't request matches. */
  canRequest: boolean
  /** Members already requested or proposed on the seeker's open request. */
  requestedIds: Set<string>
  onRequestMember: (memberId: string) => void
  onRequestMatch: () => void
}

export function FeaturedMembers({
  meId,
  signedIn,
  canRequest,
  requestedIds,
  onRequestMember,
  onRequestMatch,
}: FeaturedMembersProps) {
  const featured = useFeatured()

  return (
    <section className="stack">
      <div className="toolbar">
        <div>
          <h2>Featured members</h2>
          <p className="muted">
            These members chose to be featured publicly. Everyone else’s profile stays private — only they, their
            matchmaker and the people they’re matched with can see it.
          </p>
        </div>
      </div>

      {featured.length === 0 ? (
        <div className="card empty">
          <p className="muted">No one has chosen to be featured yet.</p>
        </div>
      ) : (
        <div className="public-grid">
          {featured.map((p) => (
            <PublicCard
              key={p.id}
              profile={p}
              isMe={p.id === meId}
              canRequest={canRequest}
              requested={requestedIds.has(p.id)}
              onRequest={() => onRequestMember(p.id)}
            />
          ))}
        </div>
      )}

      <div className="card banner">
        <strong>Interested in someone here?</strong> Press “Request a match” on their card. Your matchmaker proposes them
        to you, and once you accept, asks whether they’re interested too. You only pay if it’s mutual.
        {canRequest && (
          <div>
            <button type="button" className="btn ghost" onClick={onRequestMatch}>
              {signedIn ? 'Go to my request' : 'Or request a match without choosing someone'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
