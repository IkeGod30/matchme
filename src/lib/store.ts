import { useEffect, useSyncExternalStore } from 'react'
import type {
  Application,
  CandidateResponse,
  Invite,
  MatchmakerProfile,
  MatchRequest,
  Profile,
  ProposalResponse,
  TeamMember,
} from '../types'
import { api, ApiError } from './api'

// Client-side cache of what the server lets the signed-in user see. Every action calls
// the API and then reloads, so the server stays the single source of truth.

export type Role = 'seeker' | 'matchmaker'

export interface User {
  id: string
  email: string
  role: Role
  /** 'pending' = a matchmaker whose application hasn't been approved yet. */
  status: 'active' | 'pending'
}

export interface AppData {
  /** Members visible to the current user (all of them for the matchmaker). */
  profiles: Profile[]
  requests: MatchRequest[]
  /** Real-life example photos uploaded by the matchmaker, keyed by exampleKey(). */
  examples: Record<string, string>
}

/** What only matchmakers receive: their own profile, the team and pending invitations. */
export interface MatchmakerData {
  me: TeamMember
  team: TeamMember[]
  invites: Invite[]
  applications: Application[]
}

interface State {
  user: User | null
  /** True until the first session check finishes. */
  loading: boolean
  /** The signed-in seeker's own profile, if they've created one. */
  me: Profile | null
  /** Set when the signed-in user is a matchmaker. */
  matchmaker: MatchmakerData | null
  data: AppData
  featured: Profile[]
}

export const exampleKey = (feature: string, option: string) => `${feature}:${option}`

const EMPTY: AppData = { profiles: [], requests: [], examples: {} }

let state: State = { user: null, loading: true, me: null, matchmaker: null, data: EMPTY, featured: [] }
const listeners = new Set<() => void>()

function setState(patch: Partial<State>) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useStore(): State {
  return useSyncExternalStore(subscribe, () => state)
}

export function useAppData(): AppData {
  return useStore().data
}

export function allMembers(d: AppData): Profile[] {
  return d.profiles
}

export function findMember(d: AppData, id: string): Profile | undefined {
  return d.profiles.find((p) => p.id === id)
}

/* ---------- Loading ---------- */

interface SeekerState {
  profile: Profile | null
  requests: MatchRequest[]
  incoming: MatchRequest[]
  members: Profile[]
}

async function loadExamples(): Promise<Record<string, string>> {
  return (await api<{ examples: Record<string, string> }>('GET', '/examples')).examples
}

/** Reloads everything the current user can see. */
export async function refresh(): Promise<void> {
  const examples = await loadExamples().catch(() => state.data.examples)
  const { user } = state
  if (!user) {
    setState({ me: null, matchmaker: null, data: { ...EMPTY, examples } })
    return
  }
  try {
    if (user.role === 'matchmaker' && user.status === 'pending') {
      // Applicants see nothing until a teammate approves them.
      setState({ me: null, matchmaker: null, data: { ...EMPTY, examples } })
    } else if (user.role === 'matchmaker') {
      const res = await api<MatchmakerData & { profiles: Profile[]; requests: MatchRequest[] }>('GET', '/matchmaker/state')
      setState({
        me: null,
        matchmaker: { me: res.me, team: res.team, invites: res.invites, applications: res.applications },
        data: { profiles: res.profiles, requests: res.requests, examples },
      })
    } else {
      const res = await api<SeekerState>('GET', '/seeker/state')
      setState({
        matchmaker: null,
        me: res.profile,
        data: {
          profiles: res.profile ? [res.profile, ...res.members] : res.members,
          requests: [...res.requests, ...res.incoming],
          examples,
        },
      })
    }
  } catch (error) {
    // Session expired or revoked: fall back to logged out.
    if (error instanceof ApiError && error.status === 401) {
      setState({ user: null, me: null, matchmaker: null, data: { ...EMPTY, examples } })
    }
      else throw error
  }
}

let started = false

