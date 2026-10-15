import { useMemo } from 'react'
import { useAppStore } from '@/store'
import type { Tab } from '../../../../shared/tab-types'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { selectManagerHostedTabIds, type ManagerHostedTabState } from '@/lib/manager-hosted-tabs'

type FloatingMountState = ManagerHostedTabState & {
  unifiedTabsByWorktree: Record<
    string,
    readonly Pick<Tab, 'id' | 'entityId' | 'contentType'>[] | undefined
  >
  tabsByWorktree: Record<string, readonly { id: string }[] | undefined>
}

/** Newline-joined floating terminal ids the panel may mount; null when no Manager is hosted. */
export function selectFloatingPanelTerminalMountKey(state: FloatingMountState): string | null {
  const hidden = selectManagerHostedTabIds(state)
  if (hidden.size === 0) {
    return null
  }
  const managerTerminalIds = new Set(
    (state.unifiedTabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? [])
      .filter((tab) => tab.contentType === 'terminal' && hidden.has(tab.id))
      .map((tab) => tab.entityId)
  )
  if (managerTerminalIds.size === 0) {
    return null
  }
  return (state.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? [])
    .map((tab) => tab.id)
    .filter((id) => !managerTerminalIds.has(id))
    .join('\n')
}

/**
 * Terminal tabs the floating panel may mount. Why: the Manager page owns its floating terminal's
 * pane, and two TerminalPanes for one tab would double-attach the PTY.
 */
export function useFloatingPanelTerminalMountTabIds(): ReadonlySet<string> | null {
  const key = useAppStore(selectFloatingPanelTerminalMountKey)
  return useMemo(() => (key === null ? null : new Set(key ? key.split('\n') : [])), [key])
}
