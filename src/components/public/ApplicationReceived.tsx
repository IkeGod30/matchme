/** Shown after someone applies to be a matchmaker. They aren't signed in; the decision comes by email. */
export function ApplicationReceived({ email, onHome }: { email: string; onHome: () => void }) {
  return (
    <section className="card auth-form pending-card" role="status">
      <span className="eyebrow">Matchmaker application</span>
      <h2>Thank you — we’ve received your application</h2>
      <p className="muted">
        Your application is now being processed. Our team reviews every applicant carefully, because approved
        matchmakers can see members’ private profiles.
      </p>
      <p className="muted">
        We’ll email you{email && (
          <>
            {' '}
            at <strong>{email}</strong>
          </>
        )}{' '}
        as soon as there’s a decision. If you’re approved, the email tells you how to log in to your matchmaker
        dashboard. There’s nothing else you need to do for now.
      </p>
      <div className="form-actions">
        <button type="button" className="btn primary" onClick={onHome}>
          Back to home
        </button>
      </div>
    </section>
  )
}
