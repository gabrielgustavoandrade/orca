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
 * The user's default agent backs the Manager; otherwise the first installed agent that can open
 * as a chat, then any installed agent. A "blank" default still needs an agent here.
 */
export function pickManagerAgent(args: {
  defaultTuiAgent: TuiAgent | 'blank' | null | undefined
  detected: readonly TuiAgent[]
  disabled?: readonly unknown[] | null
}): TuiAgent | null {
  const preferred = args.defaultTuiAgent === 'blank' ? null : args.defaultTuiAgent
  if (
    preferred &&
    args.detected.includes(preferred) &&
    pickTuiAgent(preferred, [preferred], args.disabled)
  ) {
    return preferred
  }
  const chatCapable = args.detected.filter((agent) => isAgentSessionHandleProvider(agent))
  return (
    pickTuiAgent(null, chatCapable, args.disabled) ??
    pickTuiAgent(null, args.detected, args.disabled)
  )
}
