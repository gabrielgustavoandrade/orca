import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { structuredAgentSessionTabId } from '../../../../shared/structured-agent-session-projection'
import { withTimeout } from '../../../../shared/promise-timeout-fallback'
import type { Tab } from '../../../../shared/tab-types'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { LaunchSource } from '../../../../shared/telemetry-events'
import {
  getAgentDetectionTargetKeyForWorktree,
  parseAgentDetectionTargetKey
} from '@/hooks/useAgentDetectionTarget'
import {
  ensureDetectedAgentsForTarget,
  readDetectedAgentsForTarget
} from '@/lib/agent-detection-target-inventory'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { launchAgentInNewTab, type LaunchAgentInNewTabResult } from '@/lib/launch-agent-in-new-tab'
import { revealFloatingWorkspacePanel } from '@/lib/floating-workspace-panel-reveal'
import { activateStructuredAgentSessionTab } from '@/lib/structured-agent-session-tab-activation'
import { focusTerminalTabSurface } from '@/lib/focus-terminal-tab-surface'
import { buildManagerAgentBrief, resolveManagerAgentCliCommand } from './manager-agent-brief'
import {
  findAddedManagerAgentTab,
  findManagerAgentTab,
  pickManagerAgent
} from './manager-agent-tab-resolution'

// Why bounded: detection only picks the agent; a slow host must not leave the click hanging.
const AGENT_DETECTION_TIMEOUT_MS = 5_000

let pendingOpen: Promise<void> | null = null

function floatingTabs(): Tab[] {
  return useAppStore.getState().unifiedTabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []
}

function focusManagerAgentTab(tab: Tab): void {
  const state = useAppStore.getState()
  revealFloatingWorkspacePanel(state)
  if (tab.contentType === 'agent-session') {
    activateStructuredAgentSessionTab({ worktreeId: FLOATING_TERMINAL_WORKTREE_ID, tabId: tab.id })
    return
  }
  // Why: the floating panel renders its group's activeTabId; selecting only the worktree's
  // active terminal would leave the Manager behind another floating tab.
  state.focusGroup(FLOATING_TERMINAL_WORKTREE_ID, tab.groupId)
  state.setActiveTabForWorktree(FLOATING_TERMINAL_WORKTREE_ID, tab.entityId)
  state.activateTab(tab.id, { worktreeId: FLOATING_TERMINAL_WORKTREE_ID })
  state.setActiveTabType('terminal', FLOATING_TERMINAL_WORKTREE_ID)
  focusTerminalTabSurface(tab.entityId)
}

async function detectFloatingAgents(): Promise<TuiAgent[]> {
  const state = useAppStore.getState()
  const target = parseAgentDetectionTargetKey(
    getAgentDetectionTargetKeyForWorktree(state, FLOATING_TERMINAL_WORKTREE_ID)
  )
  if (!target) {
    return []
  }
  const cached = readDetectedAgentsForTarget(state, target)
  if (cached) {
    return cached
  }
  return withTimeout(ensureDetectedAgentsForTarget(state, target), AGENT_DETECTION_TIMEOUT_MS, [])
}

/** The tab the launch opened, once its route knows it; null when nothing opened. */
async function resolveLaunchedTabId(
  result: NonNullable<LaunchAgentInNewTabResult>,
  tabIdsBefore: ReadonlySet<string>
): Promise<string | null> {
  if (result.surface.kind === 'local-terminal') {
    return result.surface.tabId
  }
  const settlement = await result.structuredSettlement
  if (settlement?.kind === 'structured') {
    return structuredAgentSessionTabId(settlement.sessionId)
  }
  // Why: a declined chat or a host-published terminal does not report its tab id.
  if (settlement === undefined || settlement.kind === 'terminal') {
    return findAddedManagerAgentTab(tabIdsBefore, floatingTabs())?.id ?? null
  }
  if (settlement.kind === 'failed' && !settlement.notified) {
    toast.error(
      translate('auto.components.managerAgent.launchFailed', 'Could not start the Manager.')
    )
  }
  return null
}

async function createManagerAgentChat(launchSource: LaunchSource): Promise<void> {
  const settings = useAppStore.getState().settings
  const agent = pickManagerAgent({
    defaultTuiAgent: settings?.defaultTuiAgent,
    detected: await detectFloatingAgents(),
    disabled: settings?.disabledTuiAgents
  })
  if (!agent) {
    toast.error(
      translate(
        'auto.components.managerAgent.noAgent',
        'No installed agent is available to run the Manager.'
      )
    )
    return
  }
  const tabIdsBefore = new Set(floatingTabs().map((tab) => tab.id))
  revealFloatingWorkspacePanel(useAppStore.getState())
  const result = launchAgentInNewTab({
    requestId: newAgentLaunchRequestId(),
    agent,
    worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
    prompt: buildManagerAgentBrief(resolveManagerAgentCliCommand(import.meta.env.DEV)),
    launchSource,
    // Why: floating launches must not take the main window's global tab selection.
    activate: false
  })
  if (!result) {
    toast.error(
      translate('auto.components.managerAgent.launchFailed', 'Could not start the Manager.')
    )
    return
  }
  const tabId = await resolveLaunchedTabId(result, tabIdsBefore)
  if (!tabId) {
    return
  }
  const tab = findManagerAgentTab(floatingTabs(), tabId)
  if (!tab) {
    return
  }
  useAppStore
    .getState()
    .setTabCustomTitle(
      tab.contentType === 'terminal' ? tab.entityId : tab.id,
      translate('auto.components.managerAgent.tabTitle', 'Manager'),
      { recordInteraction: false }
    )
  await window.api.ui.set({ managerAgentTabId: tab.id })
  focusManagerAgentTab(tab)
}

async function openOrCreateManagerAgentChat(launchSource: LaunchSource): Promise<void> {
  if (useAppStore.getState().settings?.experimentalManagerAgent !== true) {
    return
  }
  const { managerAgentTabId } = await window.api.ui.get()
  const existing = findManagerAgentTab(floatingTabs(), managerAgentTabId)
  if (existing) {
    focusManagerAgentTab(existing)
    return
  }
  await createManagerAgentChat(launchSource)
}

/** Focuses THE Manager chat in the floating workspace, creating it with its brief if it is gone. */
export function openManagerAgent(launchSource: LaunchSource): Promise<void> {
  // Why: a second click while the first launch is settling must not start a second Manager.
  pendingOpen ??= openOrCreateManagerAgentChat(launchSource)
    .catch((error) => {
      console.error('Failed to open the Manager', error)
      toast.error(
        translate('auto.components.managerAgent.launchFailed', 'Could not start the Manager.')
      )
    })
    .finally(() => {
      pendingOpen = null
    })
  return pendingOpen
}
