import { useEffect, useState, type FormEvent } from 'react'
import { checkInvite, signUpMatchmaker } from '../../lib/store'

interface MatchmakerSignupProps {
  token: string
  onDone: () => void
  onCancel: () => void
}

/** Sign-up for new matchmakers, reached only through an invitation link (/#invite=…). */
export function MatchmakerSignup({ token, onDone, onCancel }: MatchmakerSignupProps) {
  const [invite, setInvite] = useState<{ valid: boolean; email: string | null } | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    checkInvite(token)
      .then((result) => {
        setInvite(result)
        if (result.email) setEmail(result.email)
      })
      .catch((e: Error) => setError(e.message))
  }, [token])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== confirm) return setError('Passwords don’t match.')
    setBusy(true)
    try {
      await signUpMatchmaker(token, email, password, displayName)
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!invite) {
    return <div className="card auth-form">{error ? <p className="errors">{error}</p> : <p className="muted">Checking your invitation…</p>}</div>
  }

  if (!invite.valid) {
    return (
      <div className="card auth-form">
        <h2>This invitation can’t be used</h2>
        <p className="muted">
          It has expired, was cancelled or has already been used. Ask a matchmaker on the team to send you a new one.
        </p>
        <div className="form-actions">
          <button type="button" className="btn primary" onClick={onCancel}>
            Go to MatchMe
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="card auth-form" onSubmit={submit}>
      <span className="eyebrow">Matchmaker invitation</span>
      <h2>Join the MatchMe matchmaking team</h2>
      <p className="muted small">
        Create your matchmaker account. You’ll be able to take on seekers’ requests, propose matches and see every
        member.
      </p>
      <label className="field">
        <span>Your name (seekers see this)</span>
        <input value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} required autoFocus />
      </label>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={!!invite.email}
          required
        />
        {invite.email && <span className="hint small">This invitation is for this address.</span>}
      </label>
      <label className="field">
        <span>Password</span>
        <input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <span className="hint small">At least 8 characters.</span>
      </label>
      <label className="field">
        <span>Confirm password</span>
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </label>
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
          {busy ? 'Creating…' : 'Create matchmaker account'}
        </button>
      </div>
    </form>
  )
}
