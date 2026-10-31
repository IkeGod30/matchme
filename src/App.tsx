import { useEffect, useState } from 'react'
import { AuthForm } from './components/public/AuthForm'
import { FeaturedMembers } from './components/public/FeaturedMembers'
import { Landing, type Audience } from './components/public/Landing'
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
import { actions, logOut, useStartStore, useStore } from './lib/store'
import type { Profile } from './types'
import './App.css'

type SeekerView = 'home' | 'profile' | 'edit'
type Screen = 'home' | 'featured' | 'login' | 'signup' | 'forgot' | 'reset' | 'invite' | 'app'

/** One-time links: password reset (/#reset=<token>) and matchmaker invitation (/#invite=<token>). */
interface TokenLink {
  kind: 'reset' | 'invite'
  token: string
}

function linkFromUrl(): TokenLink | null {
  const match = /^#(reset|invite)=([\w-]+)$/.exec(window.location.hash)
  return match ? { kind: match[1] as TokenLink['kind'], token: match[2] } : null
}

const AUDIENCE_KEY = 'matchme.audience'

/** The last category chosen in this browser (a convenience only). */
function loadAudience(): Audience {
  try {
    return localStorage.getItem(AUDIENCE_KEY) === 'matchmaker' ? 'matchmaker' : 'seeker'
  } catch {
    return 'seeker'
  }
}

