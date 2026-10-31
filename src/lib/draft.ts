import type { Profile } from '../types'

// Keeps an unsaved new-profile draft in this browser, so a reload or a failed save
// doesn't wipe everything the seeker has typed. Cleared once the profile is saved.

const DRAFT_KEY = 'matchme.profileDraft'

export function loadProfileDraft(): Profile | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    const draft = raw ? (JSON.parse(raw) as Profile) : null
    return draft?.physical && draft.request ? draft : null
  } catch {
    return null
  }
}

export function saveProfileDraft(draft: Profile): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Storage full or blocked (e.g. a large photo in private mode): carry on without a draft.
  }
}

export function clearProfileDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // ignore
  }
}

// A featured member picked before signing up or creating a profile; requested once the
// seeker has a profile.

const PICK_KEY = 'matchme.featuredPick'

export function loadFeaturedPick(): string | null {
  try {
    return localStorage.getItem(PICK_KEY)
  } catch {
    return null
  }
}

export function saveFeaturedPick(memberId: string): void {
  try {
    localStorage.setItem(PICK_KEY, memberId)
  } catch {
    // ignore
  }
}

export function clearFeaturedPick(): void {
  try {
    localStorage.removeItem(PICK_KEY)
  } catch {
    // ignore
  }
}
