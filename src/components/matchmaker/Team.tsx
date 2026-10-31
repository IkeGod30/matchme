import { useState, type FormEvent } from 'react'
import { timeAgo } from '../../lib/format'
import { requestStatus } from '../../lib/requests'
import { actions, type AppData, type MatchmakerData } from '../../lib/store'
import { MatchmakerAvatar } from '../shared/MatchmakerCard'

/** The matchmaking team, and invitations for new matchmakers. */
export function Team({ data, matchmaker }: { data: AppData; matchmaker: MatchmakerData }) {
  const [email, setEmail] = useState('')
  const [created, setCreated] = useState<{ link: string; emailed: boolean; email: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const openFor = (id: string) =>
    data.requests.filter((r) => r.matchmakerId === id && requestStatus(r) !== 'closed').length
  const nameOf = (id?: string) => matchmaker.team.find((m) => m.id === id)?.displayName ?? 'A former matchmaker'

  async function invite(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    const result = await actions.createInvite(email.trim())
    setBusy(false)
    if (result) {
      setCreated({ ...result, email: email.trim() })
      setCopied(false)
      setEmail('')
    }
  }

  async function copy() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.link)
      setCopied(true)
    } catch {
      window.prompt('Copy this invitation link:', created.link)
    }
  }

  return (
    <section className="stack">
      <div>
        <h2>Team</h2>
        <p className="muted">
          Matchmakers join by applying (reviewed below) or by invitation (approved straight away). Everyone on the team
          can see every request and member.
        </p>
      </div>

      {matchmaker.applications.length > 0 && (
        <article className="card applications">
          <h3>
            Applications <span className="count">{matchmaker.applications.length}</span>
          </h3>
          <p className="muted small">
            People who applied to be matchmakers. Approve only those you trust with members’ private profiles — they’ll
            see every member and request.
          </p>
          <ul className="application-list">
            {matchmaker.applications.map((a) => (
              <li key={a.id}>
                <MatchmakerAvatar matchmaker={a} size={44} />
                <div className="application-body">
                  <strong>{a.displayName}</strong>
                  <span className="muted small">
                    {a.email} · applied {timeAgo(a.appliedAt)}
                    {a.languages.length > 0 && ` · speaks ${a.languages.join(', ')}`}
                  </span>
                  <blockquote className="quote small">{a.experience}</blockquote>
                </div>
                <div className="application-actions">
                  <button
                    type="button"
                    className="btn ghost small-btn danger"
                    onClick={() =>
                      confirm(`Decline ${a.displayName}'s application? Their account will be removed and they'll be emailed.`) &&
                      actions.declineApplication(a.id)
                    }
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    className="btn primary small-btn"
                    onClick={() =>
                      confirm(`Approve ${a.displayName}? They'll be able to see every member and request.`) &&
                      actions.approveApplication(a.id)
                    }
                  >
                    Approve
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>
      )}

      <div className="team-grid">
        {matchmaker.team.map((m) => (
          <article key={m.id} className="card team-card">
            <MatchmakerAvatar matchmaker={m} size={56} />
            <div>
              <h3>
                {m.displayName} {m.id === matchmaker.me.id && <span className="badge applies">You</span>}
              </h3>
              <p className="muted small">{m.email}</p>
              <p className="small">
                {openFor(m.id)} open {openFor(m.id) === 1 ? 'request' : 'requests'}
              </p>
              {m.specialties.length > 0 && (
                <div className="mm-tags">
                  {m.specialties.map((s) => (
                    <span key={s} className="criterion">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      <article className="card stack">
        <h3>Invite a matchmaker</h3>
        <form className="invite-form" onSubmit={invite}>
          <label className="field">
            <span>
              Their email <span className="hint">· optional</span>
            </span>
            <input type="email" value={email} placeholder="name@example.com" onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create invitation'}
          </button>
        </form>
        <p className="muted small">
          With an email, the invitation is sent to them and only that address can use it. Without one, you get a link
          to share yourself. Links expire after 7 days and work once.
        </p>

        {created && (
          <div className="invite-result">
            <p className="small">
              {created.emailed
                ? `Invitation emailed to ${created.email}. You can also share this link with them directly:`
                : 'Share this link with the new matchmaker:'}
            </p>
            <div className="invite-link">
              <input readOnly value={created.link} onFocus={(e) => e.target.select()} aria-label="Invitation link" />
              <button type="button" className="btn ghost small-btn" onClick={copy}>
                {copied ? 'Copied ✓' : 'Copy link'}
              </button>
            </div>
            <p className="muted small">This link is shown only once — we keep just a fingerprint of it.</p>
          </div>
        )}
      </article>

      {matchmaker.invites.length > 0 && (
        <article className="card">
          <h3>Pending invitations</h3>
          <ul className="sent-list">
            {matchmaker.invites.map((inv) => (
              <li key={inv.id}>
                <div>
                  <strong>{inv.email ?? 'Anyone with the link'}</strong>
                  <p className="muted small">
                    Invited by {nameOf(inv.createdBy)} {timeAgo(inv.createdAt)} · expires {timeAgo(inv.expiresAt)}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn ghost small-btn danger"
                  onClick={() => confirm('Cancel this invitation? The link will stop working.') && actions.revokeInvite(inv.id)}
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </article>
      )}
    </section>
  )
}
