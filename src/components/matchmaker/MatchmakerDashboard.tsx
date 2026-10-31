import { useState } from 'react'
import { requestStatus } from '../../lib/requests'
import type { AppData, MatchmakerData } from '../../lib/store'
import { ExampleLibrary } from './ExampleLibrary'
import { MatchmakerProfileForm } from './MatchmakerProfileForm'
import { MemberDirectory } from './MemberDirectory'
import { Overview } from './Overview'
import { RequestsView, type Scope } from './RequestsView'
import { Team } from './Team'

type Tab = 'overview' | 'requests' | 'members' | 'examples' | 'team' | 'profile'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'requests', label: 'Requests' },
  { id: 'members', label: 'Members' },
  { id: 'examples', label: 'Example photos' },
  { id: 'team', label: 'Team' },
  { id: 'profile', label: 'My profile' },
]

/** The matchmaker section. Each tab is its own component in this folder. */
export function MatchmakerDashboard({ data, matchmaker }: { data: AppData; matchmaker: MatchmakerData }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [scope, setScope] = useState<Scope>('mine')
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)

  const unassignedNew = data.requests.filter((r) => !r.matchmakerId && requestStatus(r) === 'new').length

  function go(next: Tab) {
    setTab(next)
    window.scrollTo({ top: 0 })
  }

  function openRequest(requestId: string) {
    const request = data.requests.find((r) => r.id === requestId)
    // Show it in the list it belongs to, so it stays visible after opening.
    setScope(!request?.matchmakerId ? 'unassigned' : request.matchmakerId === matchmaker.me.id ? 'mine' : 'all')
    setSelectedRequestId(requestId)
    go('requests')
  }

  return (
    <div className="stack">
      <nav className="tabs mm-tabs" aria-label="Matchmaker sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-current={tab === t.id} onClick={() => go(t.id)}>
            {t.label}
            {t.id === 'requests' && unassignedNew > 0 && <span className="count">{unassignedNew}</span>}
            {t.id === 'team' && matchmaker.applications.length > 0 && (
              <span className="count">{matchmaker.applications.length}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <Overview
          data={data}
          matchmaker={matchmaker}
          onOpenRequest={openRequest}
          onShowRequests={(s) => {
            setScope(s)
            setSelectedRequestId(null)
            go('requests')
          }}
        />
      )}
      {tab === 'requests' && (
        <RequestsView
          data={data}
          matchmaker={matchmaker}
          scope={scope}
          onScope={setScope}
          selectedId={selectedRequestId}
          onSelect={setSelectedRequestId}
        />
      )}
      {tab === 'members' && <MemberDirectory data={data} onOpenRequest={openRequest} />}
      {tab === 'examples' && <ExampleLibrary data={data} />}
      {tab === 'team' && <Team data={data} matchmaker={matchmaker} />}
      {tab === 'profile' && <MatchmakerProfileForm matchmaker={matchmaker.me} />}
    </div>
  )
}
