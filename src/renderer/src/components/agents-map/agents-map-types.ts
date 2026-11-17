import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type {
  DashboardBucket,
  DashboardCard,
  DashboardCardDisplayState,
  DashboardCardSubagent,
  DashboardRevealAgentArgs,
  DashboardSnapshot
} from '../../../../shared/dashboard-snapshot'

export const AGENTS_MAP_NODE_WIDTH = 220
export const AGENTS_MAP_NODE_HEIGHT = 56

export type AgentsMapInput = {
  snapshot: Pick<DashboardSnapshot, 'cards' | 'workspaces'>
  liveEntries: Readonly<Record<string, Pick<AgentStatusEntry, 'toolName' | 'toolInput'>>>
  retainedPaneKeys: ReadonlySet<string>
  masterWorktreeId?: string | null
  wrapWidth: number
}

export type AgentsMapNode = {
  id: string
  kind: 'agent' | 'subagent'
  isMaster: boolean
  name: string
  activity: string
  bucket: DashboardBucket
  displayState: DashboardCardDisplayState
  agentType: string
  x: number
  y: number
  reveal: DashboardRevealAgentArgs
  projectLabel: string
  workspaceLabel: string
  hostLabel?: string
  lastAgentMessage?: string
  subagents: DashboardCardSubagent[]
}

export type AgentsMapEdge = {
  id: string
  from: string
  to: string
  crossWorkspace: boolean
  path: string
}

export type AgentsMapGroup = {
  id: string
  kind: 'project' | 'workspace' | 'master'
  label: string
  hostLabel?: string
  x: number
  y: number
  width: number
  height: number
}

export type AgentsMapLayout = {
  width: number
  height: number
  groups: AgentsMapGroup[]
  nodes: AgentsMapNode[]
  edges: AgentsMapEdge[]
}

export type TreeItem = {
  node: AgentsMapNode
  card: DashboardCard
  parentId?: string
  children: TreeItem[]
  row: number
  depth: number
}

export type WorkspaceBucket = { key: string; label: string; hostLabel?: string; items: TreeItem[] }
export type ProjectBucket = {
  repoId: string
  label: string
  isMaster: boolean
  workspaces: WorkspaceBucket[]
}
