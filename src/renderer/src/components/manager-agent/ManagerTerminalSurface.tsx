import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { Tab } from '../../../../shared/tab-types'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import type { ManagerAgentRecord } from '../../../../shared/manager-agent-records'
import {
  setActivityTerminalPortals,
  type ActivityTerminalPortalTarget
} from '../activity/activity-terminal-portal'
import { useActivityTerminalPortalStatus } from '../activity/activity-terminal-portal-status'
import { resolveTerminalLayoutActiveLeafId } from '../terminal-pane/terminal-layout-leaf-ids'
import TerminalPaneOverlayLayer from '../terminal-pane/TerminalPaneOverlayLayer'
import { requestBackgroundTerminalWorktreeMount } from '../terminal/background-terminal-worktree-mount'
import { focusTerminalTabSurface } from '@/lib/focus-terminal-tab-surface'

/** The leaf the page shows: the tab's active (or first bound) leaf, once its pane wrote a layout. */
function useManagerTerminalLeafId(terminalTabId: string): string | null {
  return useAppStore((state) => {
    const layout = state.terminalLayoutsByTabId[terminalTabId]
    return layout
      ? resolveTerminalLayoutActiveLeafId({
          root: layout.root,
          activeLeafId: layout.activeLeafId,
          ptyIdsByLeafId: layout.ptyIdsByLeafId
        })
      : null
  })
}

function useFloatingWorkspacePath(enabled: boolean): string {
  const path = useAppStore((state) => state.floatingWorkspacePath)
  const configured = useAppStore((state) => state.settings?.floatingTerminalCwd ?? '')
  const setFloatingWorkspacePath = useAppStore((state) => state.setFloatingWorkspacePath)
  useEffect(() => {
    if (!enabled || path) {
      return
    }
    // Why: the floating panel resolves this only while mounted, and a Manager-only floating
    // workspace never mounts it.
    let cancelled = false
    void window.api.app.getFloatingTerminalCwd({ path: configured }).then((resolved) => {
      if (!cancelled) {
        setFloatingWorkspacePath(resolved)
      }
    })
    return () => {
      cancelled = true
    }
  }, [configured, enabled, path, setFloatingWorkspacePath])
  return path ?? ''
}

/**
 * The Manager's terminal, portaled into the page through the Activity portal. A repo host's pane
 * is mounted by the workspace Terminal tree (background-mounted for just this tab); the floating
 * workspace is not in that tree, so the page mounts its pane here and the panel skips it.
 */
export function ManagerTerminalSurface({
  record,
  tab
}: {
  record: ManagerAgentRecord
  tab: Tab
}): React.JSX.Element {
  const terminalTabId = tab.entityId
  const hostWorktreeId = record.hostWorktreeId
  const isFloatingHost = hostWorktreeId === FLOATING_TERMINAL_WORKTREE_ID
  const floatingPath = useFloatingWorkspacePath(isFloatingHost)
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  const leafId = useManagerTerminalLeafId(terminalTabId)
  const paneKey = leafId ? makePaneKey(terminalTabId, leafId) : null

  useEffect(() => {
    if (!isFloatingHost) {
      // Why: a host worktree the user never opened has no mounted pane, so its PTY never starts.
      requestBackgroundTerminalWorktreeMount({ worktreeId: hostWorktreeId, tabIds: [terminalTabId] })
    }
  }, [hostWorktreeId, isFloatingHost, terminalTabId])

  const portal = useMemo<ActivityTerminalPortalTarget | null>(
    () =>
      slot && paneKey
        ? {
            slotId: 'manager',
            requestToken: `manager:${paneKey}`,
            target: slot,
            worktreeId: hostWorktreeId,
            tabId: terminalTabId,
            paneKey,
            active: true
          }
        : null,
    [hostWorktreeId, paneKey, slot, terminalTabId]
  )
  const portals = useMemo(() => (portal ? [portal] : []), [portal])
  const floatingMountTabIds = useMemo(() => new Set([terminalTabId]), [terminalTabId])

  // Why layout effect: publish before paint so the pane moves in the same commit (see Activity).
  useLayoutEffect(() => {
    setActivityTerminalPortals(portals)
  }, [portals])
  useEffect(() => () => setActivityTerminalPortals([]), [])

  const status = useActivityTerminalPortalStatus(slot, paneKey)
  useEffect(() => {
    if (status === 'ready' && leafId) {
      focusTerminalTabSurface(terminalTabId, leafId)
    }
  }, [leafId, status, terminalTabId])

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={setSlot} className="absolute inset-0" data-manager-terminal-slot="" />
      {status === 'ready' ? null : (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {status === 'unavailable'
            ? translate(
                'auto.components.managerAgent.terminalUnavailable',
                'The Manager’s terminal is not available right now.'
              )
            : translate('auto.components.managerAgent.terminalConnecting', 'Connecting terminal…')}
        </div>
      )}
      {isFloatingHost && floatingPath ? (
        <TerminalPaneOverlayLayer
          worktreeId={FLOATING_TERMINAL_WORKTREE_ID}
          worktreePath={floatingPath}
          isWorktreeActive={false}
          activityTerminalPortals={portals}
          backgroundMountTabIds={floatingMountTabIds}
          ownsNativeChatToggleShortcut={false}
        />
      ) : null}
    </div>
  )
}
