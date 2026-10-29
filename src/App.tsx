import { useState } from 'react'
import { FeaturedMembers } from './components/FeaturedMembers'
import { Landing } from './components/Landing'
import { MatchmakerDashboard } from './components/MatchmakerDashboard'
import { ProfileForm } from './components/ProfileForm'
import { ProfileView } from './components/ProfileView'
import { SeekerHome } from './components/SeekerHome'
import { emptyPhysical, emptyRequest } from './data/attributes'
import { requestStatus } from './lib/requests'
import { loadRole, loadSeekerId, saveRole, saveSeekerId, type Role } from './lib/session'
import { actions, useAppData } from './lib/store'
import type { Profile } from './types'
import './App.css'

type SeekerView = 'home' | 'profile' | 'edit'
type PublicScreen = 'home' | 'featured'

function newProfile(): Profile {
  return {
    id: crypto.randomUUID(),
    name: '',
    age: 25,
    gender: 'woman',
    city: '',
    country: '',
    nationality: '',
    race: '',
    profession: '',
    jobTitle: '',
    bio: '',
    physical: emptyPhysical(),
    request: emptyRequest(),
  }
}

function App() {
  const data = useAppData()
  const [role, setRole] = useState<Role>(loadRole)
  const [seekerId, setSeekerId] = useState<string | null>(loadSeekerId)
  const [view, setView] = useState<SeekerView>('home')
  const [started, setStarted] = useState(false)
  // Public pages (home/landing and featured members) sit in front of the role-based app.
  // Home is shown on load, except in tabs switched to the matchmaker role.
  // The featured page has a shareable link: /#featured.
  const [screen, setScreen] = useState<PublicScreen | null>(() => {
    if (window.location.hash === '#featured') return 'featured'
    return loadRole() === 'matchmaker' ? null : 'home'
  })

  const me = data.profiles.find((p) => p.id === seekerId) ?? null
  const newRequests = data.requests.filter((r) => requestStatus(r) === 'new').length
  // A seeker with no profile who hasn't started onboarding has nowhere else to be.
  const showLanding = screen === 'home' || (screen === null && role === 'seeker' && !me && !started)
  const showFeatured = screen === 'featured'
  const inApp = !showLanding && !showFeatured

  function show(next: PublicScreen | null) {
    setScreen(next)
    const hash = next === 'featured' ? '#featured' : ''
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
    }
    window.scrollTo({ top: 0 })
  }

  function switchRole(next: Role) {
    saveRole(next)
    setRole(next)
    show(null)
  }

  function startFromLanding() {
    saveRole('seeker')
    setRole('seeker')
    if (me) setView('home')
    else setStarted(true)
    show(null)
  }

  function openSeekerView(next: SeekerView) {
    setView(next)
    show(null)
  }

  function handleCreate(profile: Profile) {
    actions.saveProfile(profile)
    actions.submitRequest(profile.id)
    saveSeekerId(profile.id)
    setSeekerId(profile.id)
    setView('home')
    window.scrollTo({ top: 0 })
  }

  function handleUpdate(profile: Profile) {
    actions.saveProfile(profile)
    setView('profile')
    window.scrollTo({ top: 0 })
  }

  function handleDelete() {
    if (!me || !confirm('Delete your profile and match requests? This cannot be undone.')) return
    actions.deleteProfile(me.id)
    saveSeekerId(null)
    setSeekerId(null)
    setStarted(false)
    setView('home')
    show('home')
  }

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => show('home')} aria-label="MatchMe home">
          <span className="brand-mark" aria-hidden="true">♥</span> MatchMe
        </button>
        <div className="topbar-right">
          <nav className="tabs">
            <button type="button" aria-current={showLanding} onClick={() => show('home')}>
              Home
            </button>
            <button type="button" aria-current={showFeatured} onClick={() => show('featured')}>
              Featured
            </button>
            {role === 'seeker' && me && view !== 'edit' && (
              <>
                <button
                  type="button"
                  aria-current={inApp && view === 'home'}
                  onClick={() => openSeekerView('home')}
                >
                  My matches
                </button>
                <button
                  type="button"
                  aria-current={inApp && view === 'profile'}
                  onClick={() => openSeekerView('profile')}
                >
                  My profile
                </button>
              </>
            )}
          </nav>
          <div className="role-switch" role="group" aria-label="View as">
            <button
              type="button"
              aria-pressed={inApp && role === 'seeker'}
              onClick={() => (me || started ? switchRole('seeker') : startFromLanding())}
            >
              Seeker
            </button>
            <button
              type="button"
              aria-pressed={inApp && role === 'matchmaker'}
              onClick={() => switchRole('matchmaker')}
            >
              Matchmaker
              {newRequests > 0 && <span className="count">{newRequests}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="content">
        {showLanding && (
          <Landing
            ctaLabel={me ? 'Go to my matches' : 'Request a match'}
            onStart={startFromLanding}
            onMatchmaker={() => switchRole('matchmaker')}
            onFeatured={() => show('featured')}
          />
        )}

        {showFeatured && <FeaturedMembers data={data} meId={me?.id ?? null} onRequestMatch={startFromLanding} />}

        {inApp && role === 'matchmaker' && <MatchmakerDashboard data={data} />}

        {inApp && role === 'seeker' && !me && started && (
          <ProfileForm initial={newProfile()} isNew onSave={handleCreate} onCancel={() => setStarted(false)} />
        )}

        {inApp && role === 'seeker' && me && view === 'edit' && (
          <ProfileForm initial={me} isNew={false} onSave={handleUpdate} onCancel={() => setView('profile')} />
        )}
        {inApp && role === 'seeker' && me && view === 'home' && (
          <SeekerHome me={me} data={data} onEditRequest={() => setView('profile')} />
        )}
        {inApp && role === 'seeker' && me && view === 'profile' && (
          <ProfileView profile={me} onEdit={() => setView('edit')} onDelete={handleDelete} />
        )}
      </main>
    </div>
  )
}

export default App
