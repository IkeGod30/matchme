import type { CSSProperties } from 'react'
import type { Profile } from '../types'
import { PortraitArt } from './FeatureArt'

function hueFor(name: string): number {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return hash
}

/** The member's uploaded photo, or an illustrated portrait drawn from their physical profile. */
export function Portrait({ profile, size = 64, round = false }: { profile: Profile; size?: number; round?: boolean }) {
  const className = `portrait${round ? ' round' : ''}`
  if (profile.photo) {
    return (
      <img className={className} src={profile.photo} width={size} height={size} alt={`Photo of ${profile.name}`} />
    )
  }
  return (
    <div
      className={`${className} illustrated`}
      style={{ width: size, height: size, '--hue': hueFor(profile.name || '?') } as CSSProperties}
      role="img"
      aria-label={`Illustrated portrait of ${profile.name || 'you'}`}
    >
      <PortraitArt physical={profile.physical} size={size} />
    </div>
  )
}
