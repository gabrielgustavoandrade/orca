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
import { adoptAgentSessionLaunchVerdict } from '@/lib/agent-session-launch-plan'
import { resolveAgentLaunchExecutionContext } from '@/lib/launch-agent-execution-context'
import { resolveStartupShell } from '@/lib/tui-agent-startup'
import { resolveTuiAgentLaunchArgs } from '../../../../shared/tui-agent-launch-defaults'
import { TUI_AGENT_CONFIG } from '../../../../shared/tui-agent-config'
import {
  resolveManagerAgentSurface,
  type ManagerAgentSurface
} from '../../../../shared/agent-oversight-experimental-settings'
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
import { planManagerAgentBriefDelivery } from './manager-agent-brief-delivery'

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

type ManagerLaunch = Pick<
  Parameters<typeof launchAgentInNewTab>[0],
  'prompt' | 'agentArgs' | 'promptDelivery'
> &
  ({ requestId: ReturnType<typeof newAgentLaunchRequestId> } | {
    agentSessionLaunchPlan: ReturnType<typeof adoptAgentSessionLaunchVerdict>
  })

/** The route and brief delivery for a Manager on this surface; null when the host is unknown. */
function planManagerLaunch(
  surface: ManagerAgentSurface,
  agent: TuiAgent,
  hostWorktreeId: string,
  brief: string
): ManagerLaunch | null {
  const state = useAppStore.getState()
  const requestId = newAgentLaunchRequestId()
  if (surface === 'chat') {
    // Why first-message: structured launches have no hidden-instruction channel for any agent yet.
    return { requestId, prompt: brief }
  }
  // Why: the context already told the user why an unknown host cannot launch.
  const context = resolveAgentLaunchExecutionContext(state, { worktreeId: hostWorktreeId })
  if (!context) {
    return null
  }
  const delivery = planManagerAgentBriefDelivery({
    agent,
    surface,
    brief,
    shell: resolveStartupShell(context.resolvedLaunchPlatform, context.queuedShell),
    defaultAgentArgs: resolveTuiAgentLaunchArgs(agent, state.settings?.agentDefaultArgs)
  })
  return {
    // Why a terminal verdict: the agent's own CLI must run even when Chat UI is on.
    agentSessionLaunchPlan: adoptAgentSessionLaunchVerdict({
      route: 'terminal-tui',
      requestId,
      agent,
      worktreeId: hostWorktreeId
    }),
    prompt: delivery.prompt,
    ...(delivery.agentArgs !== undefined ? { agentArgs: delivery.agentArgs } : {}),
    // Why: a followup-path CLI would otherwise get the brief pasted but never sent.
    ...(TUI_AGENT_CONFIG[agent].promptInjectionMode === 'stdin-after-start'
      ? { promptDelivery: 'submit-after-ready' as const }
      : {})
  }
}

async function createManagerAgent(
  scopeKey: ManagerScopeKey,
  surface: ManagerAgentSurface,
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
    surface,
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
  const brief = buildManagerAgentBrief(resolveManagerAgentCliCommand(import.meta.env.DEV), briefScope)
  const launch = planManagerLaunch(surface, agent, hostWorktreeId, brief)
  if (!launch) {
    return
  }
  const tabIdsBefore = new Set(hostTabs(hostWorktreeId).map((tab) => tab.id))
  const result = launchAgentInNewTab({
    ...launch,
    agent,
    worktreeId: hostWorktreeId,
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
  // Why from the tab: a chat the host declined opened as a terminal, which the page hosts too.
  const isChat = tab.contentType === 'agent-session'
  after.setManagerAgentRecord({
    scopeKey,
    tabId: tab.id,
    ...(isChat ? { sessionId: tab.entityId } : {}),
    surface: isChat ? 'chat' : 'terminal',
    agent,
    hostWorktreeId,
    ...(parentScopeKey ? { parentScopeKey } : {}),
    briefVersion: MANAGER_AGENT_BRIEF_VERSION,
    createdAt: Date.now()
  })
  const promptName = managerAgentPromptName(after, scopeKey)
  after.setTabCustomTitle(
    isChat ? tab.id : tab.entityId,
    promptName.charAt(0).toUpperCase() + promptName.slice(1),
    { recordInteraction: false }
  )
}

async function openOrCreateManagerAgent(
  scopeKey: ManagerScopeKey,
  launchSource: LaunchSource,
  replaceLive: boolean
): Promise<void> {
  const state = useAppStore.getState()
  if (state.settings?.experimentalManagerAgent !== true) {
    return
  }
  state.setManagerScope(scopeKey)
  state.setActiveView('manager')
  if (
    !replaceLive &&
    findManagerRecordTab(state.unifiedTabsByWorktree, state.managerAgents[scopeKey])
  ) {
    return
  }
  setManagerScopeLaunching(scopeKey, true)
  try {
    await createManagerAgent(scopeKey, resolveManagerAgentSurface(state.settings), launchSource)
  } finally {
    setManagerScopeLaunching(scopeKey, false)
  }
}

function runManagerOpen(
  scopeKey: ManagerScopeKey,
  launchSource: LaunchSource,
  replaceLive: boolean
): Promise<void> {
  const pending = pendingOpens.get(scopeKey)
  if (pending) {
    useAppStore.getState().setManagerScope(scopeKey)
    useAppStore.getState().setActiveView('manager')
    return pending
  }
  // Why: a second click while the first launch is settling must not start a second Manager.
  const open = openOrCreateManagerAgent(scopeKey, launchSource, replaceLive)
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

/**
 * Shows a scope's Manager on the Manager page, starting it with its brief when it has none or
 * its tab is gone. Resume is not attempted: a gone Manager is replaced by a fresh one.
 */
export function openManagerScope(
  scopeKey: ManagerScopeKey,
  launchSource: LaunchSource
): Promise<void> {
  return runManagerOpen(scopeKey, launchSource, false)
}

/**
 * Starts a new Manager on the surface the settings pick and replaces the scope's record. The old
 * tab is left open, now visible in its workspace, so its running work is never killed silently.
 */
export function startNewManagerForScope(
  scopeKey: ManagerScopeKey,
  launchSource: LaunchSource
): Promise<void> {
  return runManagerOpen(scopeKey, launchSource, true)
}

/** Opens the all-projects Manager. */
export function openManagerAgent(launchSource: LaunchSource): Promise<void> {
  return openManagerScope(GLOBAL_MANAGER_SCOPE_KEY, launchSource)
}
