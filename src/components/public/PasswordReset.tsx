import { useState, type FormEvent } from 'react'
import { requestPasswordReset, resetPassword } from '../../lib/store'

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await requestPasswordReset(email)
      setSentTo(email.trim())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <div className="card auth-form">
        <h2>Check your email</h2>
        <p className="muted">
          If an account exists for <strong>{sentTo}</strong>, we’ve sent a link to reset your password. It expires in 1
          hour.
        </p>
        <p className="muted small">Not there? Check your spam folder, or try again in a couple of minutes.</p>
        <div className="form-actions">
          <button type="button" className="btn primary" onClick={onBack}>
            Back to log in
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="card auth-form" onSubmit={submit}>
      <h2>Forgot your password?</h2>
      <p className="muted small">Enter the email you signed up with and we’ll send you a link to choose a new one.</p>
      <label className="field">
        <span>Email</span>
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </label>
      {error && (
        <p className="errors" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onBack}>
          Back to log in
        </button>
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </div>
    </form>
  )
}

interface ResetPasswordFormProps {
  token: string
  onDone: () => void
  onRequestNew: () => void
}

export function ResetPasswordForm({ token, onDone, onRequestNew }: ResetPasswordFormProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== confirm) return setError('Passwords don’t match.')
    setBusy(true)
    try {
      await resetPassword(token, password)
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card auth-form" onSubmit={submit}>
      <h2>Choose a new password</h2>
      <p className="muted small">You’ll be signed in, and signed out everywhere else.</p>
      <label className="field">
        <span>New password</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
        <span className="hint small">At least 8 characters.</span>
      </label>
      <label className="field">
        <span>Confirm new password</span>
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </label>
      {error && (
        <p className="errors" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onRequestNew}>
          Request a new link
        </button>
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </div>
    </form>
  )
}
