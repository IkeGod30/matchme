import { useState } from 'react'
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

  const me = data.profiles.find((p) => p.id === seekerId) ?? null
  const newRequests = data.requests.filter((r) => requestStatus(r) === 'new').length

  function switchRole(next: Role) {
    saveRole(next)
    setRole(next)
    window.scrollTo({ top: 0 })
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
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true">♥</span> MatchMe
        </span>
        <div className="topbar-right">
          {role === 'seeker' && me && view !== 'edit' && (
            <nav className="tabs">
              <button type="button" aria-current={view === 'home'} onClick={() => setView('home')}>
                My matches
              </button>
              <button type="button" aria-current={view === 'profile'} onClick={() => setView('profile')}>
                My profile
              </button>
            </nav>
          )}
          <div className="role-switch" role="group" aria-label="View as">
            <button type="button" aria-pressed={role === 'seeker'} onClick={() => switchRole('seeker')}>
              Seeker
            </button>
            <button type="button" aria-pressed={role === 'matchmaker'} onClick={() => switchRole('matchmaker')}>
              Matchmaker
              {newRequests > 0 && <span className="count">{newRequests}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="content">
        {role === 'matchmaker' && <MatchmakerDashboard data={data} />}

        {role === 'seeker' && !me && !started && (
          <section className="hero">
            <h1>Tell us who you're looking for. Your matchmaker does the rest.</h1>
            <p className="muted">
              Describe yourself and the partner you hope to meet — their location, background, profession and the
              physical features you're drawn to, chosen from pictures. A matchmaker hand-picks people for you, and you
              decide who to meet.
            </p>
            <ol className="how">
              <li>
                <strong>Describe your ideal partner</strong>
                <span>A message, background and picture-based preferences</span>
              </li>
              <li>
                <strong>Your matchmaker searches</strong>
                <span>They review your request and pick candidates</span>
              </li>
              <li>
                <strong>Accept or decline</strong>
                <span>See their pictures and say yes to an introduction</span>
              </li>
            </ol>
            <button type="button" className="btn primary large" onClick={() => setStarted(true)}>
              Get started
            </button>
          </section>
        )}

        {role === 'seeker' && !me && started && (
          <ProfileForm initial={newProfile()} isNew onSave={handleCreate} onCancel={() => setStarted(false)} />
        )}

        {role === 'seeker' && me && view === 'edit' && (
          <ProfileForm initial={me} isNew={false} onSave={handleUpdate} onCancel={() => setView('profile')} />
        )}
        {role === 'seeker' && me && view === 'home' && (
          <SeekerHome me={me} data={data} onEditRequest={() => setView('profile')} />
        )}
        {role === 'seeker' && me && view === 'profile' && (
          <ProfileView profile={me} onEdit={() => setView('edit')} onDelete={handleDelete} />
        )}
      </main>
    </div>
  )
}

export default App
