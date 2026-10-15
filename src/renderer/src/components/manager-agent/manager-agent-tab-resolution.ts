import type { Tab } from '../../../../shared/tab-types'
import type { TuiAgent } from '../../../../shared/tui-agent'
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
 * A chat-capable agent backs the Manager, because only a chat can render on the Manager page:
 * the user's default when it can chat, else the first installed chat-capable agent. Only when
 * none can chat does it fall back to the default, then any installed agent, as a terminal.
 */
export function pickManagerAgent(args: {
  defaultTuiAgent: TuiAgent | 'blank' | null | undefined
  detected: readonly TuiAgent[]
  disabled?: readonly unknown[] | null
}): TuiAgent | null {
  const preferred = args.defaultTuiAgent === 'blank' ? null : args.defaultTuiAgent
  const usable = (agent: TuiAgent): boolean =>
    args.detected.includes(agent) && pickTuiAgent(agent, [agent], args.disabled) !== null
  const chatCapable = args.detected.filter((agent) => isAgentSessionHandleProvider(agent))
  if (preferred && usable(preferred) && chatCapable.includes(preferred)) {
    return preferred
  }
  return (
    pickTuiAgent(null, chatCapable, args.disabled) ??
    (preferred && usable(preferred) ? preferred : null) ??
    pickTuiAgent(null, args.detected, args.disabled)
  )
}
