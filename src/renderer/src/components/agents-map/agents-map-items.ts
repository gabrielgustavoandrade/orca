import { dashboardCardDisplayState } from '../../../../shared/dashboard-snapshot'
import { formatAgentTypeLabel } from '../../../../shared/agent-status/presentation/agent-type-label'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type {
  DashboardBucket,
  DashboardCard,
  DashboardCardDotState,
  DashboardRevealAgentArgs
} from '../../../../shared/dashboard-snapshot'
import type { AgentsMapInput, ProjectBucket, TreeItem, WorkspaceBucket } from './agents-map-types'

function firstLine(text: string | undefined): string {
  return (
    text
      ?.split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  )
}

function cardName(card: DashboardCard): string {
  return card.conversationName || card.task || formatAgentTypeLabel(card.agentType)
}

export function agentsMapActivity(
  card: DashboardCard,
  live: Pick<AgentStatusEntry, 'toolName' | 'toolInput'> | undefined
): string {
  if (card.bucket === 'attention' && card.askSummary) {
    return card.askSummary
  }
  if (card.bucket === 'working' && live?.toolName) {
    const input = firstLine(live.toolInput)
    return input ? `${live.toolName}: ${input}` : live.toolName
  }
  return firstLine(card.lastAgentMessage) || card.task
}

function subagentBucket(dotState: DashboardCardDotState): DashboardBucket {
  if (dotState === 'blocked' || dotState === 'waiting') {
    return 'attention'
  }
  return dotState
}

export const byStart = (a: TreeItem, b: TreeItem): number =>
  a.card.startedAt - b.card.startedAt || a.card.paneKey.localeCompare(b.card.paneKey)

export function workspaceKeyOf(card: Pick<DashboardCard, 'repoId' | 'worktreeId'>): string {
  return `${card.repoId}:${card.worktreeId}`
}

export function buildItems(input: AgentsMapInput): TreeItem[] {
  const cards = input.snapshot.cards.filter(
    (card) => !(input.retainedPaneKeys.has(card.paneKey) && !(card.paneKey in input.liveEntries))
  )
  const alive = new Set(cards.map((card) => card.paneKey))
  const items: TreeItem[] = []
  for (const card of cards) {
    const reveal: DashboardRevealAgentArgs = {
      repoId: card.repoId,
      worktreeId: card.worktreeId,
      executionHostId: card.executionHostId,
      tabId: card.tabId,
      leafId: card.leafId
    }
    const projectLabel = card.repoName
    const workspaceLabel = card.worktreeName
    items.push({
      card,
      parentId:
        card.parentPaneKey && alive.has(card.parentPaneKey) ? card.parentPaneKey : undefined,
      children: [],
      row: 0,
      depth: 0,
      node: {
        id: card.paneKey,
        kind: 'agent',
        name: cardName(card),
        activity: agentsMapActivity(card, input.liveEntries[card.paneKey]),
        bucket: card.bucket,
        displayState: dashboardCardDisplayState(card),
        agentType: card.agentType,
        x: 0,
        y: 0,
        reveal,
        projectLabel,
        workspaceLabel,
        hostLabel: card.hostLabel,
        lastAgentMessage: card.lastAgentMessage,
        subagents: card.subagents ?? []
      }
    })
    for (const sub of card.subagents ?? []) {
      items.push({
        card,
        parentId: card.paneKey,
        children: [],
        row: 0,
        depth: 0,
        node: {
          id: `${card.paneKey}/${sub.id}`,
          kind: 'subagent',
          name: sub.name,
          activity: '',
          bucket: subagentBucket(sub.dotState),
          displayState: sub.dotState,
          agentType: card.agentType,
          x: 0,
          y: 0,
          reveal,
          projectLabel,
          workspaceLabel,
          hostLabel: card.hostLabel,
          subagents: []
        }
      })
    }
  }
  return items
}

export function groupByWorkspace(input: AgentsMapInput, items: TreeItem[]): ProjectBucket[] {
  const projects = new Map<string, ProjectBucket>()
  const workspaces = new Map<string, WorkspaceBucket>()
  const ensure = (
    repoId: string,
    worktreeId: string,
    repoName: string,
    worktreeName: string,
    hostLabel?: string
  ): void => {
    const key = workspaceKeyOf({ repoId, worktreeId })
    if (workspaces.has(key)) {
      return
    }
    let project = projects.get(repoId)
    if (!project) {
      project = { repoId, label: repoName, workspaces: [] }
      projects.set(repoId, project)
    }
    const bucket: WorkspaceBucket = { key, label: worktreeName, hostLabel, items: [] }
    workspaces.set(key, bucket)
    project.workspaces.push(bucket)
  }
  for (const ws of input.snapshot.workspaces ?? []) {
    ensure(ws.repoId, ws.worktreeId, ws.repoName, ws.worktreeName, ws.hostLabel)
  }
  for (const { card } of items) {
    ensure(card.repoId, card.worktreeId, card.repoName, card.worktreeName, card.hostLabel)
  }
  for (const item of items) {
    workspaces.get(workspaceKeyOf(item.card))?.items.push(item)
  }
  return [...projects.values()]
    .map((p) => ({ ...p, workspaces: p.workspaces.filter((w) => w.items.length > 0) }))
    .filter((p) => p.workspaces.length > 0)
}
