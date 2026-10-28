import { BODY_FEATURES, featureValue, wantedOptions } from '../data/attributes'
import type { PartnerRequest, Profile } from '../types'

export interface Criterion {
  label: string
  group: 'Background' | 'Body'
  met: boolean
}

export interface Fit {
  /** 0–1 share of stated criteria that are met. 1 when nothing is specified. */
  score: number
  criteria: Criterion[]
}

export interface Match {
  profile: Profile
  /** How well they fit your request. */
  yourFit: Fit
  /** How well you fit their request. */
  theirFit: Fit
  overall: number
}

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

function locationMatches(wanted: string[], p: Profile): boolean {
  const place = `${p.city}, ${p.country}`.toLowerCase()
  return wanted.some((w) => place.includes(w.trim().toLowerCase()))
}

/** Scores a candidate against a request. Hard limits (gender, age) are handled separately. */
export function requestFit(req: PartnerRequest, p: Profile): Fit {
  const criteria: Criterion[] = []
  const check = (label: string, group: Criterion['group'], wanted: string[], met: () => boolean) => {
    if (wanted.length > 0) criteria.push({ label, group, met: met() })
  }

  check('Location', 'Background', req.locations, () => locationMatches(req.locations, p))
  check('Race', 'Background', req.races, () => req.races.includes(p.race))
  check('Nationality', 'Background', req.nationalities, () =>
    req.nationalities.some((n) => sameText(n, p.nationality)),
  )
  check('Profession', 'Background', req.professions, () => req.professions.includes(p.profession))

  for (const feature of BODY_FEATURES) {
    const value = featureValue(p.physical, feature.key)
    // Skip features that don't apply to this candidate (e.g. bust size for a man).
    if (!value) continue
    const wanted = wantedOptions(req.physical, feature.key)
    check(feature.label, 'Body', wanted, () => wanted.includes(value))
  }

  const met = criteria.filter((c) => c.met).length
  return { score: criteria.length === 0 ? 1 : met / criteria.length, criteria }
}

function wants(seeker: Profile, other: Profile): boolean {
  const { seeking, ageMin, ageMax } = seeker.request
  return seeking.includes(other.gender) && other.age >= ageMin && other.age <= ageMax
}

/** Both people must be open to each other's gender and age. */
export function isMutuallyCompatible(a: Profile, b: Profile): boolean {
  return a.id !== b.id && wants(a, b) && wants(b, a)
}

export function findMatches(me: Profile, pool: Profile[]): Match[] {
  return pool
    .filter((other) => isMutuallyCompatible(me, other))
    .map((other) => {
      const yourFit = requestFit(me.request, other)
      const theirFit = requestFit(other.request, me)
      return { profile: other, yourFit, theirFit, overall: (yourFit.score + theirFit.score) / 2 }
    })
    .sort((a, b) => b.yourFit.score - a.yourFit.score || b.overall - a.overall)
}
