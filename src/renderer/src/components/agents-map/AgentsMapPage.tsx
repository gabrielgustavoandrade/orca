import React, { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { useLiveDashboardSnapshot } from '../dashboard/useLiveDashboardSnapshot'
import { AgentsMasterPane } from './AgentsMasterPane'
import { MasterRail } from './MasterRail'
import { buildMasterRail } from './master-rail'
import { useMasterAgent } from './use-master-agent'
import type { AgentsMapNode } from './agents-map-types'

function MasterBody(): React.JSX.Element {
  const snapshot = useLiveDashboardSnapshot()
  const liveEntries = useAppStore((s) => s.agentStatusByPaneKey)
  const retained = useAppStore((s) => s.retainedAgentsByPaneKey)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const master = useMasterAgent()
  const groups = useMemo(
    () =>
      buildMasterRail({
        snapshot,
        liveEntries,
        retainedPaneKeys: new Set(Object.keys(retained)),
        masterTabId: master.tabId
      }),
    [snapshot, liveEntries, retained, master.tabId]
  )
  const selected = groups.listed.find((item) => item.node.id === selectedId)?.node ?? null

  const toggle = (node: AgentsMapNode): void =>
    setSelectedId((current) => (current === node.id ? null : node.id))

  return (
    <div className="flex min-h-0 flex-1">
      <AgentsMasterPane master={master} state={groups.master?.displayState ?? null} />
      <MasterRail
        groups={groups}
        selected={selected}
        onSelect={toggle}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}

export default function AgentsMapPage(): React.JSX.Element | null {
  const enabled = useAppStore((s) => s.settings?.experimentalAgentsMap === true)
  const closeAgentsMapPage = useAppStore((s) => s.closeAgentsMapPage)
  // Why: a persisted 'agents-map' view can be restored after the flag is turned off.
  useEffect(() => {
    if (!enabled) {
      closeAgentsMapPage()
    }
  }, [enabled, closeAgentsMapPage])
  if (!enabled) {
    return null
  }
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <MasterBody />
    </div>
  )
}
