import type { Gender, PartnerRequest, PhysicalPreferences, PhysicalProfile, Profile } from '../types'
import { emptyRequest } from './attributes'

/** Positional shorthand: height, body type, skin tone, eyes, hair color, hair length, hair texture, facial hair, tattoos. */
function body(
  heightCm: number,
  bodyType: string,
  skinTone: string,
  eyeColor: string,
  hairColor: string,
  hairLength: string,
  hairTexture: string,
  facialHair: string,
  tattoos: string,
): PhysicalProfile {
  return {
    heightCm,
    bodyType,
    skinTone,
    eyeColor,
    hairColor,
    hairLength,
    hairTexture,
    facialHair,
    tattoos,
    lips: '',
    chest: '',
    bustSize: '',
    buttSize: '',
    buttShape: '',
  }
}

/** Lips plus gender-specific features (chest for men; bust and bottom for women), by name. */
const EXTRAS: Record<string, Partial<PhysicalProfile>> = {
  Amara: { lips: 'Full', bustSize: 'Medium', buttSize: 'Round', buttShape: 'Round' },
  Daniel: { lips: 'Medium', chest: 'Toned' },
  Sofia: { lips: 'Full', bustSize: 'Small', buttSize: 'Average', buttShape: 'Heart' },
  Marcus: { lips: 'Full', chest: 'Muscular' },
  Priya: { lips: 'Medium', bustSize: 'Medium', buttSize: 'Average', buttShape: 'Heart' },
  Leo: { lips: 'Thin', chest: 'Lean' },
  Jordan: { lips: 'Medium' },
  Grace: { lips: 'Thin', bustSize: 'Small', buttSize: 'Slim', buttShape: 'Square' },
  Ethan: { lips: 'Medium', chest: 'Lean' },
  Yuki: { lips: 'Medium', bustSize: 'Small', buttSize: 'Slim', buttShape: 'V-shape' },
  Mateo: { lips: 'Full', chest: 'Toned' },
  Nia: { lips: 'Very full', bustSize: 'Large', buttSize: 'Very curvy', buttShape: 'Heart' },
  Olivier: { lips: 'Thin', chest: 'Broad' },
  Riley: { lips: 'Full' },
  Kwame: { lips: 'Full', chest: 'Muscular' },
  Layla: { lips: 'Full', bustSize: 'Medium', buttSize: 'Round', buttShape: 'Round' },
  'Min-jun': { lips: 'Medium', chest: 'Lean' },
  Chloe: { lips: 'Thin', bustSize: 'Medium', buttSize: 'Round', buttShape: 'Round' },
  Adaeze: { lips: 'Full', bustSize: 'Small', buttSize: 'Average', buttShape: 'Square' },
  Funmilayo: { lips: 'Full', bustSize: 'Medium', buttSize: 'Round', buttShape: 'Round' },
  Zainab: { lips: 'Medium', bustSize: 'Small', buttSize: 'Slim', buttShape: 'V-shape' },
  Chiamaka: { lips: 'Very full', bustSize: 'Large', buttSize: 'Very curvy', buttShape: 'Heart' },
  Temitope: { lips: 'Full', bustSize: 'Medium', buttSize: 'Round', buttShape: 'Heart' },
  Ifeoma: { lips: 'Full', bustSize: 'Large', buttSize: 'Round', buttShape: 'Round' },
  Halima: { lips: 'Medium', bustSize: 'Small', buttSize: 'Average', buttShape: 'Square' },
  Damilola: { lips: 'Very full', bustSize: 'Small', buttSize: 'Slim', buttShape: 'V-shape' },
  Ngozi: { lips: 'Full', bustSize: 'Very large', buttSize: 'Very curvy', buttShape: 'Round' },
  Efe: { lips: 'Full', bustSize: 'Medium', buttSize: 'Round', buttShape: 'Heart' },
}

