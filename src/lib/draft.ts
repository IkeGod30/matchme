import type { Profile } from '../types'

// Keeps an unsaved new-profile draft in this browser, so a reload or a failed save
// doesn't wipe everything the seeker has typed. Cleared once the profile is saved.

const DRAFT_KEY = 'matchmehub.profileDraft'
const PICK_KEY = 'matchmehub.featuredPick'

// Carry over anything saved under the keys used before the rename to MatchMeHub.
try {
  for (const key of [DRAFT_KEY, PICK_KEY]) {
    const old = key.replace('matchmehub.', 'matchme.')
    const value = localStorage.getItem(old)
    if (value !== null) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
      localStorage.removeItem(old)
    }
  }
} catch {
  // Storage blocked: nothing to carry over.
}

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
    // Storage full (several photos can be too big for it) or blocked: keep the rest of the
    // draft without the photos, or carry on without a draft.
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, photo: undefined, photos: [] }))
    } catch {
      // ignore
    }
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
