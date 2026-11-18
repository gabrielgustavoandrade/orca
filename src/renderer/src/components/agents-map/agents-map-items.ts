import { dashboardCardDisplayState } from '../../../../shared/dashboard-snapshot'
import { formatAgentTypeLabel } from '../../../../shared/agent-status/presentation/agent-type-label'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { DashboardCard, DashboardRevealAgentArgs } from '../../../../shared/dashboard-snapshot'
import type { AgentsMapInput, TreeItem } from './agents-map-types'

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

export const byStart = (a: TreeItem, b: TreeItem): number =>
  a.card.startedAt - b.card.startedAt || a.card.paneKey.localeCompare(b.card.paneKey)

export function buildItems(input: AgentsMapInput): TreeItem[] {
  const cards = input.snapshot.cards.filter(
    (card) => !(input.retainedPaneKeys.has(card.paneKey) && !(card.paneKey in input.liveEntries))
  )
  const alive = new Set(cards.map((card) => card.paneKey))
  return cards.map((card) => {
    const reveal: DashboardRevealAgentArgs = {
      repoId: card.repoId,
      worktreeId: card.worktreeId,
      executionHostId: card.executionHostId,
      tabId: card.tabId,
      leafId: card.leafId
    }
    return {
      card,
      parentId:
        card.parentPaneKey && alive.has(card.parentPaneKey) ? card.parentPaneKey : undefined,
      node: {
        id: card.paneKey,
        isMaster: input.masterTabId != null && card.tabId === input.masterTabId,
        name: cardName(card),
        activity: agentsMapActivity(card, input.liveEntries[card.paneKey]),
        bucket: card.bucket,
        displayState: dashboardCardDisplayState(card),
        agentType: card.agentType,
        reveal,
        projectLabel: card.repoName,
        workspaceLabel: card.worktreeName,
        hostLabel: card.hostLabel,
        lastAgentMessage: card.lastAgentMessage,
        subagents: card.subagents ?? []
      }
    }
  })
}
