import { useEffect } from 'react'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { selectManagerHostedTabIds } from '@/lib/manager-hosted-tabs'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'

type RepairState = Pick<
  AppState,
  | 'groupsByWorktree'
  | 'unifiedTabsByWorktree'
  | 'activeWorktreeId'
  | 'activeView'
  | 'managerAgents'
  | 'settings'
  | 'activateTab'
  | 'createTab'
>

/** Tab ids a group should show instead of a hidden Manager chat, most recent first. */
export function nextVisibleGroupTabId(
  group: { recentTabIds?: string[]; tabOrder: string[] },
  liveTabIds: ReadonlySet<string>,
  hiddenTabIds: ReadonlySet<string>
): string | null {
  const candidates = (group.recentTabIds ?? []).toReversed().concat(group.tabOrder)
  return candidates.find((id) => liveTabIds.has(id) && !hiddenTabIds.has(id)) ?? null
}

/**
 * Keeps a hidden Manager chat from being the tab a workspace shows. A group whose active tab is a
 * Manager falls back to its previous visible tab; the active workspace with nothing else in it
 * gets a terminal, as a never-visited workspace does.
 */
export function repairManagerHostedActiveTabs(state: RepairState, worktreeId: string): void {
  const hiddenTabIds = selectManagerHostedTabIds(state)
  if (hiddenTabIds.size === 0) {
    return
  }
  const tabs = state.unifiedTabsByWorktree[worktreeId] ?? []
  const liveTabIds = new Set(tabs.map((tab) => tab.id))
  for (const group of state.groupsByWorktree[worktreeId] ?? []) {
    if (!group.activeTabId || !hiddenTabIds.has(group.activeTabId)) {
      continue
    }
    const next = nextVisibleGroupTabId(group, liveTabIds, hiddenTabIds)
    if (next) {
      state.activateTab(next, { worktreeId, recordFocus: false })
    }
  }
  const hasVisibleTab = tabs.some((tab) => !hiddenTabIds.has(tab.id))
  if (
    !hasVisibleTab &&
    tabs.length > 0 &&
    worktreeId !== FLOATING_TERMINAL_WORKTREE_ID &&
    state.activeWorktreeId === worktreeId &&
    state.activeView === 'terminal'
  ) {
    state.createTab(worktreeId)
  }
}

/** Runs the repair for the active and floating workspaces whenever their tabs or groups move. */
export function useManagerHostedTabRepair(): void {
  const enabled = useAppStore((state) => state.settings?.experimentalManagerAgent === true)
  useEffect(() => {
    if (!enabled) {
      return
    }
    const run = (state: AppState): void => {
      for (const worktreeId of [state.activeWorktreeId, FLOATING_TERMINAL_WORKTREE_ID]) {
        if (worktreeId) {
          repairManagerHostedActiveTabs(state, worktreeId)
        }
      }
    }
    run(useAppStore.getState())
    return useAppStore.subscribe((state, previous) => {
      const id = state.activeWorktreeId
      if (
        state.managerAgents !== previous.managerAgents ||
        state.activeWorktreeId !== previous.activeWorktreeId ||
        state.activeView !== previous.activeView ||
        (id && state.groupsByWorktree[id] !== previous.groupsByWorktree[id]) ||
        state.groupsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] !==
          previous.groupsByWorktree[FLOATING_TERMINAL_WORKTREE_ID]
      ) {
        run(state)
      }
    })
  }, [enabled])
}
