import { SELF_FEATURES, formatHeight, heightBand } from '../data/attributes'
import type { PhysicalProfile } from '../types'
import { FeatureImage } from './FeatureImage'

/** Someone's bodily attributes with thumbnails; `met` highlights ones matching your request. */
export function PhysicalSummary({ physical, met }: { physical: PhysicalProfile; met?: string[] }) {
  const rows = [
    { key: 'height' as const, label: 'Height', art: heightBand(physical.heightCm), value: formatHeight(physical.heightCm) },
    // Features that don't apply to this person (e.g. bust size for a man) are left blank and hidden.
    ...SELF_FEATURES.filter((f) => physical[f.key]).map((f) => ({
      key: f.key,
      label: f.label,
      art: physical[f.key],
      value: physical[f.key],
    })),
  ]

  return (
    <dl className="traits">
      {rows.map((row) => (
        <div key={row.key} className="trait" data-met={met?.includes(row.label) || undefined}>
          <FeatureImage feature={row.key} option={row.art} size={36} />
          <div>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  )
}
