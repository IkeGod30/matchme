import { actions } from '../lib/store'
import type { Profile } from '../types'
import { MemberLine } from './CandidateCard'
import { PhysicalSummary } from './PhysicalSummary'
import { Portrait } from './Portrait'
import { RequestSummary } from './RequestSummary'
import { VisibilitySetting } from './VisibilitySetting'

export function ProfileView({ profile, onEdit, onDelete }: { profile: Profile; onEdit: () => void; onDelete: () => void }) {
  return (
    <section className="profile-view">
      <article className="card">
        <header className="candidate-top">
          <Portrait profile={profile} size={96} />
          <div className="candidate-info">
            <h2>
              {profile.name}, {profile.age}
            </h2>
            <MemberLine profile={profile} />
          </div>
        </header>
        {profile.bio && <p className="bio">{profile.bio}</p>}
        <VisibilitySetting
          isPublic={!!profile.publicListing}
          onChange={(publicListing) => actions.saveProfile({ ...profile, publicListing })}
        />
        <h3>My physical profile</h3>
        <PhysicalSummary physical={profile.physical} gender={profile.gender} />
      </article>

      <article className="card">
        <h3>My request</h3>
        <p className="muted small">Changes here are seen by your matchmaker straight away.</p>
        <RequestSummary request={profile.request} />
        <div className="form-actions">
          <button type="button" className="btn ghost danger" onClick={onDelete}>
            Delete profile
          </button>
          <button type="button" className="btn primary" onClick={onEdit}>
            Edit
          </button>
        </div>
      </article>
    </section>
  )
}
