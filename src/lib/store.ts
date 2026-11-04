import { useEffect, useSyncExternalStore } from 'react'
import type {
  AdminData,
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
//
// Seekers (public site), matchmakers (backoffice, /matchmaker) and super users (/admin) are
// separate realms with separate sessions, and only one is signed in per browser: the server
// ends the other realms' sessions whenever one starts, and these helpers mirror that. `area`
// says which part of the app is showing, and `data` always holds that area's view.

/** State after a seeker session starts: the other realms' sessions have been ended. */
const asSeeker = (user: User): Partial<State> => ({ seeker: user, staff: null, matchmaker: null, admin: null, adminData: null })
/** State after a staff session starts: the other realms' sessions have been ended. */
const asStaff = (user: User): Partial<State> => ({ staff: user, seeker: null, me: null, admin: null, adminData: null })
/** State after a super-user session starts: the other realms' sessions have been ended. */
const asAdmin = (user: User): Partial<State> => ({ admin: user, seeker: null, me: null, staff: null, matchmaker: null })

export type Role = 'seeker' | 'matchmaker' | 'admin'

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
}

/** Which part of the app is showing: the public site (seekers), the backoffice (matchmakers) or /admin. */
export type Area = 'site' | 'backoffice' | 'admin'

interface State {
  /** Signed-in seeker (public site realm). */
  seeker: User | null
  /** Signed-in matchmaker (backoffice realm). */
  staff: User | null
  /** Signed-in super user (/admin realm). */
  admin: User | null
  area: Area
  /** True until the first session check finishes. */
  loading: boolean
  /** The signed-in seeker's own profile, if they've created one. */
  me: Profile | null
  /** Loaded in the backoffice for an approved matchmaker. */
  matchmaker: MatchmakerData | null
  /** Loaded in /admin for a super user. */
  adminData: AdminData | null
  data: AppData
  featured: Profile[]
}

export const exampleKey = (feature: string, option: string) => `${feature}:${option}`

const EMPTY: AppData = { profiles: [], requests: [], examples: {} }

let state: State = {
  seeker: null,
  staff: null,
  admin: null,
  area: 'site',
  loading: true,
  me: null,
  matchmaker: null,
  adminData: null,
  data: EMPTY,
  featured: [],
}
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

/** Reloads everything the signed-in user of the current area can see. */
export async function refresh(): Promise<void> {
  const examples = await loadExamples().catch(() => state.data.examples)
  try {
    if (state.area === 'admin') {
      if (!state.admin) {
        setState({ adminData: null, data: { ...EMPTY, examples } })
        return
      }
      const res = await api<AdminData>('GET', '/admin/state')
      if (state.area !== 'admin') return // left /admin while loading
      setState({ adminData: res, data: { ...EMPTY, examples } })
    } else if (state.area === 'backoffice') {
      const { staff } = state
      // Applicants see nothing until a teammate approves them.
      if (!staff || staff.status === 'pending') {
        setState({ matchmaker: null, data: { ...EMPTY, examples } })
        return
      }
      const res = await api<MatchmakerData & { profiles: Profile[]; requests: MatchRequest[] }>('GET', '/matchmaker/state')
      if (state.area !== 'backoffice') return // left the backoffice while loading
      setState({
        matchmaker: { me: res.me, team: res.team, invites: res.invites },
        data: { profiles: res.profiles, requests: res.requests, examples },
      })
    } else {
      if (!state.seeker) {
        setState({ me: null, data: { ...EMPTY, examples } })
        return
      }
      const res = await api<SeekerState>('GET', '/seeker/state')
      if (state.area !== 'site') return
      setState({
        me: res.profile,
        data: {
          profiles: res.profile ? [res.profile, ...res.members] : res.members,
          requests: [...res.requests, ...res.incoming],
          examples,
        },
      })
    }
  } catch (error) {
    // Session expired or revoked: sign out of that realm only.
    if (error instanceof ApiError && error.status === 401) {
      if (state.area === 'admin') setState({ admin: null, adminData: null, data: { ...EMPTY, examples } })
      else if (state.area === 'backoffice') setState({ staff: null, matchmaker: null, data: { ...EMPTY, examples } })
      else setState({ seeker: null, me: null, data: { ...EMPTY, examples } })
    } else throw error
  }
}

