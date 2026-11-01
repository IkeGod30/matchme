import { useEffect, useState } from 'react'
import { AuthForm } from './components/public/AuthForm'
import { FeaturedMembers } from './components/public/FeaturedMembers'
import { Landing, MatchmakerLanding } from './components/public/Landing'
import { ApplicationPending } from './components/matchmaker/ApplicationPending'
import { MatchmakerSignup } from './components/public/MatchmakerSignup'
import { ForgotPasswordForm, ResetPasswordForm } from './components/public/PasswordReset'
import { MatchmakerDashboard } from './components/matchmaker/MatchmakerDashboard'
import { ProfileForm } from './components/seeker/ProfileForm'
import { ProfileView } from './components/seeker/ProfileView'
import { SeekerHome } from './components/seeker/SeekerHome'
import { emptyPhysical, emptyRequest } from './data/attributes'
import { clearFeaturedPick, clearProfileDraft, loadFeaturedPick, saveFeaturedPick } from './lib/draft'
import { latestRequestFor, requestStatus } from './lib/requests'
import { actions, logOut, setArea, staffLogOut, useStartStore, useStore, type Area } from './lib/store'
import type { Profile } from './types'
import './App.css'

type SeekerView = 'home' | 'profile' | 'edit'
type Screen =
  | 'home'
  | 'featured'
  | 'login'
  | 'signup'
  | 'forgot'
  | 'reset'
  | 'invite'
  | 'app'
  // Matchmaker recruitment (public page, linked from the footer).
  | 'join'
  // The backoffice (/#staff): its own area with a separate staff log-in and session. The
  // matchmaker application and invitation sign-up create staff accounts, so they're part of it.
  | 'staff'
  | 'staff-forgot'
  | 'apply'

const BACKOFFICE_SCREENS: Screen[] = ['staff', 'staff-forgot', 'apply', 'invite']

/** Pages with a shareable / bookmarkable link. */
const PAGE_HASHES: Partial<Record<Screen, string>> = { featured: '#featured', join: '#join', staff: '#staff' }

function screenFromHash(): Screen | undefined {
  return (Object.keys(PAGE_HASHES) as Screen[]).find((s) => PAGE_HASHES[s] === window.location.hash)
}

/** One-time links: password reset (/#reset=<token>) and matchmaker invitation (/#invite=<token>). */
interface TokenLink {
  kind: 'reset' | 'invite'
  token: string
}

function linkFromUrl(): TokenLink | null {
  const match = /^#(reset|invite)=([\w-]+)$/.exec(window.location.hash)
  return match ? { kind: match[1] as TokenLink['kind'], token: match[2] } : null
}

function newProfile(): Profile {
  return {
    id: crypto.randomUUID(), // replaced by the server's id on first save
    name: '',
    age: 25,
    gender: 'woman',
    city: '',
    country: '',
    nationality: '',
    race: '',
    relationshipStatus: '',
    profession: '',
    jobTitle: '',
    bio: '',
    physical: emptyPhysical(),
    request: emptyRequest(),
  }
}

