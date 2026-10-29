import { allMembers, type AppData } from '../lib/store'
import type { Profile } from '../types'
import { Portrait } from './Portrait'

/** Public card: only the fields a member agreed to show (see PUBLIC_FIELDS). */
function PublicCard({ profile, isMe }: { profile: Profile; isMe: boolean }) {
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
      </div>
    </article>
  )
}

interface FeaturedMembersProps {
  data: AppData
  meId: string | null
  onRequestMatch: () => void
}

export function FeaturedMembers({ data, meId, onRequestMatch }: FeaturedMembersProps) {
  const featured = allMembers(data).filter((p) => p.publicListing)

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
            <PublicCard key={p.id} profile={p} isMe={p.id === meId} />
          ))}
        </div>
      )}

      <div className="card banner">
        <strong>Interested in someone here?</strong> Request a match and mention them by name in your message — your
        matchmaker will check whether the interest is mutual. You only pay if it is.
        <div>
          <button type="button" className="btn primary" onClick={onRequestMatch}>
            {meId ? 'Go to my request' : 'Request a match'}
          </button>
        </div>
      </div>
    </section>
  )
}
