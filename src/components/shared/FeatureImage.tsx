import type { FeatureKey } from '../../data/attributes'
import { BUILT_IN_EXAMPLES } from '../../data/featureExamples'
import { exampleKey, useAppData } from '../../lib/store'
import { FeatureArt } from './FeatureArt'
import type { FigureSex } from './silhouettes'

interface FeatureImageProps {
  feature: FeatureKey
  option: string
  size?: number
  figure?: FigureSex
}

/**
 * The real-life example photo for an option — the matchmaker's upload, else one bundled with
 * the app — falling back to the built-in illustration.
 */
export function FeatureImage({ feature, option, size = 88, figure }: FeatureImageProps) {
  const { examples } = useAppData()
  const key = exampleKey(feature, option)
  const photo = examples[key] ?? BUILT_IN_EXAMPLES[key]
  if (photo) {
    return <img className="feature-photo" src={photo} width={size} height={size} alt={`${option} example`} />
  }
  return <FeatureArt feature={feature} option={option} size={size} figure={figure} />
}
