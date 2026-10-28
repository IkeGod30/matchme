import { SELF_FEATURES, formatHeight, heightBand } from '../data/attributes'
import type { PhysicalProfile } from '../types'
import { FeatureArt } from './FeatureArt'

/** Someone's bodily attributes with thumbnails; `met` highlights ones matching your request. */
export function PhysicalSummary({ physical, met }: { physical: PhysicalProfile; met?: string[] }) {
  const rows = [
    { key: 'height' as const, label: 'Height', art: heightBand(physical.heightCm), value: formatHeight(physical.heightCm) },
    ...SELF_FEATURES.map((f) => ({ key: f.key, label: f.label, art: physical[f.key], value: physical[f.key] })),
  ]

  return (
    <dl className="traits">
      {rows.map((row) => (
        <div key={row.key} className="trait" data-met={met?.includes(row.label) || undefined}>
          {row.art && <FeatureArt feature={row.key} option={row.art} size={36} />}
          <div>
            <dt>{row.label}</dt>
            <dd>{row.value || '—'}</dd>
          </div>
        </div>
      ))}
    </dl>
  )
}