function App() {
  useStartStore()
  const { seeker, staff, loading, me, matchmaker, data } = useStore()
  const [link, setLink] = useState(linkFromUrl)
  const [screen, setScreen] = useState<Screen>(() => link?.kind ?? screenFromHash() ?? 'home')
  const [view, setView] = useState<SeekerView>('home')

  // A link pasted into a tab that already has the app open only changes the hash.
  useEffect(() => {
    const onHashChange = () => {
      const next = linkFromUrl()
      if (next) {
        setLink(next)
        setScreen(next.kind)
      } else {
        const page = screenFromHash()
        if (page) setScreen(page)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // The backoffice is a separate area with its own (staff) session; everything else is the
  // public site, which only ever uses the seeker session.
  const area: Area = BACKOFFICE_SCREENS.includes(screen) ? 'backoffice' : 'site'
  useEffect(() => setArea(area), [area])

  // Matchmaker recruitment (#join) is off-limits to signed-in seekers. However they get there
  // (a typed URL, a bookmark, back/forward), they see the home page instead, and #join is
  // dropped from the address bar.
  const joinBlocked = screen === 'join' && !!seeker
  const page: Screen = joinBlocked ? 'home' : screen
  useEffect(() => {
    if (joinBlocked) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }, [joinBlocked])

  // Only one realm is signed in at a time, in both directions — but only on an explicit click.
  // Clicking into the backoffice signs a seeker out before the staff log-in, and "Sign out & go
  // to site" signs staff out. Loading a page (a typed URL, a reload, another tab) signs no one
  // out; the area just ignores the other realm's session. (The server still ends the other
  // session when someone logs in or signs up.) A note says which session was ended.
  const [signedOutOf, setSignedOutOf] = useState<'seeker' | 'staff' | null>(null)

  const isPendingStaff = staff?.status === 'pending'
  // Badge: new requests nobody has taken on yet.
  const newRequests = data.requests.filter((r) => !r.matchmakerId && requestStatus(r) === 'new').length
  const inApp = screen === 'app'

  function show(next: Screen) {
    setScreen(next)
    setSignedOutOf(null)
    // Leaving a reset or invitation screen also drops the one-time token from the address bar.
    const hash = PAGE_HASHES[next] ?? (link && next === link.kind ? `#${link.kind}=${link.token}` : '')
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
    }
    window.scrollTo({ top: 0 })
  }

  function openApp(next: SeekerView = 'home') {
    setView(next)
    show('app')
  }

  /** Main seeker buttons: their area if signed in, otherwise seeker sign-up. */
  function startAsSeeker() {
    if (seeker) openApp()
    else show('signup')
  }

  /** A click from the public site into the backoffice: signs a seeker out first. */
  async function enterBackoffice(next: Screen = 'staff') {
    if (seeker) {
      // Don't leave one person's unsaved draft or pick for the next person on this computer.
      clearProfileDraft()
      clearFeaturedPick()
      await logOut()
      show(next)
      setSignedOutOf('seeker')
    } else {
      show(next)
    }
  }

  /** "Sign out & go to site" in the backoffice: signs staff out, then opens the public site. */
  async function exitToSite() {
    if (staff) {
      await staffLogOut()
      show('home')
      setSignedOutOf('staff')
    } else {
      show('home')
    }
  }

  /** Recruitment page's main button: the backoffice for staff, otherwise the application form. */
  function startAsMatchmaker() {
    void enterBackoffice(staff ? 'staff' : 'apply')
  }

  // The seeker's open request, and who is already asked for or proposed on it.
  const latest = me ? latestRequestFor(data.requests, me.id) : undefined
  const openRequest = latest && !latest.closedAt ? latest : undefined
  const requestedIds = new Set([
    ...(openRequest?.requestedMembers ?? []).map((a) => a.candidateId),
    ...(openRequest?.proposals ?? []).map((p) => p.candidateId),
  ])

  /** "Request a match with …" on a featured card. Without a profile yet, the pick waits until there is one. */
  function requestMember(memberId: string) {
    if (seeker && me) {
      void actions.requestFeatured(memberId)
      return
    }
    saveFeaturedPick(memberId)
    startAsSeeker()
  }

  // Send a remembered pick once the seeker is signed in and has a profile.
  useEffect(() => {
    if (!seeker || !me || area !== 'site') return
    const pick = loadFeaturedPick()
    if (!pick) return
    clearFeaturedPick()
    void actions.requestFeatured(pick)
  }, [seeker, me, area])

  async function handleCreate(profile: Profile) {
    // A remembered featured pick opens the request itself (see the effect above).
    const pick = loadFeaturedPick()
    if (await actions.saveProfile(profile)) {
      clearProfileDraft()
      if (!pick) await actions.submitRequest()
      openApp('home')
    }
  }

  async function handleUpdate(profile: Profile) {
    if (await actions.saveProfile(profile)) openApp('profile')
  }

  async function handleDelete() {
    if (!confirm('Delete your account, profile and match requests? This cannot be undone.')) return
    await actions.deleteProfile()
    show('home')
  }

  async function handleLogOut() {
    // Don't leave one person's unsaved draft or pick for the next person on this computer.
    clearProfileDraft()
    clearFeaturedPick()
    await logOut()
    show('home')
  }

  /** Signs out of the backoffice only; a seeker session in this browser stays signed in. */
  async function handleStaffLogOut() {
    await staffLogOut()
    show('staff')
  }

  const seekerCta = !seeker ? 'Request a match' : me ? 'Go to my matches' : 'Finish your profile'
  const matchmakerCta = !staff ? 'Apply to be a matchmaker' : isPendingStaff ? 'View my application' : 'Open the backoffice'
  // Public log-in / sign-up forms (seekers only).
  const authScreen = screen === 'login' || screen === 'signup' || (inApp && !seeker)
  const signedOutNotice =
    signedOutOf === 'seeker'
      ? 'You’ve been signed out of your seeker account. The backoffice uses a separate staff account.'
      : undefined

  if (area === 'backoffice') {
    return (
      <div className="app">
        <header className="topbar backoffice">
          <button type="button" className="brand" onClick={() => show('staff')} aria-label="MatchMe backoffice">
            <span className="brand-mark" aria-hidden="true">♥</span> MatchMe <span className="backoffice-tag">Backoffice</span>
          </button>
          <div className="topbar-right">
            {staff && !isPendingStaff && newRequests > 0 && (
              <span className="muted small">
                <span className="count">{newRequests}</span> new {newRequests === 1 ? 'request' : 'requests'}
              </span>
            )}
            {staff && (
              <div className="account">
                <span className="muted small" title={staff.email}>
                  {isPendingStaff ? 'Application pending' : (matchmaker?.me.displayName ?? staff.email)}
                </span>
                <button type="button" className="btn ghost small-btn" onClick={handleStaffLogOut}>
                  Log out
                </button>
              </div>
            )}
            <button
              type="button"
              className="link-btn back-to-site"
              onClick={exitToSite}
              title={staff ? 'The public site uses a separate seeker account' : undefined}
            >
              {staff ? 'Sign out & go to site' : '← Back to site'}
            </button>
          </div>
        </header>

        <main className="content">
          {loading && <p className="muted loading">Loading…</p>}

          {!loading && screen === 'staff-forgot' && (
            <ForgotPasswordForm realm="staff" onBack={() => show('staff')} />
          )}

          {/* A separate staff log-in, even when a seeker is signed in on this browser. */}
          {!loading && screen === 'staff' && !staff && (
            <AuthForm
              key="staff"
              mode="login"
              audience="matchmaker"
              onSwitch={() => show('apply')}
              onDone={() => show('staff')}
              onCancel={() => show('home')}
              onForgot={() => show('staff-forgot')}
              notice={signedOutNotice}
            />
          )}
          {!loading && screen === 'apply' && (
            <AuthForm
              key="apply"
              mode="signup"
              audience="matchmaker"
              onSwitch={() => show('staff')}
              onDone={() => show('staff')}
              onCancel={() => show('join')}
              onForgot={() => show('staff-forgot')}
              notice={signedOutNotice}
            />
          )}
          {!loading && screen === 'invite' && link?.kind === 'invite' && (
            <MatchmakerSignup token={link.token} onDone={() => show('staff')} onCancel={() => show('home')} />
          )}
          {!loading && screen === 'staff' && isPendingStaff && (
            <ApplicationPending user={staff!} onLogOut={handleStaffLogOut} />
          )}
          {!loading && screen === 'staff' && staff && !isPendingStaff && (
            matchmaker ? <MatchmakerDashboard data={data} matchmaker={matchmaker} /> : <p className="muted loading">Loading…</p>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => show('home')} aria-label="MatchMe home">
          <span className="brand-mark" aria-hidden="true">♥</span> MatchMe
        </button>
        <div className="topbar-right">
          <nav className="tabs">
            <button type="button" aria-current={page === 'home'} onClick={() => show('home')}>
              Home
            </button>
            <button type="button" aria-current={screen === 'featured'} onClick={() => show('featured')}>
              Featured
            </button>
            {seeker && me && (
              <>
                <button type="button" aria-current={inApp && view === 'home'} onClick={() => openApp('home')}>
                  My matches
                </button>
                <button
                  type="button"
                  aria-current={inApp && (view === 'profile' || view === 'edit')}
                  onClick={() => openApp('profile')}
                >
                  My profile
                </button>
              </>
            )}
          </nav>
          {seeker ? (
            <div className="account">
              <span className="muted small" title={seeker.email}>
                {seeker.email}
              </span>
              <button type="button" className="btn ghost small-btn" onClick={handleLogOut}>
                Log out
              </button>
            </div>
          ) : (
            !loading && (
              <div className="account">
                <button type="button" className="btn ghost small-btn" onClick={() => show('login')}>
                  Log in
                </button>
                <button type="button" className="btn primary small-btn" onClick={() => show('signup')}>
                  Sign up
                </button>
              </div>
            )
          )}
        </div>
      </header>

      <main className="content">
        {loading && <p className="muted loading">Loading…</p>}

        {signedOutOf === 'staff' && (
          <p className="auth-notice small" role="status">
            You’ve been signed out of the backoffice. The public site uses a separate seeker account.
          </p>
        )}

        {!loading && page === 'home' && (
          <Landing
            ctaLabel={seekerCta}
            onStart={startAsSeeker}
            onLogin={seeker ? undefined : () => show('login')}
            onFeatured={() => show('featured')}
            onJoin={seeker ? undefined : () => show('join')}
            onStaffLogin={() => void enterBackoffice()}
          />
        )}

        {!loading && page === 'join' && (
          <MatchmakerLanding
            ctaLabel={matchmakerCta}
            onStart={startAsMatchmaker}
            onLogin={staff ? undefined : () => void enterBackoffice()}
            onFeatured={() => show('featured')}
            onSwitch={() => show('home')}
          />
        )}

        {!loading && screen === 'featured' && (
          <FeaturedMembers
            meId={me?.id ?? null}
            signedIn={!!seeker}
            canRequest
            requestedIds={requestedIds}
            onRequestMember={requestMember}
            onRequestMatch={startAsSeeker}
          />
        )}

        {!loading && authScreen && (
          <AuthForm
            key={screen}
            mode={screen === 'signup' ? 'signup' : 'login'}
            audience="seeker"
            onSwitch={() => show(screen === 'signup' ? 'login' : 'signup')}
            onDone={() => openApp('home')}
            onCancel={() => show('home')}
            onForgot={() => show('forgot')}
          />
        )}

        {!loading && screen === 'forgot' && <ForgotPasswordForm realm="seeker" onBack={() => show('login')} />}

        {!loading && screen === 'reset' && link?.kind === 'reset' && (
          <ResetPasswordForm
            token={link.token}
            onDone={(realm) => (realm === 'staff' ? show('staff') : openApp('home'))}
            onRequestNew={() => show('forgot')}
          />
        )}

        {!loading && inApp && seeker && !me && (
          <ProfileForm initial={newProfile()} isNew onSave={handleCreate} onCancel={() => show('home')} />
        )}
        {!loading && inApp && seeker && me && view === 'edit' && (
          <ProfileForm initial={me} isNew={false} onSave={handleUpdate} onCancel={() => setView('profile')} />
        )}
        {!loading && inApp && seeker && me && view === 'home' && (
          <SeekerHome me={me} data={data} onEditRequest={() => setView('profile')} />
        )}
        {!loading && inApp && seeker && me && view === 'profile' && (
          <ProfileView profile={me} onEdit={() => setView('edit')} onDelete={handleDelete} />
        )}
      </main>
    </div>
  )
}

export default App
