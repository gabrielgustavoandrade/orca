import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { structuredAgentSessionTabId } from '../../../../shared/structured-agent-session-projection'
import { withTimeout } from '../../../../shared/promise-timeout-fallback'
import type { Tab } from '../../../../shared/tab-types'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { LaunchSource } from '../../../../shared/telemetry-events'
import {
  GLOBAL_MANAGER_SCOPE_KEY,
  type ManagerAgentRecord,
  type ManagerScopeKey
} from '../../../../shared/manager-agent-records'
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
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { focusTerminalTabSurface } from '@/lib/focus-terminal-tab-surface'
import {
  buildManagerAgentBrief,
  MANAGER_AGENT_BRIEF_VERSION,
  resolveManagerAgentCliCommand
} from './manager-agent-brief'
import { buildManagerBriefScope, managerAgentPromptName } from './manager-agent-brief-scope'
import {
  findAddedManagerAgentTab,
  findManagerAgentTab,
  pickManagerAgent
} from './manager-agent-tab-resolution'
import { resolveDefaultParentScopeKey, resolveManagerHostWorktreeId } from './manager-agent-scope'
import { setManagerScopeLaunching } from './manager-agent-launch-state'

// Why bounded: detection only picks the agent; a slow host must not leave the click hanging.
const AGENT_DETECTION_TIMEOUT_MS = 5_000

const pendingOpens = new Map<ManagerScopeKey, Promise<void>>()

function hostTabs(worktreeId: string): Tab[] {
  return useAppStore.getState().unifiedTabsByWorktree[worktreeId] ?? []
}

function launchFailed(): void {
  toast.error(
    translate('auto.components.managerAgent.launchFailed', 'Could not start the Manager.')
  )
}

/** The record's tab, when it still exists in its host workspace. */
export function findManagerRecordTab(
  tabsByWorktree: Record<string, Tab[] | undefined>,
  record: ManagerAgentRecord | undefined
): Tab | null {
  return record
    ? findManagerAgentTab(tabsByWorktree[record.hostWorktreeId] ?? [], record.tabId)
    : null
}

/** Shows a terminal-fallback Manager where its PTY lives; the Manager page cannot host it. */
export function revealTerminalManager(record: ManagerAgentRecord): void {
  const state = useAppStore.getState()
  const tab = findManagerRecordTab(state.unifiedTabsByWorktree, record)
  if (!tab || tab.contentType !== 'terminal') {
    return
  }
  const worktreeId = record.hostWorktreeId
  // Why: the floating workspace reveals its panel here; any other host becomes the active worktree.
  activateAndRevealWorktree(worktreeId)
  state.focusGroup(worktreeId, tab.groupId)
  state.setActiveTabForWorktree(worktreeId, tab.entityId)
  state.activateTab(tab.id, { worktreeId })
  state.setActiveTabType('terminal', worktreeId)
  focusTerminalTabSurface(tab.entityId)
}

async function detectAgents(worktreeId: string): Promise<TuiAgent[]> {
  const state = useAppStore.getState()
  const target = parseAgentDetectionTargetKey(
    getAgentDetectionTargetKeyForWorktree(state, worktreeId)
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
  hostWorktreeId: string,
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
    return findAddedManagerAgentTab(tabIdsBefore, hostTabs(hostWorktreeId))?.id ?? null
  }
  if (settlement.kind === 'failed' && !settlement.notified) {
    launchFailed()
  }
  return null
}