/** Checks the session once, then keeps data fresh while the tab is in use. */
export function useStartStore() {
  useEffect(() => {
    if (started) return
    started = true
    void (async () => {
      try {
        const { user } = await api<{ user: User | null }>('GET', '/auth/me')
        setState({ user })
        await refresh()
      } catch (error) {
        console.error(error)
      } finally {
        setState({ loading: false })
      }
    })()
    const tick = () => {
      if (!state.user || document.visibilityState !== 'visible') return
      // A pending matchmaker's status can change (approval), so re-check the session itself.
      ;(state.user.status === 'pending' ? reloadSession() : refresh()).catch(console.error)
    }
    window.addEventListener('focus', tick)
    window.setInterval(tick, 20_000)
  }, [])
}

export async function loadFeatured(): Promise<void> {
  const { members } = await api<{ members: PublicCard[] }>('GET', '/public/featured')
  setState({ featured: members.map(fromPublicCard) })
}

/** Loads the public Featured list when a component using it mounts. */
export function useFeatured(): Profile[] {
  const { featured } = useStore()
  useEffect(() => {
    loadFeatured().catch(console.error)
  }, [])
  return featured
}

interface PublicCard {
  id: string
  name: string
  age: number
  gender: Profile['gender']
  city: string
  profession: string
  jobTitle: string
  bio: string
  photo?: string
  isDemo: boolean
  lookingFor: string
  portrait: Partial<Profile['physical']>
}

/** Public cards carry only shared fields; fill the rest with blanks so existing components can render them. */
function fromPublicCard(c: PublicCard): Profile {
  return {
    id: c.id,
    name: c.name,
    age: c.age,
    gender: c.gender,
    city: c.city,
    country: '',
    nationality: '',
    race: '',
    relationshipStatus: '', // private: never on public cards
    profession: c.profession,
    jobTitle: c.jobTitle,
    bio: c.bio,
    photo: c.photo,
    isDemo: c.isDemo,
    publicListing: true,
    physical: { heightCm: 0, ...c.portrait } as Profile['physical'],
    request: {
      message: c.lookingFor,
      seeking: [],
      ageMin: 18,
      ageMax: 99,
      locations: [],
      races: [],
      nationalities: [],
      professions: [],
      relationshipStatuses: [],
      physical: {} as Profile['request']['physical'],
    },
  }
}

/* ---------- Auth ---------- */

export async function signUp(email: string, password: string): Promise<void> {
  const { user } = await api<{ user: User }>('POST', '/auth/signup', { email, password })
  setState({ user })
  await refresh()
}

export async function logIn(email: string, password: string): Promise<User> {
  const { user } = await api<{ user: User }>('POST', '/auth/login', { email, password })
  setState({ user })
  await refresh()
  return user
}

/** Emails a reset link if the account exists. The server answers the same either way. */
export async function requestPasswordReset(email: string): Promise<void> {
  await api('POST', '/auth/forgot', { email })
}

/** Sets a new password using the token from a reset link, then signs the user in. */
export async function resetPassword(token: string, password: string): Promise<User> {
  const { user } = await api<{ user: User }>('POST', '/auth/reset', { token, password })
  setState({ user })
  await refresh()
  return user
}

export async function logOut(): Promise<void> {
  await api('POST', '/auth/logout').catch(() => undefined)
  setState({ user: null, me: null, matchmaker: null })
  await refresh()
}

/** Re-checks the session, e.g. so a pending matchmaker sees when they've been approved. */
export async function reloadSession(): Promise<void> {
  const { user } = await api<{ user: User | null }>('GET', '/auth/me')
  setState({ user })
  await refresh()
}

export interface MatchmakerApplication {
  email: string
  password: string
  displayName: string
  experience: string
  languages: string[]
  agreeConfidentiality: boolean
}

/** Public application to become a matchmaker; the account stays pending until approved. */
export async function applyAsMatchmaker(application: MatchmakerApplication): Promise<User> {
  const { user } = await api<{ user: User }>('POST', '/auth/apply-matchmaker', application)
  setState({ user })
  await refresh()
  return user
}

/** Checks a matchmaker invitation link before showing the sign-up form. */
export async function checkInvite(token: string): Promise<{ valid: boolean; email: string | null }> {
  return api('GET', `/public/invites/${encodeURIComponent(token)}`)
}

export async function signUpMatchmaker(token: string, email: string, password: string, displayName: string): Promise<User> {
  const { user } = await api<{ user: User }>('POST', '/auth/signup-matchmaker', { token, email, password, displayName })
  setState({ user })
  await refresh()
  return user
}

/* ---------- Actions ---------- */

