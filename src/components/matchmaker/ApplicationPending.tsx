import type { User } from '../../lib/store'

/** What a matchmaker applicant sees until a teammate approves them. */
export function ApplicationPending({ user, onLogOut }: { user: User; onLogOut: () => void }) {
  return (
    <section className="card auth-form pending-card">
      <span className="eyebrow">Matchmaker application</span>
      <h2>Thanks — your application is being reviewed</h2>
      <p className="muted">
        A matchmaker on the MatchMe team will review your application and you’ll get an email at{' '}
        <strong>{user.email}</strong> when they decide. Once you’re approved, this page turns into your matchmaker
        dashboard — no need to sign up again.
      </p>
      <p className="muted small">
        Until then you won’t see any members or requests. That’s how we keep members’ private information safe.
      </p>
      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onLogOut}>
          Log out
        </button>
      </div>
    </section>
  )
}
