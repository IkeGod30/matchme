// Per-browser session: which seeker profile is "me" (shared across tabs) and
// which role this tab is showing (per tab, so seeker and matchmaker tabs can coexist).

export type Role = 'seeker' | 'matchmaker'

const SEEKER_KEY = 'matchme.seekerId'
const ROLE_KEY = 'matchme.role'

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key)
  } catch {
    return null
  }
}

function write(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) storage().removeItem(key)
    else storage().setItem(key, value)
  } catch {
    // ignore
  }
}

export const loadSeekerId = () => read(() => localStorage, SEEKER_KEY)
export const saveSeekerId = (id: string | null) => write(() => localStorage, SEEKER_KEY, id)
export const loadRole = (): Role => (read(() => sessionStorage, ROLE_KEY) === 'matchmaker' ? 'matchmaker' : 'seeker')
export const saveRole = (role: Role) => write(() => sessionStorage, ROLE_KEY, role)
