import { useEffect, useState, type ReactNode } from 'react'
import { timeAgo } from '../../lib/format'
import { adminActions } from '../../lib/store'
import type { AccountSummary, AdminData, Profile } from '../../types'
import { ContactLine, MemberLine } from '../shared/CandidateCard'
import { MatchmakerAvatar } from '../shared/MatchmakerCard'
import { PhotoCarousel } from '../shared/PhotoCarousel'
import { Portrait } from '../shared/Portrait'
import { RequestSummary } from '../shared/RequestSummary'

type Tab = 'applications' | 'seekers' | 'matchmakers' | 'admins'

/** /admin: super users manage every seeker and matchmaker account, and matchmaker applications. */
export function AdminDashboard({ data }: { data: AdminData }) {
  const [tab, setTab] = useState<Tab>(data.applications.length > 0 ? 'applications' : 'seekers')
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'applications', label: 'Applications', count: data.applications.length },
    { id: 'seekers', label: 'Seekers', count: data.seekers.length },
    { id: 'matchmakers', label: 'Matchmakers', count: data.matchmakers.length },
    { id: 'admins', label: 'Super users', count: data.admins.length },
  ]

  return (
    <div className="stack">
      <nav className="tabs mm-tabs" aria-label="Admin sections">
        {tabs.map((t) => (
          <button key={t.id} type="button" aria-current={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'applications' ? (
              t.count > 0 && <span className="count">{t.count}</span>
            ) : (
              <span className="muted small"> {t.count}</span>
            )}
          </button>
        ))}
      </nav>
      {tab === 'applications' && <Applications data={data} />}
      {tab === 'seekers' && <Seekers accounts={data.seekers} />}
      {tab === 'matchmakers' && <Matchmakers accounts={data.matchmakers} />}
      {tab === 'admins' && <SuperUsers accounts={data.admins} meId={data.me.id} />}
    </div>
  )
}

function Applications({ data }: { data: AdminData }) {
  if (data.applications.length === 0) {
    return <p className="card muted">No applications waiting. New ones are emailed to every super user.</p>
  }
  return (
    <article className="card applications">
      <h2>Matchmaker applications</h2>
      <p className="muted small">
        Approve only people you trust with members’ private profiles — approved matchmakers see every member and
        request. Applicants are emailed either way.
      </p>
      <ul className="application-list">
        {data.applications.map((a) => (
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
                  adminActions.declineApplication(a.id)
                }
              >
                Decline
              </button>
              <button
                type="button"
                className="btn primary small-btn"
                onClick={() =>
                  confirm(`Approve ${a.displayName}? They'll be able to see every member and request.`) &&
                  adminActions.approveApplication(a.id)
                }
              >
                Approve
              </button>
            </div>
          </li>
        ))}
      </ul>
    </article>
  )
}

/** Case-insensitive search over the account's email, name and location. */
function useSearch(accounts: AccountSummary[]) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q
    ? accounts.filter((a) => [a.email, a.name, a.location].some((v) => v?.toLowerCase().includes(q)))
    : accounts
  const box = (
    <label className="field directory-search">
      <span className="sr-only">Search accounts</span>
      <input type="search" placeholder="Search by name, email or city" value={query} onChange={(e) => setQuery(e.target.value)} />
    </label>
  )
  return { shown, box }
}

/** Suspend / reactivate, password reset and delete — the actions every account has. */
function CommonActions({ account, label, deleteText }: { account: AccountSummary; label: string; deleteText: string }) {
  return (
    <>
      {account.suspendedAt ? (
        <button type="button" className="btn ghost small-btn" onClick={() => adminActions.reactivate(account.id)}>
          Reactivate
        </button>
      ) : (
        <button
          type="button"
          className="btn ghost small-btn"
          onClick={() =>
            confirm(`Suspend ${label}? They're signed out at once and can't log in until you reactivate the account.`) &&
            adminActions.suspend(account.id)
          }
        >
          Suspend
        </button>
      )}
      {!account.suspendedAt && (
        <button
          type="button"
          className="btn ghost small-btn"
          onClick={async () => {
            if (!confirm(`Email ${account.email} a link to choose a new password?`)) return
            if (await adminActions.sendPasswordReset(account.id)) alert(`Password reset link sent to ${account.email}.`)
          }}
        >
          Send password reset
        </button>
      )}
      <button
        type="button"
        className="btn ghost small-btn danger"
        onClick={() => confirm(deleteText) && adminActions.remove(account.id)}
      >
        Delete
      </button>
    </>
  )
}

function AccountRow({ account, title, details, actions, children }: {
  account: AccountSummary
  title: ReactNode
  details: ReactNode
  actions: ReactNode
  children?: ReactNode
}) {
  return (
    <li className="admin-row" data-suspended={account.suspendedAt ? true : undefined}>
      <div className="admin-row-main">
        <div className="admin-row-info">
          <strong>
            {title}
            {account.suspendedAt && <span className="badge suspended-badge">Suspended {timeAgo(account.suspendedAt)}</span>}
          </strong>
          <span className="muted small">{details}</span>
        </div>
        <div className="admin-row-actions">{actions}</div>
      </div>
      {children}
    </li>
  )
}