interface Seed {
  name: string
  age: number
  gender: Gender
  nationality: string
  race: string
  profession: string
  jobTitle: string
  city: string
  country: string
  physical: PhysicalProfile
  request: Partial<Omit<PartnerRequest, 'physical'>> & {
    message: string
    seeking: Gender[]
    ages: [number, number]
    physical?: Partial<PhysicalPreferences>
  }
}

const seeds: Seed[] = [
  {
    name: 'Amara', age: 29, gender: 'woman', nationality: 'Nigeria', race: 'Black / African descent',
    profession: 'Healthcare', jobTitle: 'Paediatric nurse', city: 'Lagos', country: 'Nigeria',
    physical: body(170, 'Athletic', 'Deep', 'Brown', 'Black', 'Long', 'Coily', 'None', 'A few'),
    request: {
      message: "I'm looking for a kind, family-oriented man who is ambitious but knows how to switch off. Faith matters to me, and so does a good sense of humour.",
      seeking: ['man'], ages: [28, 40], locations: ['Nigeria', 'United Kingdom'], nationalities: ['Nigeria', 'Ghana'],
      professions: ['Healthcare', 'Engineering', 'Business & finance'],
      physical: { height: ['Tall', 'Very tall'], facialHair: ['Beard', 'Stubble'] },
    },
  },
  {
    name: 'Daniel', age: 33, gender: 'man', nationality: 'United States', race: 'White / European descent',
    profession: 'Engineering', jobTitle: 'Structural engineer', city: 'New York', country: 'United States',
    physical: body(185, 'Athletic', 'Fair', 'Hazel', 'Brown', 'Short', 'Wavy', 'Beard', 'None'),
    request: {
      message: "Someone curious and adventurous who'd rather explore a night market than sit in a fancy restaurant. Bonus points if you can beat me at chess.",
      seeking: ['woman'], ages: [26, 36], locations: ['United States', 'Canada'],
      physical: { hairLength: ['Medium', 'Long'] },
    },
  },
  {
    name: 'Sofia', age: 26, gender: 'woman', nationality: 'Brazil', race: 'Mixed / multiracial',
    profession: 'Creative arts & design', jobTitle: 'Graphic designer', city: 'São Paulo', country: 'Brazil',
    physical: body(162, 'Slim', 'Olive', 'Green', 'Red', 'Medium', 'Curly', 'None', 'Many'),
    request: {
      message: 'Creative soul wanted — musician, painter, anyone who makes things with their hands. Must love dogs and late-night conversations.',
      seeking: ['man', 'woman'], ages: [24, 34], professions: ['Creative arts & design', 'Media & communications'],
      physical: { tattoos: ['A few', 'Many'] },
    },
  },
  {
    name: 'Marcus', age: 31, gender: 'man', nationality: 'United Kingdom', race: 'Black / African descent',
    profession: 'Public service & military', jobTitle: 'Firefighter', city: 'London', country: 'United Kingdom',
    physical: body(190, 'Muscular', 'Brown', 'Brown', 'Black', 'Shaved', 'None', 'Stubble', 'A few'),
    request: {
      message: 'Looking for a confident, warm woman who loves the outdoors and wants to build something real. Kids someday is a must for me.',
      seeking: ['woman'], ages: [25, 35], locations: ['United Kingdom', 'Ireland'],
      physical: {
        bodyType: ['Athletic', 'Curvy', 'Slim'],
        height: ['Petite', 'Average', 'Tall'],
        buttSize: ['Round', 'Very curvy'],
        lips: ['Full', 'Very full'],
      },
    },
  },
  {
    name: 'Priya', age: 35, gender: 'woman', nationality: 'India', race: 'South Asian',
    profession: 'Technology', jobTitle: 'Data scientist', city: 'Toronto', country: 'Canada',
    physical: body(158, 'Average', 'Medium', 'Brown', 'Black', 'Long', 'Straight', 'None', 'None'),
    request: {
      message: 'An emotionally intelligent man who reads, cooks and values family. I am open to relocating within Canada or the US for the right person.',
      seeking: ['man'], ages: [32, 45], locations: ['Canada', 'United States'],
      professions: ['Technology', 'Science & research', 'Education', 'Healthcare'],
      physical: { height: ['Average', 'Tall', 'Very tall'], tattoos: ['None', 'A few'] },
    },
  },
  {
    name: 'Leo', age: 28, gender: 'man', nationality: 'Germany', race: 'White / European descent',
    profession: 'Hospitality & service', jobTitle: 'Bartender', city: 'Berlin', country: 'Germany',
    physical: body(176, 'Slim', 'Very fair', 'Blue', 'Blonde', 'Medium', 'Wavy', 'Moustache', 'Many'),
    request: {
      message: 'A gentle, bearded bear type who likes dancing, cooking together and slow Sundays.',
      seeking: ['man'], ages: [25, 36], locations: ['Germany', 'Netherlands'],
      physical: { bodyType: ['Athletic', 'Muscular', 'Average'], facialHair: ['Stubble', 'Beard'] },
    },
  },
  {
    name: 'Jordan', age: 30, gender: 'nonbinary', nationality: 'Canada', race: 'Mixed / multiracial',
    profession: 'Science & research', jobTitle: 'Ecologist', city: 'Vancouver', country: 'Canada',
    physical: body(172, 'Athletic', 'Olive', 'Grey', 'Dyed', 'Short', 'Straight', 'None', 'A few'),
    request: {
      message: "Someone outdoorsy and gentle who'll go climbing with me on weekends and talk about everything and nothing.",
      seeking: ['woman', 'nonbinary', 'man'], ages: [25, 38], locations: ['Canada'],
    },
  },
  {
    name: 'Grace', age: 41, gender: 'woman', nationality: 'Ireland', race: 'White / European descent',
    profession: 'Healthcare', jobTitle: 'Veterinarian', city: 'Dublin', country: 'Ireland',
    physical: body(175, 'Slim', 'Fair', 'Blue', 'Blonde', 'Medium', 'Straight', 'None', 'None'),
    request: {
      message: 'A grounded, active man with a good laugh who likes dogs as much as I do. Divorcees very welcome.',
      seeking: ['man'], ages: [38, 52], locations: ['Ireland', 'United Kingdom'],
      physical: { height: ['Tall', 'Very tall'], bodyType: ['Slim', 'Athletic', 'Average'] },
    },
  },
  {
    name: 'Ethan', age: 37, gender: 'man', nationality: 'United States', race: 'White / European descent',
    profession: 'Education', jobTitle: 'History teacher', city: 'Boston', country: 'United States',
    physical: body(180, 'Average', 'Fair', 'Green', 'Brown', 'Short', 'Straight', 'Beard', 'None'),
    request: {
      message: 'Looking for a thoughtful woman who loves travel, history and good food. Long-distance is fine for the right person.',
      seeking: ['woman'], ages: [30, 42],
      physical: { hairColor: ['Brown', 'Black', 'Red'] },
    },
  },
  {
    name: 'Yuki', age: 27, gender: 'woman', nationality: 'Japan', race: 'East Asian',
    profession: 'Technology', jobTitle: 'UX researcher', city: 'Tokyo', country: 'Japan',
    physical: body(160, 'Slim', 'Fair', 'Brown', 'Black', 'Short', 'Straight', 'None', 'A few'),
    request: {
      message: 'A creative, quietly confident woman to share ceramics classes and ramen nights with.',
      seeking: ['woman'], ages: [24, 33], locations: ['Japan', 'South Korea'],
      physical: { hairLength: ['Medium', 'Long'] },
    },
  },
  {
    name: 'Mateo', age: 25, gender: 'man', nationality: 'Mexico', race: 'Hispanic / Latino',
    profession: 'Student', jobTitle: 'Marine biology grad student', city: 'Mexico City', country: 'Mexico',
    physical: body(174, 'Athletic', 'Medium', 'Amber', 'Black', 'Medium', 'Curly', 'Stubble', 'None'),
    request: {
      message: 'Someone who loves the ocean, Sunday markets and spontaneous road trips. Spanish speakers get extra points!',
      seeking: ['woman', 'nonbinary'], ages: [22, 30], locations: ['Mexico', 'Spain'],
      physical: { eyeColor: ['Brown', 'Hazel', 'Green'] },
    },
  },
  {
    name: 'Nia', age: 32, gender: 'woman', nationality: 'Jamaica', race: 'Black / African descent',
    profession: 'Law', jobTitle: 'Corporate lawyer', city: 'New York', country: 'United States',
    physical: body(168, 'Curvy', 'Brown', 'Brown', 'Black', 'Medium', 'Coily', 'None', 'None'),
    request: {
      message: "A driven, God-fearing man who's settled in his career and ready for marriage. Must love karaoke and Sunday dinners.",
      seeking: ['man'], ages: [29, 40], locations: ['United States', 'Jamaica'], races: ['Black / African descent'],
      professions: ['Law', 'Business & finance', 'Healthcare', 'Engineering', 'Technology'],
      physical: {
        height: ['Tall', 'Very tall'],
        facialHair: ['Beard', 'Stubble'],
        bodyType: ['Athletic', 'Muscular', 'Average'],
        chest: ['Muscular', 'Broad'],
      },
    },
  },
  {
    name: 'Olivier', age: 45, gender: 'man', nationality: 'France', race: 'White / European descent',
    profession: 'Creative arts & design', jobTitle: 'Jazz pianist', city: 'Paris', country: 'France',
    physical: body(182, 'Average', 'Fair', 'Grey', 'Grey', 'Short', 'Wavy', 'Stubble', 'None'),
    request: {
      message: 'An elegant, funny woman who loves music, wine and long walks along the river.',
      seeking: ['woman'], ages: [36, 50], locations: ['France', 'Belgium', 'Switzerland'],
    },
  },
  {
    name: 'Riley', age: 29, gender: 'nonbinary', nationality: 'Australia', race: 'Mixed / multiracial',
    profession: 'Creative arts & design', jobTitle: 'Tattoo artist', city: 'Melbourne', country: 'Australia',
    physical: body(165, 'Plus-size', 'Medium', 'Hazel', 'Dyed', 'Long', 'Wavy', 'None', 'Many'),
    request: {
      message: 'Looking for a fellow weirdo with tattoos, a soft heart and strong opinions about pottery glazes.',
      seeking: ['nonbinary', 'woman'], ages: [24, 35],
      physical: { tattoos: ['A few', 'Many'] },
    },
  },
  {
    name: 'Kwame', age: 34, gender: 'man', nationality: 'Ghana', race: 'Black / African descent',
    profession: 'Business & finance', jobTitle: 'Investment analyst', city: 'Accra', country: 'Ghana',
    physical: body(183, 'Athletic', 'Deep', 'Brown', 'Black', 'Short', 'Coily', 'Beard', 'None'),
    request: {
      message: "A warm, intelligent woman with her own goals — someone who'll travel the world with me and build a home rooted in faith.",
      seeking: ['woman'], ages: [26, 36], locations: ['Ghana', 'Nigeria', 'United Kingdom', 'United States'],
      races: ['Black / African descent'],
      physical: {
        bodyType: ['Slim', 'Curvy', 'Athletic'],
        height: ['Average', 'Tall'],
        bustSize: ['Medium', 'Large'],
        buttSize: ['Round', 'Very curvy'],
      },
    },
  },
  {
    name: 'Layla', age: 30, gender: 'woman', nationality: 'Lebanon', race: 'Middle Eastern / North African',
    profession: 'Healthcare', jobTitle: 'Dentist', city: 'Dubai', country: 'United Arab Emirates',
    physical: body(166, 'Slim', 'Olive', 'Hazel', 'Brown', 'Long', 'Wavy', 'None', 'None'),
    request: {
      message: 'A respectful, family-oriented man who is established, loves to travel and ideally speaks Arabic or French.',
      seeking: ['man'], ages: [30, 40], locations: ['United Arab Emirates', 'Lebanon', 'France'],
      nationalities: ['Lebanon', 'France', 'Canada'],
      physical: { height: ['Tall', 'Very tall'] },
    },
  },
  {
    name: 'Min-jun', age: 31, gender: 'man', nationality: 'South Korea', race: 'East Asian',
    profession: 'Technology', jobTitle: 'Software engineer', city: 'Seoul', country: 'South Korea',
    physical: body(178, 'Slim', 'Fair', 'Brown', 'Black', 'Short', 'Straight', 'None', 'None'),
    request: {
      message: 'Someone kind and curious who enjoys hiking and trying new cafés. Happy to meet someone abroad who would like to live in Seoul.',
      seeking: ['woman'], ages: [25, 34],
    },
  },
  {
    name: 'Chloe', age: 28, gender: 'woman', nationality: 'United States', race: 'White / European descent',
    profession: 'Media & communications', jobTitle: 'Journalist', city: 'Chicago', country: 'United States',
    physical: body(171, 'Athletic', 'Very fair', 'Blue', 'Red', 'Long', 'Curly', 'None', 'A few'),
    request: {
      message: 'Someone who reads the news and the comics, likes running, and wants a partner in crime for life.',
      seeking: ['man', 'woman'], ages: [26, 38], locations: ['United States'],
      physical: { height: ['Average', 'Tall', 'Very tall'] },
    },
  },

  // ---------- Young Nigerian women ----------
  {
    name: 'Adaeze', age: 24, gender: 'woman', nationality: 'Nigeria', race: 'Black / African descent',
    profession: 'Healthcare', jobTitle: 'House officer (junior doctor)', city: 'Enugu', country: 'Nigeria',
    physical: body(165, 'Slim', 'Brown', 'Brown', 'Black', 'Long', 'Coily', 'None', 'None'),
    request: {
      message: 'I want a patient, God-fearing man who understands that my hours are long and my dreams are big. Must love Igbo highlife and Sunday rice.',
      seeking: ['man'], ages: [26, 35], locations: ['Nigeria'], nationalities: ['Nigeria'],
      professions: ['Healthcare', 'Engineering', 'Business & finance', 'Law'],
      physical: { height: ['Tall', 'Very tall'], chest: ['Toned', 'Muscular'] },
    },
  },
  {
    name: 'Funmilayo', age: 26, gender: 'woman', nationality: 'Nigeria', race: 'Black / African descent',
    profession: 'Technology', jobTitle: 'Product designer at a fintech', city: 'Lagos', country: 'Nigeria',
    physical: body(168, 'Athletic', 'Deep', 'Brown', 'Black', 'Short', 'Coily', 'None', 'A few'),
    request: {
      message: "Looking for a curious, ambitious man who can hold a conversation about anything — tech, Afrobeats, politics, jollof wars. Lagos traffic shouldn't scare you.",
      seeking: ['man'], ages: [27, 38], locations: ['Lagos', 'Abuja', 'United Kingdom'],
      professions: ['Technology', 'Entrepreneur', 'Creative arts & design', 'Business & finance'],
      physical: { height: ['Average', 'Tall', 'Very tall'], facialHair: ['Stubble', 'Beard'] },
    },
  },
  {
    name: 'Zainab', age: 23, gender: 'woman', nationality: 'Nigeria', race: 'Black / African descent',
    profession: 'Law', jobTitle: 'Associate at a law firm', city: 'Abuja', country: 'Nigeria',
    physical: body(163, 'Slim', 'Brown', 'Amber', 'Black', 'Long', 'Curly', 'None', 'None'),
    request: {
      message: 'A respectful, well-mannered man with strong family values and a calm spirit. I love poetry, travel and long drives on a Friday evening.',
      seeking: ['man'], ages: [25, 34], locations: ['Abuja', 'Kaduna', 'Kano'], nationalities: ['Nigeria'],
      physical: { tattoos: ['None'], facialHair: ['Beard', 'Moustache'] },
    },
  },
  {
    name: 'Chiamaka', age: 27, gender: 'woman', nationality: 'Nigeria', race: 'Black / African descent',
    profession: 'Engineering', jobTitle: 'Petroleum engineer', city: 'Port Harcourt', country: 'Nigeria',
    physical: body(172, 'Curvy', 'Deep', 'Brown', 'Black', 'Medium', 'Coily', 'None', 'None'),
    request: {
      message: "I'm a confident, driven woman looking for a man who is secure in himself, supports my career and wants to build a home together. Bonus if you can cook pepper soup.",
      seeking: ['man'], ages: [28, 40], locations: ['Nigeria', 'Ghana'], races: ['Black / African descent'],
      professions: ['Engineering', 'Business & finance', 'Healthcare', 'Entrepreneur'],
      physical: { height: ['Tall', 'Very tall'], bodyType: ['Athletic', 'Muscular'] },
    },
  },
  {
    name: 'Temitope', age: 22, gender: 'woman', nationality: 'Nigeria', race: 'Black / African descent',
    profession: 'Student', jobTitle: 'Final-year pharmacy student', city: 'Ibadan', country: 'Nigeria',
    physical: body(158, 'Average', 'Brown', 'Brown', 'Brown', 'Long', 'Coily', 'None', 'None'),
    request: {
      message: 'Someone kind, funny and serious about his future. I love gospel music, amala on Saturdays and planning surprise birthdays.',
      seeking: ['man'], ages: [23, 30], locations: ['Ibadan', 'Lagos', 'Ogun'],
      physical: { height: ['Average', 'Tall'], lips: ['Medium', 'Full'] },
    },
  },
  {
    name: 'Ifeoma', age: 28, gender: 'woman', nationality: 'Nigeria', race: 'Black / African descent',
    profession: 'Business & finance', jobTitle: 'Relationship manager at a bank', city: 'Lagos', country: 'Nigeria',
    physical: body(170, 'Curvy', 'Medium', 'Hazel', 'Black', 'Long', 'Straight', 'None', 'None'),
    request: {
      message: 'A mature, financially stable man who is ready for marriage and children in the next few years. Honesty and a good sense of humour are non-negotiable.',
      seeking: ['man'], ages: [29, 40], locations: ['Lagos', 'Abuja', 'United Kingdom', 'United States'],
      races: ['Black / African descent'],
      physical: { height: ['Tall', 'Very tall'], bodyType: ['Athletic', 'Average', 'Muscular'] },
    },
  },
  {
    name: 'Halima', age: 25, gender: 'woman', nationality: 'Nigeria', race: 'Black / African descent',
    profession: 'Education', jobTitle: 'Secondary school science teacher', city: 'Kaduna', country: 'Nigeria',
    physical: body(160, 'Slim', 'Medium', 'Brown', 'Black', 'Long', 'Wavy', 'None', 'None'),
    request: {
      message: 'I am looking for a gentle, devout and hardworking man who values education and family. I enjoy reading, cooking tuwo and volunteering with children.',
      seeking: ['man'], ages: [26, 36], locations: ['Kaduna', 'Abuja', 'Kano'], nationalities: ['Nigeria'],
      physical: { tattoos: ['None'] },
    },
  },
  {
    name: 'Damilola', age: 24, gender: 'woman', nationality: 'Nigeria', race: 'Black / African descent',
    profession: 'Creative arts & design', jobTitle: 'Fashion designer (own label)', city: 'Lagos', country: 'Nigeria',
    physical: body(175, 'Slim', 'Deep', 'Brown', 'Dyed', 'Short', 'Coily', 'None', 'A few'),
    request: {
      message: "Creative, stylish and spontaneous — I want a man who isn't afraid of colour and will come with me to every Lagos Fashion Week show.",
      seeking: ['man'], ages: [24, 34], locations: ['Lagos'],
      professions: ['Creative arts & design', 'Media & communications', 'Entrepreneur', 'Technology'],
      physical: { height: ['Tall', 'Very tall'] },
    },
  },
  {
    name: 'Ngozi', age: 29, gender: 'woman', nationality: 'Nigeria', race: 'Black / African descent',
    profession: 'Public service & military', jobTitle: 'Policy analyst', city: 'Abuja', country: 'Nigeria',
    physical: body(166, 'Plus-size', 'Brown', 'Brown', 'Black', 'Medium', 'Curly', 'None', 'None'),
    request: {
      message: 'A thoughtful, well-read man who loves debate, travel and good food. I want a partner, not a project — someone who knows who he is.',
      seeking: ['man'], ages: [30, 42], locations: ['Abuja', 'Lagos', 'Ghana', 'United Kingdom'],
      physical: { facialHair: ['Beard', 'Stubble'] },
    },
  },
  {
    name: 'Efe', age: 26, gender: 'woman', nationality: 'Nigeria', race: 'Black / African descent',
    profession: 'Media & communications', jobTitle: 'Radio presenter', city: 'Benin City', country: 'Nigeria',
    physical: body(162, 'Athletic', 'Deep', 'Brown', 'Black', 'Long', 'Coily', 'None', 'None'),
    request: {
      message: 'Loud laugh, big heart, bigger playlist. Looking for a confident, playful man who loves music and can dance at least a little.',
      seeking: ['man'], ages: [26, 36], locations: ['Nigeria'],
      physical: { height: ['Average', 'Tall', 'Very tall'], chest: ['Toned', 'Muscular', 'Broad'] },
    },
  },
]