/** Runs an API call, reloads data, and shows any error to the user. */
async function perform<T>(call: () => Promise<T>): Promise<T | undefined> {
  try {
    const result = await call()
    await refresh()
    return result
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Something went wrong.')
    await refresh().catch(() => undefined)
    return undefined
  }
}

const isServerPhoto = (photo: string | undefined) => !!photo && photo.startsWith('/api/')

export const actions = {
  /** Saves the seeker's own profile. A new data-URL photo is uploaded; a removed photo is deleted. */
  saveProfile(profile: Profile) {
    const { photo, ...rest } = profile
    return perform(() =>
      api<{ profile: Profile }>('PUT', '/seeker/profile', {
        profile: rest,
        publicListing: !!profile.publicListing,
        photo: isServerPhoto(photo) ? undefined : (photo ?? null),
      }),
    )
  },

  /** Deletes the signed-in seeker's account, profile and requests, then logs out. */
  async deleteProfile() {
    await perform(() => api('DELETE', '/seeker/account'))
    setState({ user: null, me: null })
    await refresh()
  },

  submitRequest() {
    return perform(() => api('POST', '/seeker/requests'))
  },

  respond(_requestId: string, proposalId: string, response: Exclude<ProposalResponse, 'pending'>, comment: string) {
    return perform(() => api('POST', `/seeker/proposals/${proposalId}/respond`, { response, comment }))
  },

  /** The proposed person's answer — by the member themselves, or recorded by the matchmaker. */
  recordCandidateResponse(_requestId: string, proposalId: string, answer: Exclude<CandidateResponse, 'pending'>, comment = '') {
    const scope = state.user?.role === 'matchmaker' ? 'matchmaker' : 'seeker'
    return perform(() => api('POST', `/${scope}/proposals/${proposalId}/interest`, { answer, comment }))
  },

  /** Placeholder payment: the server records a test reference. */
  async recordPayment(_requestId: string, proposalId: string): Promise<string | undefined> {
    const res = await perform(() => api<{ paymentRef: string }>('POST', `/seeker/proposals/${proposalId}/pay`))
    return res?.paymentRef
  },

  askForMore(requestId: string) {
    return perform(() => api('POST', `/seeker/requests/${requestId}/more`))
  },

  closeRequest(requestId: string) {
    const scope = state.user?.role === 'matchmaker' ? 'matchmaker' : 'seeker'
    return perform(() => api('POST', `/${scope}/requests/${requestId}/close`))
  },

  sendProposals(requestId: string, picks: { candidateId: string; note: string }[], message: string) {
    return perform(() => api('POST', `/matchmaker/requests/${requestId}/proposals`, { picks, message }))
  },

  /** Claims (own id), hands over (teammate's id) or releases (null) a request. */
  assignRequest(requestId: string, matchmakerId: string | null) {
    return perform(() => api('POST', `/matchmaker/requests/${requestId}/assign`, { matchmakerId }))
  },

  addInternalNote(requestId: string, text: string) {
    return perform(() => api('POST', `/matchmaker/requests/${requestId}/internal-notes`, { text }))
  },

  /** Updates the signed-in matchmaker's profile. A data-URL photo is uploaded; null removes it. */
  saveMatchmakerProfile(profile: Omit<MatchmakerProfile, 'id' | 'photo'> & { photo?: string | null }) {
    return perform(() => api('PUT', '/matchmaker/profile', profile))
  },

  /** Creates an invitation link (emailed too when an address is given). */
  createInvite(email: string) {
    return perform(() => api<{ link: string; emailed: boolean }>('POST', '/matchmaker/invites', { email }))
  },

  revokeInvite(inviteId: string) {
    return perform(() => api('DELETE', `/matchmaker/invites/${inviteId}`))
  },

  approveApplication(applicantId: string) {
    return perform(() => api('POST', `/matchmaker/applications/${applicantId}/approve`))
  },

  declineApplication(applicantId: string) {
    return perform(() => api('POST', `/matchmaker/applications/${applicantId}/decline`))
  },

  /** Sets or (with null) removes the example photo for one feature option. */
  async setExample(feature: string, option: string, photo: string | null): Promise<boolean> {
    return (await perform(() => api('PUT', '/matchmaker/examples', { feature, option, photo }))) !== undefined
  },
}
