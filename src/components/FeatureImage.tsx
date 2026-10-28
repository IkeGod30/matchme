import type { FeatureKey } from '../data/attributes'
import { exampleKey, useAppData } from '../lib/store'
import { FeatureArt } from './FeatureArt'

/** The matchmaker's real-life example photo for an option, falling back to the built-in illustration. */
export function FeatureImage({ feature, option, size = 88 }: { feature: FeatureKey; option: string; size?: number }) {
  const { examples } = useAppData()
  const photo = examples[exampleKey(feature, option)]
  if (photo) {
    return <img className="feature-photo" src={photo} width={size} height={size} alt={`${option} example`} />
  }
  return <FeatureArt feature={feature} option={option} size={size} />
}