async function createManagerAgentChat(
  scopeKey: ManagerScopeKey,
  launchSource: LaunchSource
): Promise<void> {
  const state = useAppStore.getState()
  const hostWorktreeId = resolveManagerHostWorktreeId(state, scopeKey)
  if (!hostWorktreeId) {
    toast.error(
      translate(
        'auto.components.managerAgent.noHost',
        'This project has no workspace to run its Manager in.'
      )
    )
    return
  }
  const agent = pickManagerAgent({
    defaultTuiAgent: state.settings?.defaultTuiAgent,
    detected: await detectAgents(hostWorktreeId),
    disabled: state.settings?.disabledTuiAgents
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
  const current = useAppStore.getState()
  const parentScopeKey = resolveDefaultParentScopeKey(current, scopeKey)
  const briefScope = buildManagerBriefScope(current, scopeKey, parentScopeKey)
  if (!briefScope) {
    launchFailed()
    return
  }
  const tabIdsBefore = new Set(hostTabs(hostWorktreeId).map((tab) => tab.id))
  // Why first-message: structured launches have no hidden-instruction channel for any agent yet.
  const result = launchAgentInNewTab({
    requestId: newAgentLaunchRequestId(),
    agent,
    worktreeId: hostWorktreeId,
    prompt: buildManagerAgentBrief(resolveManagerAgentCliCommand(import.meta.env.DEV), briefScope),
    launchSource,
    // Why: a Manager must not take the main window's tab selection in its host workspace.
    activate: false
  })
  if (!result) {
    launchFailed()
    return
  }
  const tabId = await resolveLaunchedTabId(result, hostWorktreeId, tabIdsBefore)
  const tab = tabId ? findManagerAgentTab(hostTabs(hostWorktreeId), tabId) : null
  if (!tab) {
    return
  }
  const after = useAppStore.getState()
  after.setManagerAgentRecord({
    scopeKey,
    tabId: tab.id,
    ...(tab.contentType === 'agent-session' ? { sessionId: tab.entityId } : {}),
    agent,
    hostWorktreeId,
    ...(parentScopeKey ? { parentScopeKey } : {}),
    briefVersion: MANAGER_AGENT_BRIEF_VERSION,
    createdAt: Date.now()
  })
  const promptName = managerAgentPromptName(after, scopeKey)
  after.setTabCustomTitle(
    tab.contentType === 'terminal' ? tab.entityId : tab.id,
    promptName.charAt(0).toUpperCase() + promptName.slice(1),
    { recordInteraction: false }
  )
}

async function openOrCreateManagerAgentChat(
  scopeKey: ManagerScopeKey,
  launchSource: LaunchSource
): Promise<void> {
  const state = useAppStore.getState()
  if (state.settings?.experimentalManagerAgent !== true) {
    return
  }
  state.setManagerScope(scopeKey)
  state.setActiveView('manager')
  if (findManagerRecordTab(state.unifiedTabsByWorktree, state.managerAgents[scopeKey])) {
    return
  }
  setManagerScopeLaunching(scopeKey, true)
  try {
    await createManagerAgentChat(scopeKey, launchSource)
  } finally {
    setManagerScopeLaunching(scopeKey, false)
  }
}

/**
 * Shows a scope's Manager on the Manager page, starting it with its brief when it has none or
 * its chat is gone. Resume is not attempted: a gone chat is replaced by a fresh one.
 */
export function openManagerScope(
  scopeKey: ManagerScopeKey,
  launchSource: LaunchSource
): Promise<void> {
  const pending = pendingOpens.get(scopeKey)
  if (pending) {
    useAppStore.getState().setManagerScope(scopeKey)
    useAppStore.getState().setActiveView('manager')
    return pending
  }
  // Why: a second click while the first launch is settling must not start a second Manager.
  const open = openOrCreateManagerAgentChat(scopeKey, launchSource)
    .catch((error) => {
      console.error('Failed to open the Manager', error)
      launchFailed()
    })
    .finally(() => {
      pendingOpens.delete(scopeKey)
    })
  pendingOpens.set(scopeKey, open)
  return open
}

/** Opens the all-projects Manager. */
export function openManagerAgent(launchSource: LaunchSource): Promise<void> {
  return openManagerScope(GLOBAL_MANAGER_SCOPE_KEY, launchSource)
}
