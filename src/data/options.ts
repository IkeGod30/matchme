export const RACES = [
  'Black / African descent',
  'East Asian',
  'South Asian',
  'Southeast Asian',
  'Hispanic / Latino',
  'Middle Eastern / North African',
  'White / European descent',
  'Pacific Islander',
  'Indigenous',
  'Mixed / multiracial',
]

export const RELATIONSHIP_STATUSES = [
  'Single',
  'Single parent',
  'Separated',
  'Divorced (with kids)',
  'Divorced (without kids)',
  'Widowed (with kids)',
  'Widowed (without kids)',
]

export const PROFESSIONS = [
  'Healthcare',
  'Technology',
  'Engineering',
  'Education',
  'Business & finance',
  'Law',
  'Creative arts & design',
  'Media & communications',
  'Science & research',
  'Skilled trades',
  'Hospitality & service',
  'Public service & military',
  'Entrepreneur',
  'Student',
  'Other',
]

export const COUNTRIES = [
  'Argentina', 'Australia', 'Austria', 'Bangladesh', 'Belgium', 'Brazil', 'Cameroon', 'Canada', 'Chile', 'China',
  'Colombia', 'Côte d’Ivoire', 'Denmark', 'Egypt', 'Ethiopia', 'Finland', 'France', 'Germany', 'Ghana', 'Greece',
  'India', 'Indonesia', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Kenya', 'Lebanon', 'Malaysia',
  'Mexico', 'Morocco', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Pakistan', 'Peru', 'Philippines',
  'Poland', 'Portugal', 'Russia', 'Saudi Arabia', 'Senegal', 'Singapore', 'South Africa', 'South Korea', 'Spain',
  'Sweden', 'Switzerland', 'Tanzania', 'Thailand', 'Trinidad and Tobago', 'Turkey', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Vietnam', 'Zimbabwe',
]

/** How a seeker would like their matchmaker to reach them. */
export const CONTACT_METHODS = ['Phone call', 'WhatsApp', 'Text message', 'Email'] as const
export type ContactMethod = (typeof CONTACT_METHODS)[number]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[\d\s().-]+$/

/** What's wrong with a preferred contact, or null if it's usable. Shared by the form and the server. */
export function contactProblem(method: string, value: string): string | null {
  if (!CONTACT_METHODS.includes(method as ContactMethod)) return 'Choose how you’d like to be contacted.'
  const v = value.trim()
  if (method === 'Email') return EMAIL_RE.test(v) ? null : 'Enter a valid email address for your preferred contact.'
  const digits = v.replace(/\D/g, '').length
  return PHONE_RE.test(v) && digits >= 7 && digits <= 15
    ? null
    : 'Enter a valid phone number for your preferred contact, including the country code (e.g. +234 803 123 4567).'
}
