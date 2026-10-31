import type { ReactNode } from 'react'
import { GENDERS } from '../../data/attributes'
import type { Criterion, Fit } from '../../lib/matching'
import type { Profile } from '../../types'
import { PhysicalSummary } from './PhysicalSummary'
import { Portrait } from './Portrait'

export function FitMeter({ label, fit }: { label: string; fit: Fit }) {
  const pct = Math.round(fit.score * 100)
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{label}</span>
        <strong>{fit.criteria.length === 0 ? 'Open' : `${pct}%`}</strong>
      </div>
      <div className="meter-track" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function CriteriaRow({ title, criteria }: { title: string; criteria: Criterion[] }) {
  if (criteria.length === 0) return null
  return (
    <div className="criteria">
      <span className="criteria-title">{title}</span>
      {criteria.map((c) => (
        <span key={c.label} className="criterion" data-met={c.met}>
          {c.met ? '✓' : '✕'} {c.label}
        </span>
      ))}
    </div>
  )
}

export function MemberLine({ profile }: { profile: Profile }) {
  const gender = GENDERS.find((g) => g.value === profile.gender)?.label
  return (
    <>
      <p className="muted small">
        {gender} · {profile.jobTitle || profile.profession}
        {profile.relationshipStatus && ` · ${profile.relationshipStatus}`}
        <br />
        {profile.city}, {profile.country} · {profile.nationality} · {profile.race}
      </p>
      <span className="member-tags">
        {profile.isDemo && (
          <span className="demo-tag" title="Sample member for demonstration. The picture is AI-generated or illustrated.">
            Demo profile · not a real person
          </span>
        )}
        <span className="visibility-tag" data-public={profile.publicListing || undefined}>
          {profile.publicListing ? 'Featured publicly' : 'Private profile'}
        </span>
      </span>
    </>
  )
}

interface CandidateCardProps {
  profile: Profile
  /** How well this person fits the seeker's request. */
  fit: Fit
  fitLabel: string
  /** How well the seeker fits this person's own request. */
  theirFit?: Fit
  theirFitLabel?: string
  showTheirMessage?: boolean
  selected?: boolean
  children?: ReactNode
}

export function CandidateCard({
  profile,
  fit,
  fitLabel,
  theirFit,
  theirFitLabel = 'Mutual fit',
  showTheirMessage = false,
  selected,
  children,
}: CandidateCardProps) {
  const bodyMet = fit.criteria.filter((c) => c.group === 'Body' && c.met).map((c) => c.label)

  return (
    <article className="card candidate" data-selected={selected || undefined}>
      <div className="candidate-top">
        <Portrait profile={profile} size={112} />
        <div className="candidate-info">
          <h3>
            {profile.name}, {profile.age}
          </h3>
          <MemberLine profile={profile} />
          {fit.score === 1 && fit.criteria.length > 0 && <span className="badge">Meets every preference</span>}
        </div>
      </div>

      <div className="meters">
        <FitMeter label={fitLabel} fit={fit} />
        {theirFit && <FitMeter label={theirFitLabel} fit={theirFit} />}
      </div>

      <CriteriaRow title="Background" criteria={fit.criteria.filter((c) => c.group === 'Background')} />
      <CriteriaRow title="Body" criteria={fit.criteria.filter((c) => c.group === 'Body')} />

      {showTheirMessage && (
        <div>
          <span className="criteria-title">{profile.name} is looking for</span>
          <blockquote className="quote small">{profile.request.message}</blockquote>
        </div>
      )}

      <details>
        <summary>{profile.name}'s physical profile</summary>
        <PhysicalSummary physical={profile.physical} gender={profile.gender} met={bodyMet} />
      </details>

      {children}
    </article>
  )
}
