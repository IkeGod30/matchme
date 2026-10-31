import type { MatchmakerProfile } from '../../types'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?'

export function MatchmakerAvatar({ matchmaker, size = 48 }: { matchmaker: Pick<MatchmakerProfile, 'displayName' | 'photo'>; size?: number }) {
  if (matchmaker.photo) {
    return <img className="mm-avatar" src={matchmaker.photo} width={size} height={size} alt={matchmaker.displayName} />
  }
  return (
    <span className="mm-avatar initials" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials(matchmaker.displayName)}
    </span>
  )
}

/** A matchmaker as seekers see them. */
export function MatchmakerCard({ matchmaker, title = 'Your matchmaker' }: { matchmaker: MatchmakerProfile; title?: string }) {
  return (
    <article className="card matchmaker-card">
      <MatchmakerAvatar matchmaker={matchmaker} size={64} />
      <div className="matchmaker-card-body">
        <span className="criteria-title">{title}</span>
        <h3>{matchmaker.displayName}</h3>
        {matchmaker.bio && <p className="small">{matchmaker.bio}</p>}
        {(matchmaker.specialties.length > 0 || matchmaker.languages.length > 0) && (
          <div className="mm-tags">
            {matchmaker.specialties.map((s) => (
              <span key={s} className="criterion">
                {s}
              </span>
            ))}
            {matchmaker.languages.length > 0 && (
              <span className="muted small">Speaks {matchmaker.languages.join(', ')}</span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
