import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type {
  DashboardBucket,
  DashboardCard,
  DashboardCardDisplayState,
  DashboardCardSubagent,
  DashboardRevealAgentArgs,
  DashboardSnapshot
} from '../../../../shared/dashboard-snapshot'

export type AgentsMapInput = {
  snapshot: Pick<DashboardSnapshot, 'cards'>
  liveEntries: Readonly<Record<string, Pick<AgentStatusEntry, 'toolName' | 'toolInput'>>>
  retainedPaneKeys: ReadonlySet<string>
  masterTabId?: string | null
}

export type AgentsMapNode = {
  id: string
  isMaster: boolean
  name: string
  activity: string
  bucket: DashboardBucket
  displayState: DashboardCardDisplayState
  agentType: string
  reveal: DashboardRevealAgentArgs
  projectLabel: string
  workspaceLabel: string
  hostLabel?: string
  lastAgentMessage?: string
  subagents: DashboardCardSubagent[]
}

export type TreeItem = {
  node: AgentsMapNode
  card: DashboardCard
  parentId?: string
}
