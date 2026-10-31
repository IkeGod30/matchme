import type { FeatureKey } from '../../data/attributes'
import { exampleKey, useAppData } from '../../lib/store'
import { FeatureArt } from './FeatureArt'
import type { FigureSex } from './silhouettes'

interface FeatureImageProps {
  feature: FeatureKey
  option: string
  size?: number
  figure?: FigureSex
}

/** The matchmaker's real-life example photo for an option, falling back to the built-in illustration. */
export function FeatureImage({ feature, option, size = 88, figure }: FeatureImageProps) {
  const { examples } = useAppData()
  const photo = examples[exampleKey(feature, option)]
  if (photo) {
    return <img className="feature-photo" src={photo} width={size} height={size} alt={`${option} example`} />
  }
  return <FeatureArt feature={feature} option={option} size={size} figure={figure} />
}
