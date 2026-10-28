import { useState } from 'react'
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
  // The landing page is the home page: shown on load (except in matchmaker tabs) and via the logo.
  const [onHome, setOnHome] = useState(() => loadRole() !== 'matchmaker')

  const me = data.profiles.find((p) => p.id === seekerId) ?? null
  const newRequests = data.requests.filter((r) => requestStatus(r) === 'new').length
  // A seeker with no profile who hasn't started onboarding has nowhere else to be.
  const showLanding = onHome || (role === 'seeker' && !me && !started)

  function switchRole(next: Role) {
    saveRole(next)
    setRole(next)
    setOnHome(false)
    window.scrollTo({ top: 0 })
  }

  function goHome() {
    setOnHome(true)
    window.scrollTo({ top: 0 })
  }

  function startFromLanding() {
    saveRole('seeker')
    setRole('seeker')
    setOnHome(false)
    if (me) setView('home')
    else setStarted(true)
    window.scrollTo({ top: 0 })
  }

  function openSeekerView(next: SeekerView) {
    setOnHome(false)
    setView(next)
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
    setOnHome(true)
  }

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand" onClick={goHome} aria-label="MatchMe home">
          <span className="brand-mark" aria-hidden="true">♥</span> MatchMe
        </button>
        <div className="topbar-right">
          <nav className="tabs">
            <button type="button" aria-current={showLanding} onClick={goHome}>
              Home
            </button>
            {role === 'seeker' && me && view !== 'edit' && (
              <>
                <button
                  type="button"
                  aria-current={!showLanding && view === 'home'}
                  onClick={() => openSeekerView('home')}
                >
                  My matches
                </button>
                <button
                  type="button"
                  aria-current={!showLanding && view === 'profile'}
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
              aria-pressed={!showLanding && role === 'seeker'}
              onClick={() => (me || started ? switchRole('seeker') : startFromLanding())}
            >
              Seeker
            </button>
            <button
              type="button"
              aria-pressed={!showLanding && role === 'matchmaker'}
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
          />
        )}

        {!showLanding && role === 'matchmaker' && <MatchmakerDashboard data={data} />}

        {!showLanding && role === 'seeker' && !me && started && (
          <ProfileForm initial={newProfile()} isNew onSave={handleCreate} onCancel={() => setStarted(false)} />
        )}

        {!showLanding && role === 'seeker' && me && view === 'edit' && (
          <ProfileForm initial={me} isNew={false} onSave={handleUpdate} onCancel={() => setView('profile')} />
        )}
        {!showLanding && role === 'seeker' && me && view === 'home' && (
          <SeekerHome me={me} data={data} onEditRequest={() => setView('profile')} />
        )}
        {!showLanding && role === 'seeker' && me && view === 'profile' && (
          <ProfileView profile={me} onEdit={() => setView('edit')} onDelete={handleDelete} />
        )}
      </main>
    </div>
  )
}

export default App
