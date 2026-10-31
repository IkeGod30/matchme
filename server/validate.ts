import { RELATIONSHIP_STATUSES } from '../src/data/options.ts'
import type { Gender, Profile } from '../src/types.ts'
import { BadRequest } from './photos.ts'

const GENDERS: Gender[] = ['woman', 'man', 'nonbinary']

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

function text(value: unknown, field: string, max: number, required = false): string {
  if (typeof value !== 'string') throw new BadRequest(`${field} is missing.`)
  const trimmed = value.trim()
  if (required && !trimmed) throw new BadRequest(`${field} is required.`)
  if (trimmed.length > max) throw new BadRequest(`${field} is too long (max ${max} characters).`)
  return trimmed
}

function int(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new BadRequest(`${field} must be a whole number between ${min} and ${max}.`)
  }
  return value
}

/**
 * Checks the shape of a profile sent by a seeker and returns a clean copy.
 * The server owns id, photo, isDemo and publicListing, so those are dropped here.
 */
export function validateProfile(input: unknown): Omit<Profile, 'id' | 'photo' | 'isDemo' | 'publicListing'> {
  if (!isObject(input)) throw new BadRequest('Profile is missing.')
  const { physical, request } = input
  if (!isObject(physical) || !isObject(request) || !isObject(request.physical)) {
    throw new BadRequest('Profile is incomplete.')
  }
  if (!GENDERS.includes(input.gender as Gender)) throw new BadRequest('Gender is invalid.')
  const seeking = request.seeking
  if (!Array.isArray(seeking) || seeking.length === 0 || !seeking.every((g) => GENDERS.includes(g as Gender))) {
    throw new BadRequest('Choose who you are interested in.')
  }
  const ageMin = int(request.ageMin, 'Partner minimum age', 18, 99)
  const ageMax = int(request.ageMax, 'Partner maximum age', 18, 99)
  if (ageMin > ageMax) throw new BadRequest('Partner age range is invalid.')

  const physicalClean: Record<string, string | number> = {
    heightCm: int(physical.heightCm, 'Height', 100, 250),
  }
  for (const [key, value] of Object.entries(physical)) {
    if (key !== 'heightCm') physicalClean[key] = text(value, `Physical ${key}`, 40)
  }
  const wanted: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(request.physical)) {
    if (!isStringArray(value)) throw new BadRequest(`Preference ${key} is invalid.`)
    wanted[key] = value.slice(0, 20).map((v) => text(v, `Preference ${key}`, 40))
  }
  const list = (value: unknown, field: string) => {
    if (!isStringArray(value)) throw new BadRequest(`${field} is invalid.`)
    return value.slice(0, 40).map((v) => text(v, field, 80))
  }

  const relationshipStatus = text(input.relationshipStatus, 'Relationship status', 40, true)
  if (!RELATIONSHIP_STATUSES.includes(relationshipStatus)) throw new BadRequest('Relationship status is invalid.')
  const relationshipStatuses = list(request.relationshipStatuses ?? [], 'Relationship statuses')
  if (relationshipStatuses.some((s) => !RELATIONSHIP_STATUSES.includes(s))) {
    throw new BadRequest('Relationship status preference is invalid.')
  }

  return {
    name: text(input.name, 'Name', 80, true),
    age: int(input.age, 'Age', 18, 99),
    gender: input.gender as Gender,
    city: text(input.city, 'City', 80, true),
    country: text(input.country, 'Country', 80, true),
    nationality: text(input.nationality, 'Nationality', 80, true),
    race: text(input.race, 'Race', 80, true),
    relationshipStatus,
    profession: text(input.profession, 'Profession', 80, true),
    jobTitle: text(input.jobTitle ?? '', 'Job title', 120),
    bio: text(input.bio ?? '', 'About me', 2000),
    physical: physicalClean as Profile['physical'],
    request: {
      message: text(request.message, 'Request message', 4000, true),
      seeking: seeking as Gender[],
      ageMin,
      ageMax,
      locations: list(request.locations, 'Locations'),
      races: list(request.races, 'Races'),
      nationalities: list(request.nationalities, 'Nationalities'),
      professions: list(request.professions, 'Professions'),
      relationshipStatuses,
      physical: wanted as Profile['request']['physical'],
    },
  }
}