/** Switches between the public site and the backoffice, loading that area's data. */
export function setArea(area: Area): void {
  if (state.area === area) return
  setState({ area, data: { ...EMPTY, examples: state.data.examples } })
  refresh().catch(console.error)
}

let started = false

/** Checks the session once, then keeps data fresh while the tab is in use. */
export function useStartStore() {
  useEffect(() => {
    if (started) return
    started = true
    void (async () => {
      try {
        const [seeker, staff, admin] = await Promise.all([
          api<{ user: User | null }>('GET', '/auth/me'),
          api<{ user: User | null }>('GET', '/auth/staff/me'),
          api<{ user: User | null }>('GET', '/auth/admin/me'),
        ])
        setState({ seeker: seeker.user, staff: staff.user, admin: admin.user })
        await refresh()
      } catch (error) {
        console.error(error)
      } finally {
        setState({ loading: false })
      }
    })()
    const tick = () => {
      const user = state.area === 'admin' ? state.admin : state.area === 'backoffice' ? state.staff : state.seeker
      if (!user || document.visibilityState !== 'visible') return
      // A pending matchmaker's status can change (approval), so re-check the session itself.
      ;(user.status === 'pending' ? reloadStaffSession() : refresh()).catch(console.error)
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

/* ---------- Auth: seekers (public site) ---------- */

export async function signUp(email: string, password: string): Promise<void> {
  const { user } = await api<{ user: User }>('POST', '/auth/signup', { email, password })
  setState(asSeeker(user))
  await refresh()
}

/** Seeker log-in. Staff accounts are rejected here; they use staffLogIn. */
export async function logIn(email: string, password: string): Promise<User> {
  const { user } = await api<{ user: User }>('POST', '/auth/login', { email, password })
  setState(asSeeker(user))
  await refresh()
  return user
}

export async function logOut(): Promise<void> {
  await api('POST', '/auth/logout').catch(() => undefined)
  setState({ seeker: null, me: null })
  await refresh()
}

/* ---------- Auth: matchmakers (backoffice) ---------- */

/** Staff log-in. Seeker accounts are rejected here, even with the right password. */
export async function staffLogIn(email: string, password: string): Promise<User> {
  const { user } = await api<{ user: User }>('POST', '/auth/staff/login', { email, password })
  setState(asStaff(user))
  await refresh()
  return user
}

export async function staffLogOut(): Promise<void> {
  await api('POST', '/auth/staff/logout').catch(() => undefined)
  setState({ staff: null, matchmaker: null })
  await refresh()
}

/** Re-checks the staff session, e.g. so a pending matchmaker sees when they've been approved. */
export async function reloadStaffSession(): Promise<void> {
  const { user } = await api<{ user: User | null }>('GET', '/auth/staff/me')
  setState({ staff: user })
  await refresh()
}

/* ---------- Auth: super users (/admin) ---------- */

/** Super-user log-in. Seeker and matchmaker accounts are rejected here. */
export async function adminLogIn(email: string, password: string): Promise<User> {
  const { user } = await api<{ user: User }>('POST', '/auth/admin/login', { email, password })
  setState(asAdmin(user))
  await refresh()
  return user
}

export async function adminLogOut(): Promise<void> {
  await api('POST', '/auth/admin/logout').catch(() => undefined)
  setState({ admin: null, adminData: null })
  await refresh()
}

/* ---------- Password reset (per realm) ---------- */

export type Realm = 'seeker' | 'staff' | 'admin'

/** Emails a reset link if an account exists in that realm. The server answers the same either way. */
export async function requestPasswordReset(email: string, realm: Realm): Promise<void> {
  await api('POST', '/auth/forgot', { email, realm })
}

/** Sets a new password using the token from a reset link, then signs in to that account's realm. */
export async function resetPassword(token: string, password: string): Promise<Realm> {
  const { user, realm } = await api<{ user: User; realm: Realm }>('POST', '/auth/reset', { token, password })
  setState(realm === 'admin' ? asAdmin(user) : realm === 'staff' ? asStaff(user) : asSeeker(user))
  await refresh()
  return realm
}

export interface MatchmakerApplication {
  email: string
  password: string
  displayName: string
  experience: string
  languages: string[]
  agreeConfidentiality: boolean
}

/**
 * Public application to become a matchmaker. Nobody is signed in: the account stays pending
 * until a super user approves it, and the applicant hears by email.
 */
export async function applyAsMatchmaker(application: MatchmakerApplication): Promise<void> {
  await api('POST', '/auth/apply-matchmaker', application)
}

/** Checks a matchmaker invitation link before showing the sign-up form. */
export async function checkInvite(token: string): Promise<{ valid: boolean; email: string | null }> {
  return api('GET', `/public/invites/${encodeURIComponent(token)}`)
}

export async function signUpMatchmaker(token: string, email: string, password: string, displayName: string): Promise<User> {
  const { user } = await api<{ user: User }>('POST', '/auth/signup-matchmaker', { token, email, password, displayName })
  setState(asStaff(user))
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

export const actions = {
  /**
   * Saves the seeker's own profile. `photos` is the full list in order: their current photos by
   * URL, new ones as data URLs. Photos left out are deleted; the first one is the main photo.
   */
  saveProfile(profile: Profile) {
    const { photo: _photo, photos, ...rest } = profile
    return perform(() =>
      api<{ profile: Profile }>('PUT', '/seeker/profile', {
        profile: rest,
        publicListing: !!profile.publicListing,
        photos: photos ?? [],
      }),
    )
  },

  /** Deletes the signed-in seeker's account, profile and requests, then logs out. */
  async deleteProfile() {
    await perform(() => api('DELETE', '/seeker/account'))
    setState({ seeker: null, me: null })
    await refresh()
  },

  submitRequest() {
    return perform(() => api('POST', '/seeker/requests'))
  },

  /** Asks to be matched with a featured member (opens a request if there isn't one). */
  requestFeatured(memberId: string) {
    return perform(() => api('POST', `/seeker/featured/${memberId}/request`))
  },

  respond(_requestId: string, proposalId: string, response: Exclude<ProposalResponse, 'pending'>, comment: string) {
    return perform(() => api('POST', `/seeker/proposals/${proposalId}/respond`, { response, comment }))
  },

  /** The proposed person's answer — by the member themselves, or recorded by the matchmaker. */
  recordCandidateResponse(_requestId: string, proposalId: string, answer: Exclude<CandidateResponse, 'pending'>, comment = '') {
    const scope = state.area === 'backoffice' ? 'matchmaker' : 'seeker'
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
    const scope = state.area === 'backoffice' ? 'matchmaker' : 'seeker'
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

  /** Sets or (with null) removes the example photo for one feature option. */
  async setExample(feature: string, option: string, photo: string | null): Promise<boolean> {
    return (await perform(() => api('PUT', '/matchmaker/examples', { feature, option, photo }))) !== undefined
  },
}

/** What super users can do in /admin. Each reloads the account lists afterwards. */
export const adminActions = {
  approveApplication(applicantId: string) {
    return perform(() => api('POST', `/admin/applications/${applicantId}/approve`))
  },

  declineApplication(applicantId: string) {
    return perform(() => api('POST', `/admin/applications/${applicantId}/decline`))
  },

  suspend(accountId: string) {
    return perform(() => api('POST', `/admin/accounts/${accountId}/suspend`))
  },

  reactivate(accountId: string) {
    return perform(() => api('POST', `/admin/accounts/${accountId}/reactivate`))
  },

  /** Permanently deletes the account; for a super user, removes their super-user rights. */
  remove(accountId: string) {
    return perform(() => api('DELETE', `/admin/accounts/${accountId}`))
  },

  sendPasswordReset(accountId: string) {
    return perform(() => api('POST', `/admin/accounts/${accountId}/password-reset`))
  },

  /** Gives a matchmaker a separate super-user account; they set its password from an email. */
  promote(accountId: string) {
    return perform(() => api('POST', `/admin/accounts/${accountId}/promote`))
  },

  /** A seeker's full profile, for review. */
  async loadSeeker(accountId: string): Promise<Profile | null> {
    return (await api<{ profile: Profile | null }>('GET', `/admin/seekers/${accountId}`)).profile
  },
}