// Licensed photos of AI-generated (non-existent) people, named after the member's first
// name, e.g. adaeze.jpg or min-jun.png. See src/assets/demo-photos/README.md. Members
// without a file keep their illustrated portrait.
const DEMO_PHOTOS = import.meta.glob<string>('../assets/demo-photos/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})

const RELATIONSHIP: Record<string, string> = {
  Priya: 'Divorced (without kids)',
  Grace: 'Divorced (with kids)',
  Ethan: 'Divorced (without kids)',
  Olivier: 'Divorced (with kids)',
  Chloe: 'Separated',
  Ifeoma: 'Single parent',
  Ngozi: 'Divorced (without kids)',
  Efe: 'Single parent',
  Riley: 'Single parent',
  // Everyone else is Single.
}

/** Relationship statuses each sample member is open to (unlisted = open to all). */
const WANTED_STATUSES: Record<string, string[]> = {
  Amara: ['Single', 'Divorced (without kids)'],
  Nia: ['Single', 'Divorced (without kids)'],
  Layla: ['Single'],
  Kwame: ['Single', 'Single parent'],
  Zainab: ['Single'],
  Grace: ['Single', 'Divorced (with kids)', 'Divorced (without kids)', 'Widowed (with kids)', 'Widowed (without kids)'],
}

/** Sample members who opted in to a public listing; everyone else stays private. */
const FEATURED = new Set(['Funmilayo', 'Daniel', 'Layla', 'Efe', 'Mateo', 'Grace'])

export const photoSlug =(name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

function demoPhoto(name: string): string | undefined {
  const slug = photoSlug(name)
  return Object.entries(DEMO_PHOTOS).find(([path]) => path.split('/').pop()!.replace(/\.\w+$/, '') === slug)?.[1]
}

export const SAMPLE_PROFILES: Profile[] = seeds.map((s, i) => {
  const { ages, physical, ...rest } = s.request
  const base = emptyRequest()
  return {
    id: `sample-${i + 1}`,
    name: s.name,
    age: s.age,
    gender: s.gender,
    city: s.city,
    country: s.country,
    nationality: s.nationality,
    race: s.race,
    relationshipStatus: RELATIONSHIP[s.name] ?? 'Single',
    profession: s.profession,
    jobTitle: s.jobTitle,
    bio: '',
    photo: demoPhoto(s.name),
    isDemo: true,
    publicListing: FEATURED.has(s.name),
    physical: { ...s.physical, ...EXTRAS[s.name] },
    request: {
      ...base,
      ...rest,
      relationshipStatuses: WANTED_STATUSES[s.name] ?? [],
      ageMin: ages[0],
      ageMax: ages[1],
      physical: { ...base.physical, ...physical },
    },
  }
})
