import { GENDERS, figureFor, preferenceFeaturesFor, wantedOptions } from '../data/attributes'
import type { PartnerRequest } from '../types'
import { FeatureImage } from './FeatureImage'

const listOrOpen = (values: string[]) => (values.length ? values.join(', ') : 'Open to all')

export function RequestSummary({ request }: { request: PartnerRequest }) {
  const seeking = GENDERS.filter((g) => request.seeking.includes(g.value)).map((g) => g.label)

  return (
    <div className="request-summary">
      {request.message && <blockquote className="quote">{request.message}</blockquote>}

      <dl className="facts">
        <div>
          <dt>Looking for</dt>
          <dd>
            {seeking.join(', ') || '—'}, aged {request.ageMin}–{request.ageMax}
          </dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{request.locations.length ? request.locations.join(', ') : 'Anywhere'}</dd>
        </div>
        <div>
          <dt>Race</dt>
          <dd>{listOrOpen(request.races)}</dd>
        </div>
        <div>
          <dt>Nationality</dt>
          <dd>{listOrOpen(request.nationalities)}</dd>
        </div>
        <div>
          <dt>Profession</dt>
          <dd>{listOrOpen(request.professions)}</dd>
        </div>
      </dl>

      <h4>Desired bodily features</h4>
      <ul className="desired">
        {preferenceFeaturesFor(request.seeking).map((feature) => {
          const wanted = wantedOptions(request.physical, feature.key)
          return (
            <li key={feature.key}>
              <span className="desired-label">{feature.label}</span>
              {wanted.length === 0 ? (
                <span className="muted">No preference</span>
              ) : (
                <span className="desired-options">
                  {wanted.map((option) => (
                    <span key={option} className="mini-pick">
                      <FeatureImage
                        feature={feature.key}
                        option={option}
                        size={32}
                        figure={figureFor(request.seeking)}
                      />
                      {option}
                    </span>
                  ))}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