function Seekers({ accounts }: { accounts: AccountSummary[] }) {
  const { shown, box } = useSearch(accounts)
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <section className="stack">
      <div className="card directory-filters">{box}</div>
      {shown.length === 0 && <p className="muted">No seekers match.</p>}
      <ul className="admin-list">
        {shown.map((a) => {
          const label = a.name ?? a.email
          return (
            <AccountRow
              key={a.id}
              account={a}
              title={a.name ?? <span className="muted">No profile yet</span>}
              details={
                <>
                  {a.email}
                  {a.location && ` · ${a.location}`} · joined {timeAgo(a.createdAt)}
                  {!!a.openRequests && ` · ${a.openRequests} open ${a.openRequests === 1 ? 'request' : 'requests'}`}
                </>
              }
              actions={
                <>
                  {a.profileId && (
                    <button
                      type="button"
                      className="btn ghost small-btn"
                      aria-expanded={openId === a.id}
                      onClick={() => setOpenId(openId === a.id ? null : a.id)}
                    >
                      {openId === a.id ? 'Hide profile' : 'View profile'}
                    </button>
                  )}
                  <CommonActions
                    account={a}
                    label={label}
                    deleteText={`Permanently delete ${label}'s account, profile, photos and match requests? This can't be undone.`}
                  />
                </>
              }
            >
              {openId === a.id && <SeekerProfile accountId={a.id} />}
            </AccountRow>
          )
        })}
      </ul>
    </section>
  )
}

/** A seeker's full profile, loaded when a super user opens it. */
function SeekerProfile({ accountId }: { accountId: string }) {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    adminActions
      .loadSeeker(accountId)
      .then((p) => live && setProfile(p))
      .catch(() => live && setProfile(null))
    return () => {
      live = false
    }
  }, [accountId])

  if (profile === undefined) return <p className="muted small">Loading profile…</p>
  if (profile === null) return <p className="muted small">This seeker hasn’t created a profile.</p>
  return (
    <div className="admin-profile stack">
      <header className="candidate-top">
        <Portrait profile={profile} size={80} />
        <div className="candidate-info">
          <h3>
            {profile.name}, {profile.age}
          </h3>
          <MemberLine profile={profile} />
          <ContactLine profile={profile} missing="No preferred contact on file." />
          <p className="muted small">{profile.publicListing ? 'Listed on the Featured page' : 'Private profile'}</p>
        </div>
      </header>
      <PhotoCarousel profile={profile} />
      {profile.bio && <p className="bio">{profile.bio}</p>}
      <RequestSummary request={profile.request} />
    </div>
  )
}

function Matchmakers({ accounts }: { accounts: AccountSummary[] }) {
  const { shown, box } = useSearch(accounts)
  return (
    <section className="stack">
      <div className="card directory-filters">{box}</div>
      {shown.length === 0 && <p className="muted">No matchmakers match.</p>}
      <ul className="admin-list">
        {shown.map((a) => {
          const label = a.name ?? a.email
          return (
            <AccountRow
              key={a.id}
              account={a}
              title={
                <>
                  {label}
                  {a.isSuperUser && <span className="badge applies">Super user</span>}
                </>
              }
              details={
                <>
                  {a.email} · joined {timeAgo(a.createdAt)}
                </>
              }
              actions={
                <>
                  {!a.isSuperUser && !a.suspendedAt && (
                    <button
                      type="button"
                      className="btn ghost small-btn"
                      onClick={async () => {
                        if (
                          !confirm(
                            `Make ${label} a super user? They get a separate super-user account (same email) and an email to choose its password. Super users can manage every account.`,
                          )
                        ) {
                          return
                        }
                        if (await adminActions.promote(a.id)) alert(`${label} is now a super user. They've been emailed a link to set their password.`)
                      }}
                    >
                      Make super user
                    </button>
                  )}
                  <CommonActions
                    account={a}
                    label={label}
                    deleteText={`Permanently delete ${label}'s matchmaker account? Requests they look after become unassigned. This can't be undone.`}
                  />
                </>
              }
            />
          )
        })}
      </ul>
    </section>
  )
}

function SuperUsers({ accounts, meId }: { accounts: AccountSummary[]; meId: string }) {
  return (
    <section className="stack">
      <p className="muted">
        Super users manage every account at /admin. To add one, use <em>Make super user</em> on a matchmaker. Super-user
        accounts are separate from matchmaker accounts, even with the same email.
      </p>
      <ul className="admin-list">
        {accounts.map((a) => (
          <AccountRow
            key={a.id}
            account={a}
            title={
              <>
                {a.email}
                {a.id === meId && <span className="badge applies">You</span>}
              </>
            }
            details={
              <>
                {a.promotedFrom ? 'Promoted from a matchmaker' : 'Created by the site owner'} · added {timeAgo(a.createdAt)}
              </>
            }
            actions={
              a.id !== meId && (
                <CommonActions
                  account={a}
                  label={a.email}
                  deleteText={`Remove ${a.email}'s super-user rights? Their super-user account is deleted; any matchmaker or seeker account they have is kept.`}
                />
              )
            }
          />
        ))}
      </ul>
    </section>
  )
}
