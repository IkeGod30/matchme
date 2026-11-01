import { exampleKey } from '../lib/store'
import buttSizeRound from '../assets/feature-examples/buttSize-round.jpg'

/**
 * Example photos bundled with the app, keyed by exampleKey(). A matchmaker's upload in
 * Dashboard → Example photos replaces these; options without either use the illustration.
 *
 * Only bundle photos with documented consent from the person shown (for this use, on a
 * dating site) or a licence that covers it. Crop faces out.
 */
export const BUILT_IN_EXAMPLES: Record<string, string> = {
  [exampleKey('buttSize', 'Round')]: buttSizeRound,
}
