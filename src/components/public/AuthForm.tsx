import { useState, type FormEvent } from 'react'
import { adminLogIn, applyAsMatchmaker, logIn, signUp, staffLogIn, type User } from '../../lib/store'
import { TagInput } from '../shared/TagInput'
import type { Audience } from './Landing'

const LANGUAGES = ['English', 'Yoruba', 'Igbo', 'Hausa', 'Pidgin', 'French', 'Arabic', 'Twi', 'Swahili', 'Spanish', 'Portuguese']

/** 'matchmaker' = the matchmaker log-in (/matchmaker) and application; 'admin' = super users (/admin). */
type FormAudience = Audience | 'admin'

interface AuthFormProps {
  mode: 'login' | 'signup'
  audience: FormAudience
  /** Link to the other form (log in ⇄ sign up). Left out where there's nowhere to switch to. */
  onSwitch?: () => void
  /** Called with the signed-in user; after a matchmaker application, with no user and the email used. */
  onDone: (user: User | null, email?: string) => void
  onCancel: () => void
  onForgot: () => void
  /** Shown above the form, e.g. after being signed out of the other realm. */
  notice?: string
}

const TITLES: Record<FormAudience, Record<AuthFormProps['mode'], string>> = {
  seeker: { login: 'Log in', signup: 'Create your account' },
  matchmaker: { login: 'Matchmaker log in', signup: 'Apply to be a matchmaker' },
  admin: { login: 'Super user log in', signup: '' },
}

const LOG_INS = { seeker: logIn, matchmaker: staffLogIn, admin: adminLogIn }

const INTROS: Record<FormAudience, Record<AuthFormProps['mode'], string>> = {
  seeker: {
    login: 'Welcome back. Log in to see your matches and your request.',
    signup:
      'Your account keeps your profile and request private — only you, your matchmaker and the people you’re matched with can see them.',
  },
  matchmaker: {
    login:
      'For the MatchMe matchmaking team only — a separate account from any seeker account. Logging in here signs this browser out of the seeker site.',
    signup:
      'Tell us about yourself. Our team reviews every application and emails you the decision — once approved, you log in at /matchmaker. Invited by a teammate? Use the link in your email instead.',
  },
  admin: {
    login:
      'For MatchMe super users only — a separate account from any seeker or matchmaker account. Logging in here signs this browser out of the other areas.',
    signup: '',
  },
}

export function AuthForm({ mode, audience, onSwitch, onDone, onCancel, onForgot, notice }: AuthFormProps) {
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
        await applyAsMatchmaker({ email, password, displayName, experience, languages, agreeConfidentiality: agree })
        onDone(null, email.trim())
      } else if (signup) {
        await signUp(email, password)
        onDone(null)
      } else {
        // Each realm has its own log-in: an account only works in its own area.
        onDone(await LOG_INS[audience](email, password))
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-form" onSubmit={submit}>
        {notice && (
          <p className="auth-notice small" role="status">
            {notice}
          </p>
        )}
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
        {onSwitch && (
          <p className="small auth-switch">
            {signup ? 'Already have an account?' : audience === 'seeker' ? 'New to MatchMe?' : 'Want to join the team?'}{' '}
            <button type="button" className="link-btn" onClick={onSwitch}>
              {signup ? 'Log in' : audience === 'seeker' ? 'Create an account' : 'Apply to be a matchmaker'}
            </button>
          </p>
        )}
      </form>
    </div>
  )
}
