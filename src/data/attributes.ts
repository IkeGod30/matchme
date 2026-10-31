import type { Gender, PartnerRequest, PhysicalProfile } from '../types'

export const GENDERS: { value: Gender; label: string }[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'nonbinary', label: 'Non-binary' },
]

export const HEIGHT_BANDS = [
  { label: 'Petite', maxCm: 159, note: 'Under 160 cm · 5′3″' },
  { label: 'Average', maxCm: 174, note: '160–174 cm · 5′3″–5′8″' },
  { label: 'Tall', maxCm: 189, note: '175–189 cm · 5′9″–6′2″' },
  { label: 'Very tall', maxCm: Infinity, note: '190 cm+ · 6′3″+' },
] as const

// Every bodily feature lives here. Each one gets an illustrated step in the
// preference wizard, a picture picker in the self-description, and a match criterion.
// Option names must have matching artwork in components/FeatureArt.tsx.
export const BODY_FEATURES = [
  {
    key: 'height',
    label: 'Height',
    question: 'How tall would you like your partner to be?',
    options: ['Petite', 'Average', 'Tall', 'Very tall'],
  },
  {
    key: 'bodyType',
    label: 'Body type',
    question: 'Which body shapes are you drawn to?',
    options: ['Slim', 'Athletic', 'Average', 'Curvy', 'Muscular', 'Plus-size'],
  },
  {
    key: 'chest',
    label: 'Chest & shoulders',
    question: 'What kind of chest and shoulders do you like?',
    options: ['Lean', 'Toned', 'Muscular', 'Broad'],
    appliesTo: ['man'],
  },
  {
    key: 'bustSize',
    label: 'Bust size',
    question: 'What bust size do you find attractive?',
    options: ['Small', 'Medium', 'Large', 'Very large'],
    appliesTo: ['woman'],
  },
  {
    key: 'buttSize',
    label: 'Bottom size',
    question: 'What hip and bottom size do you prefer?',
    options: ['Slim', 'Average', 'Round', 'Very curvy'],
    appliesTo: ['woman'],
  },
  {
    key: 'buttShape',
    label: 'Bottom shape',
    question: 'Which bottom shape do you find attractive?',
    options: ['Round', 'Heart', 'Square', 'V-shape'],
    appliesTo: ['woman'],
  },
  {
    key: 'skinTone',
    label: 'Skin tone',
    question: 'Do you have a skin tone preference?',
    options: ['Very fair', 'Fair', 'Medium', 'Olive', 'Brown', 'Deep'],
  },
  {
    key: 'eyeColor',
    label: 'Eye color',
    question: 'Which eye colors catch your attention?',
    options: ['Brown', 'Blue', 'Green', 'Hazel', 'Grey', 'Amber'],
  },
  {
    key: 'lips',
    label: 'Lips',
    question: 'What kind of lips do you find attractive?',
    options: ['Thin', 'Medium', 'Full', 'Very full'],
  },
  {
    key: 'hairColor',
    label: 'Hair color',
    question: 'Which hair colors do you like?',
    options: ['Black', 'Brown', 'Blonde', 'Red', 'Grey', 'Dyed', 'Bald'],
  },
  {
    key: 'hairLength',
    label: 'Hair length',
    question: 'What hair length do you prefer?',
    options: ['Shaved', 'Short', 'Medium', 'Long'],
  },
  {
    key: 'hairTexture',
    label: 'Hair texture',
    question: 'Which hair textures do you like?',
    options: ['Straight', 'Wavy', 'Curly', 'Coily', 'None'],
  },
  {
    key: 'facialHair',
    label: 'Facial hair',
    question: 'How do you feel about facial hair?',
    options: ['None', 'Stubble', 'Moustache', 'Beard'],
  },
  {
    key: 'tattoos',
    label: 'Tattoos',
    question: 'Tattoos — yes or no?',
    options: ['None', 'A few', 'Many'],
  },
] as const

export type BodyFeature = (typeof BODY_FEATURES)[number]
export type FeatureKey = BodyFeature['key']
export type SelfFeatureKey = Exclude<FeatureKey, 'height'>

/** Features the seeker describes by picking an option; height is entered in cm instead. */
export const SELF_FEATURES = BODY_FEATURES.filter(
  (f): f is Exclude<BodyFeature, { key: 'height' }> => f.key !== 'height',
)

/** Genders a feature is specific to, or undefined when it applies to everyone. */
export function featureGenders(f: BodyFeature): readonly Gender[] | undefined {
  return 'appliesTo' in f ? f.appliesTo : undefined
}

/** Features a person of this gender describes about themselves. */
export function selfFeaturesFor(gender: Gender) {
  return SELF_FEATURES.filter((f) => featureGenders(f)?.includes(gender) ?? true)
}

/**
 * Features worth asking about given who the seeker is interested in. Seeking
 * non-binary people opens up every gender-specific feature as optional.
 */
export function preferenceFeaturesFor(seeking: Gender[]) {
  return BODY_FEATURES.filter((f) => {
    const genders = featureGenders(f)
    return !genders || seeking.some((g) => g === 'nonbinary' || genders.includes(g))
  })
}

/** Which body to draw for height and body-type pictures: male only when every gender involved is a man. */
export function figureFor(genders: readonly Gender[]): 'female' | 'male' {
  return genders.length > 0 && genders.every((g) => g === 'man') ? 'male' : 'female'
}

export function genderNoun(genders: readonly Gender[]): string {
  const nouns: Record<Gender, string> = { woman: 'women', man: 'men', nonbinary: 'non-binary people' }
  return genders.map((g) => nouns[g]).join(' & ')
}

export const HEIGHT_MIN_CM = 140
export const HEIGHT_MAX_CM = 215

export function formatHeight(cm: number): string {
  const totalInches = Math.round(cm / 2.54)
  return `${cm} cm (${Math.floor(totalInches / 12)}′${totalInches % 12}″)`
}

export function heightBand(cm: number): string {
  return HEIGHT_BANDS.find((band) => cm <= band.maxCm)!.label
}

/** A person's value for a feature; '' when it doesn't apply to them (or predates the feature). */
export function featureValue(body: PhysicalProfile, key: FeatureKey): string {
  return key === 'height' ? heightBand(body.heightCm) : (body[key] ?? '')
}

/** Desired options for a feature; tolerates requests saved before the feature existed. */
export function wantedOptions(prefs: PartnerRequest['physical'], key: FeatureKey): string[] {
  return prefs[key] ?? []
}

const SHAPE_NOTES: Record<string, string> = {
  Round: 'Full, evenly curved',
  Heart: 'Fuller at the bottom (pear)',
  Square: 'Straight, even sides',
  'V-shape': 'Fuller at the top',
}

export function optionNote(key: FeatureKey, option: string): string | undefined {
  if (key === 'height') return HEIGHT_BANDS.find((band) => band.label === option)?.note
  if (key === 'buttShape') return SHAPE_NOTES[option]
  return undefined
}

export function emptyPhysical(): PhysicalProfile {
  return {
    heightCm: 170,
    ...(Object.fromEntries(SELF_FEATURES.map((f) => [f.key, ''])) as Record<SelfFeatureKey, string>),
  }
}

export function emptyRequest(): PartnerRequest {
  return {
    message: '',
    seeking: [],
    ageMin: 21,
    ageMax: 40,
    locations: [],
    races: [],
    nationalities: [],
    professions: [],
    relationshipStatuses: [],
    physical: Object.fromEntries(BODY_FEATURES.map((f) => [f.key, []])) as unknown as PartnerRequest['physical'],
  }
}
