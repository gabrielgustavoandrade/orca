import React, { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { useLiveDashboardSnapshot } from '../dashboard/useLiveDashboardSnapshot'
import { AgentsMasterPane } from './AgentsMasterPane'
import { MasterRail } from './MasterRail'
import { buildItems } from './agents-map-items'
import { useMasterAgent } from './use-master-agent'
import type { AgentsMapNode } from './agents-map-types'

function MasterBody(): React.JSX.Element {
  const snapshot = useLiveDashboardSnapshot()
  const liveEntries = useAppStore((s) => s.agentStatusByPaneKey)
  const retained = useAppStore((s) => s.retainedAgentsByPaneKey)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const master = useMasterAgent()
  const nodes = useMemo(
    () =>
      buildItems({
        snapshot,
        liveEntries,
        retainedPaneKeys: new Set(Object.keys(retained)),
        masterWorktreeId: master.worktreeId
      }).map((item) => item.node),
    [snapshot, liveEntries, retained, master.worktreeId]
  )
  const masterNode = nodes.find((node) => node.isMaster) ?? null
  const others = nodes.filter((node) => !node.isMaster)
  const selected = others.find((node) => node.id === selectedId) ?? null

  const toggle = (node: AgentsMapNode): void =>
    setSelectedId((current) => (current === node.id ? null : node.id))

  return (
    <div className="flex min-h-0 flex-1">
      <AgentsMasterPane master={master} state={masterNode?.displayState ?? null} />
      <MasterRail
        nodes={others}
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
