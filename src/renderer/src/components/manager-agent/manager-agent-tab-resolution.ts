import type { Tab } from '../../../../shared/tab-types'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { ManagerAgentSurface } from '../../../../shared/agent-oversight-experimental-settings'
import { isAgentSessionHandleProvider } from '../../../../shared/agent-session-provider-handle'
import { pickTuiAgent } from '../../../../shared/tui-agent-selection'

type ManagerAgentTab = Pick<Tab, 'id' | 'entityId' | 'contentType'>

/** The persisted Manager tab if it still exists; a terminal launch remembers its terminal id. */
export function findManagerAgentTab<T extends ManagerAgentTab>(
  tabs: readonly T[],
  managerTabId: string | null | undefined
): T | null {
  if (!managerTabId) {
    return null
  }
  return (
    tabs.find(
      (tab) =>
        (tab.contentType === 'agent-session' || tab.contentType === 'terminal') &&
        (tab.id === managerTabId ||
          (tab.contentType === 'terminal' && tab.entityId === managerTabId))
    ) ?? null
  )
}

/** The one tab a launch added, when its route did not report the tab id itself. */
export function findAddedManagerAgentTab<T extends ManagerAgentTab>(
  tabIdsBefore: ReadonlySet<string>,
  tabsAfter: readonly T[]
): T | null {
  const added = tabsAfter.filter(
    (tab) =>
      !tabIdsBefore.has(tab.id) &&
      (tab.contentType === 'agent-session' || tab.contentType === 'terminal')
  )
  return added.length === 1 ? added[0] : null
}

/**
 * The agent for a new Manager. A terminal Manager runs any CLI: the user's default when it is
 * installed, else the first detected. A chat Manager prefers chat-capable agents: the default when
 * it can chat, else the first chat-capable one, then the default and any agent as a terminal.
 */
export function pickManagerAgent(args: {
  surface: ManagerAgentSurface
  defaultTuiAgent: TuiAgent | 'blank' | null | undefined
  detected: readonly TuiAgent[]
  disabled?: readonly unknown[] | null
}): TuiAgent | null {
  const preferred = args.defaultTuiAgent === 'blank' ? null : args.defaultTuiAgent
  const usable = (agent: TuiAgent): boolean =>
    args.detected.includes(agent) && pickTuiAgent(agent, [agent], args.disabled) !== null
  const usablePreferred = preferred && usable(preferred) ? preferred : null
  if (args.surface === 'terminal') {
    return usablePreferred ?? pickTuiAgent(null, args.detected, args.disabled)
  }
  const chatCapable = args.detected.filter((agent) => isAgentSessionHandleProvider(agent))
  if (usablePreferred && chatCapable.includes(usablePreferred)) {
    return usablePreferred
  }
  return (
    pickTuiAgent(null, chatCapable, args.disabled) ??
    usablePreferred ??
    pickTuiAgent(null, args.detected, args.disabled)
  )
}
