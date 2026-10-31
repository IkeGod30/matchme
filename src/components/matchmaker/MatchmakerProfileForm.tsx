import { useState, type ChangeEvent, type FormEvent } from 'react'
import { resizeImage } from '../../lib/format'
import { actions } from '../../lib/store'
import type { TeamMember } from '../../types'
import { MatchmakerAvatar, MatchmakerCard } from '../shared/MatchmakerCard'
import { TagInput } from '../shared/TagInput'

const LANGUAGES = ['English', 'Yoruba', 'Igbo', 'Hausa', 'Pidgin', 'French', 'Arabic', 'Twi', 'Swahili', 'Spanish', 'Portuguese']

/** The signed-in matchmaker edits what seekers see about them. */
export function MatchmakerProfileForm({ matchmaker }: { matchmaker: TeamMember }) {
  const [displayName, setDisplayName] = useState(matchmaker.displayName)
  const [bio, setBio] = useState(matchmaker.bio)
  const [specialties, setSpecialties] = useState(matchmaker.specialties)
  const [languages, setLanguages] = useState(matchmaker.languages)
  /** undefined = unchanged, null = removed, string = new data URL. */
  const [photo, setPhoto] = useState<string | null | undefined>(undefined)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const previewPhoto = photo === undefined ? matchmaker.photo : (photo ?? undefined)

  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setPhoto(await resizeImage(file))
      setSaved(false)
    } catch (error) {
      alert((error as Error).message)
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    const result = await actions.saveMatchmakerProfile({ displayName, bio, specialties, languages, photo })
    setBusy(false)
    if (result) {
      setPhoto(undefined)
      setSaved(true)
    }
  }

  const touch = <T,>(set: (value: T) => void) => (value: T) => {
    set(value)
    setSaved(false)
  }

  return (
    <section className="profile-view">
      <form className="card stack" onSubmit={save}>
        <h2>My matchmaker profile</h2>
        <p className="muted small">Seekers whose requests you look after see this on their request page.</p>
        <div className="photo-actions">
          <MatchmakerAvatar matchmaker={{ displayName, photo: previewPhoto }} size={72} />
          <label className="btn ghost small-btn">
            {previewPhoto ? 'Change photo' : 'Upload a photo'}
            <input type="file" accept="image/*" hidden onChange={onPhoto} />
          </label>
          {previewPhoto && (
            <button type="button" className="link-btn" onClick={() => touch(setPhoto)(null)}>
              Remove photo
            </button>
          )}
        </div>
        <label className="field">
          <span>Name seekers see</span>
          <input value={displayName} maxLength={60} required onChange={(e) => touch(setDisplayName)(e.target.value)} />
        </label>
        <label className="field">
          <span>About you</span>
          <textarea
            rows={4}
            maxLength={1000}
            value={bio}
            placeholder="Your experience, your approach, and what seekers can expect from you."
            onChange={(e) => touch(setBio)(e.target.value)}
          />
        </label>
        <TagInput
          label="Specialties"
          hint="e.g. marriage-minded professionals, diaspora, over-40s"
          placeholder="Type a specialty and press Enter"
          values={specialties}
          onChange={touch(setSpecialties)}
        />
        <TagInput
          label="Languages"
          placeholder="Type a language and press Enter"
          values={languages}
          suggestions={LANGUAGES}
          onChange={touch(setLanguages)}
        />
        <div className="form-actions">
          {saved && <span className="muted small saved-note">Saved ✓</span>}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>

      <div className="stack">
        <p className="criteria-title">How seekers see you</p>
        <MatchmakerCard matchmaker={{ ...matchmaker, displayName, bio, specialties, languages, photo: previewPhoto }} />
        <p className="muted small">Signed in as {matchmaker.email}.</p>
      </div>
    </section>
  )
}
