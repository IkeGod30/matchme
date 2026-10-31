import { useState, type FormEvent } from 'react'
import { applyAsMatchmaker, logIn, signUp, type User } from '../../lib/store'
import { TagInput } from '../shared/TagInput'
import { AudienceToggle, type Audience } from './Landing'

const LANGUAGES = ['English', 'Yoruba', 'Igbo', 'Hausa', 'Pidgin', 'French', 'Arabic', 'Twi', 'Swahili', 'Spanish', 'Portuguese']

interface AuthFormProps {
  mode: 'login' | 'signup'
  audience: Audience
  onAudience: (audience: Audience) => void
  onSwitch: () => void
  onDone: (user: User | null) => void
  onCancel: () => void
  onForgot: () => void
}

const TITLES: Record<Audience, Record<AuthFormProps['mode'], string>> = {
  seeker: { login: 'Seeker log in', signup: 'Create your seeker account' },
  matchmaker: { login: 'Matchmaker log in', signup: 'Apply to be a matchmaker' },
}

const INTROS: Record<Audience, Record<AuthFormProps['mode'], string>> = {
  seeker: {
    login: 'Welcome back. Log in to see your matches and your request.',
    signup:
      'Your account keeps your profile and request private — only you, your matchmaker and the people you’re matched with can see them.',
  },
  matchmaker: {
    login: 'Log in to your matchmaker dashboard, or check on your application.',
    signup:
      'Tell us about yourself. A matchmaker on the team reviews every application — you’ll see members and requests once you’re approved. Invited by a teammate? Use the link in your email instead.',
  },
}

export function AuthForm({ mode, audience, onAudience, onSwitch, onDone, onCancel, onForgot }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [experience, setExperience] = useState('')
  const [languages, setLanguages] = useState<string[]>([])
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const signup = mode === 'signup'
  const applying = signup && audience === 'matchmaker'

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (signup && password !== confirm) return setError('Passwords don’t match.')
    if (applying && !agree) return setError('Please agree to keep members’ information confidential.')
    setBusy(true)
    try {
      if (applying) {
        onDone(await applyAsMatchmaker({ email, password, displayName, experience, languages, agreeConfidentiality: agree }))
      } else if (signup) {
        await signUp(email, password)
        onDone(null)
      } else {
        onDone(await logIn(email, password))
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <AudienceToggle audience={audience} onChange={onAudience} />
      <form className="card auth-form" onSubmit={submit}>
        <h2>{TITLES[audience][mode]}</h2>
        <p className="muted small">{INTROS[audience][mode]}</p>

        {applying && (
          <label className="field">
            <span>Your name (seekers will see this)</span>
            <input value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} required autoFocus />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus={!applying}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete={signup ? 'new-password' : 'current-password'}
            minLength={signup ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {signup && <span className="hint small">At least 8 characters.</span>}
        </label>
        {!signup && (
          <button type="button" className="link-btn forgot-link" onClick={onForgot}>
            Forgot your password?
          </button>
        )}
        {signup && (
          <label className="field">
            <span>Confirm password</span>
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </label>
        )}

        {applying && (
          <>
            <label className="field">
              <span>Your matchmaking experience</span>
              <textarea
                rows={4}
                maxLength={2000}
                value={experience}
                placeholder="e.g. I’ve introduced couples in my church community for eight years and…"
                onChange={(e) => setExperience(e.target.value)}
                required
              />
              <span className="hint small">At least 30 characters. This becomes the start of your profile.</span>
            </label>
            <TagInput
              label="Languages you speak"
              placeholder="Type a language and press Enter"
              values={languages}
              suggestions={LANGUAGES}
              onChange={setLanguages}
            />
            <label className="check agree">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              I’ll keep members’ information confidential, share a member’s profile only with people I propose them to,
              and never contact members outside MatchMe for personal reasons.
            </label>
          </>
        )}

        {error && (
          <p className="errors" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Please wait…' : applying ? 'Submit application' : signup ? 'Create account' : 'Log in'}
          </button>
        </div>
        <p className="small auth-switch">
          {signup ? 'Already have an account?' : audience === 'seeker' ? 'New to MatchMe?' : 'Want to join the team?'}{' '}
          <button type="button" className="link-btn" onClick={onSwitch}>
            {signup ? 'Log in' : audience === 'seeker' ? 'Create an account' : 'Apply to be a matchmaker'}
          </button>
        </p>
      </form>
    </div>
  )
}