function saveAudience(audience: Audience) {
  try {
    localStorage.setItem(AUDIENCE_KEY, audience)
  } catch {
    // ignore
  }
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
  const { user, loading, me, matchmaker, data } = useStore()
  const [link, setLink] = useState(linkFromUrl)
  // The featured page has a shareable link: /#featured.
  const [screen, setScreen] = useState<Screen>(() =>
    link ? link.kind : window.location.hash === '#featured' ? 'featured' : 'home',
  )
  const [view, setView] = useState<SeekerView>('home')
  // Seeker or Matchmaker: chosen on the landing page and the log-in / sign-up form.
  const [audience, setAudienceState] = useState<Audience>(loadAudience)

  function setAudience(next: Audience) {
    setAudienceState(next)
    saveAudience(next)
  }

  // A link pasted into a tab that already has the app open only changes the hash.
  useEffect(() => {
    const onHashChange = () => {
      const next = linkFromUrl()
      if (next) {
        setLink(next)
        setScreen(next.kind)
      } else if (window.location.hash === '#featured') {
        setScreen('featured')
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const isMatchmaker = user?.role === 'matchmaker'
  const isPendingMatchmaker = isMatchmaker && user?.status === 'pending'
  // Badge: new requests nobody has taken on yet.
  const newRequests = isMatchmaker
    ? data.requests.filter((r) => !r.matchmakerId && requestStatus(r) === 'new').length
    : 0
  const inApp = screen === 'app'

  function show(next: Screen) {
    setScreen(next)
    // Leaving a reset or invitation screen also drops the one-time token from the address bar.
    const hash = next === 'featured' ? '#featured' : link && next === link.kind ? `#${link.kind}=${link.token}` : ''
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
    }
    window.scrollTo({ top: 0 })
  }

  function openApp(next: SeekerView = 'home') {
    setView(next)
    show('app')
  }

  function startFromLanding() {
    if (user) openApp()
    else show('signup')
  }

  function openAuth(mode: 'login' | 'signup', who: Audience = audience) {
    setAudience(who)
    show(mode)
  }

  /** Seeker side's main button: their area if signed in, otherwise seeker sign-up. */
  function startAsSeeker() {
    if (user) openApp()
    else openAuth('signup', 'seeker')
  }

  /** Matchmaker side's main button: the dashboard for matchmakers, otherwise the application form. */
  function startAsMatchmaker() {
    if (isMatchmaker) openApp()
    else openAuth('signup', 'matchmaker')
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
    if (user?.role === 'seeker' && me) {
      void actions.requestFeatured(memberId)
      return
    }
    saveFeaturedPick(memberId)
    startAsSeeker()
  }

  // Send a remembered pick once the seeker is signed in and has a profile.
  useEffect(() => {
    if (user?.role !== 'seeker' || !me) return
    const pick = loadFeaturedPick()
    if (!pick) return
    clearFeaturedPick()
    void actions.requestFeatured(pick)
  }, [user, me])

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

  const seekerCta = !user
    ? 'Request a match'
    : isMatchmaker
      ? 'Open the dashboard'
      : me
        ? 'Go to my matches'
        : 'Finish your profile'
  const matchmakerCta = isPendingMatchmaker
    ? 'View my application'
    : isMatchmaker
      ? 'Open the dashboard'
      : 'Apply to be a matchmaker'
  const onMatchmakerSide = screen === 'home' && audience === 'matchmaker'

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => show('home')} aria-label="MatchMe home">
          <span className="brand-mark" aria-hidden="true">♥</span> MatchMe
        </button>
        <div className="topbar-right">
          <nav className="tabs">
            <button type="button" aria-current={screen === 'home'} onClick={() => show('home')}>
              Home
            </button>
            <button type="button" aria-current={screen === 'featured'} onClick={() => show('featured')}>
              Featured
            </button>
            {isMatchmaker && (
              <button type="button" aria-current={inApp} onClick={() => openApp()}>
                {isPendingMatchmaker ? 'My application' : 'Dashboard'}{' '}
                {newRequests > 0 && <span className="count">{newRequests}</span>}
              </button>
            )}
            {user?.role === 'seeker' && me && (
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
          {!user && !loading && (
            <button
              type="button"
              className="audience-link"
              onClick={() => {
                setAudience(onMatchmakerSide ? 'seeker' : 'matchmaker')
                show('home')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              {onMatchmakerSide ? 'For seekers' : 'For matchmakers'}
            </button>
          )}
          {user ? (
            <div className="account">
              <span className="muted small" title={user.email}>
                {isPendingMatchmaker
                  ? 'Matchmaker application pending'
                  : isMatchmaker
                    ? `${matchmaker?.me.displayName ?? 'Matchmaker'} · Matchmaker`
                    : `${user.email} · Seeker`}
              </span>
              <button type="button" className="btn ghost small-btn" onClick={handleLogOut}>
                Log out
              </button>
            </div>
          ) : (
            !loading && (
              <div className="account">
                <button type="button" className="btn ghost small-btn" onClick={() => openAuth('login')}>
                  Log in
                </button>
                <button type="button" className="btn primary small-btn" onClick={() => openAuth('signup')}>
                  Sign up
                </button>
              </div>
            )
          )}
        </div>
      </header>

      <main className="content">
        {loading && <p className="muted loading">Loading…</p>}

        {!loading && screen === 'home' && (
          <Landing
            audience={audience}
            onAudience={setAudience}
            signedIn={!!user}
            seekerCta={seekerCta}
            onSeekerStart={startAsSeeker}
            matchmakerCta={matchmakerCta}
            onMatchmakerStart={startAsMatchmaker}
            onLogin={(who) => openAuth('login', who)}
            onFeatured={() => show('featured')}
          />
        )}

        {!loading && screen === 'featured' && (
          <FeaturedMembers
            meId={me?.id ?? null}
            signedIn={!!user}
            canRequest={!isMatchmaker}
            requestedIds={requestedIds}
            onRequestMember={requestMember}
            onRequestMatch={startFromLanding}
          />
        )}

        {!loading && (screen === 'login' || screen === 'signup' || (inApp && !user)) && (
          <AuthForm
            key={`${screen}-${audience}`}
            mode={screen === 'signup' ? 'signup' : 'login'}
            audience={audience}
            onAudience={setAudience}
            onSwitch={() => show(screen === 'signup' ? 'login' : 'signup')}
            onDone={() => openApp('home')}
            onCancel={() => show('home')}
            onForgot={() => show('forgot')}
          />
        )}

        {!loading && screen === 'forgot' && <ForgotPasswordForm onBack={() => show('login')} />}

        {!loading && screen === 'reset' && link?.kind === 'reset' && (
          <ResetPasswordForm token={link.token} onDone={() => openApp('home')} onRequestNew={() => show('forgot')} />
        )}

        {!loading && screen === 'invite' && link?.kind === 'invite' && (
          <MatchmakerSignup token={link.token} onDone={() => openApp()} onCancel={() => show('home')} />
        )}

        {!loading && inApp && isPendingMatchmaker && <ApplicationPending user={user!} onLogOut={handleLogOut} />}
        {!loading && inApp && isMatchmaker && !isPendingMatchmaker && matchmaker && (
          <MatchmakerDashboard data={data} matchmaker={matchmaker} />
        )}

        {!loading && inApp && user?.role === 'seeker' && !me && (
          <ProfileForm initial={newProfile()} isNew onSave={handleCreate} onCancel={() => show('home')} />
        )}
        {!loading && inApp && user?.role === 'seeker' && me && view === 'edit' && (
          <ProfileForm initial={me} isNew={false} onSave={handleUpdate} onCancel={() => setView('profile')} />
        )}
        {!loading && inApp && user?.role === 'seeker' && me && view === 'home' && (
          <SeekerHome me={me} data={data} onEditRequest={() => setView('profile')} />
        )}
        {!loading && inApp && user?.role === 'seeker' && me && view === 'profile' && (
          <ProfileView profile={me} onEdit={() => setView('edit')} onDelete={handleDelete} />
        )}
      </main>
    </div>
  )
}

export default App
