import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { joinPath } from '@/lib/path'
import { launchAgentInNewTabWithOutcome } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { requestBackgroundTerminalWorktreeMount } from '@/components/terminal/background-terminal-worktree-mount'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import { normalizeRuntimePathForComparison } from '../../../../shared/cross-platform-path'
import { folderWorkspaceKey } from '../../../../shared/workspace-scope'

const MASTER_FOLDER_NAME = 'master-agent'
const MASTER_WORKSPACE_NAME = 'Master'

export type MasterAgent = {
  worktreeId: string | null
  tabId: string | null
  starting: boolean
  start: () => Promise<void>
}

/**
 * The master is a folder workspace rooted in Orca's userData; its first terminal tab runs `claude`.
 * Identity is the folder path, so no setting or record is needed to find it again after a restart.
 */
export function useMasterAgent(): MasterAgent {
  const folderWorkspaces = useAppStore((s) => s.folderWorkspaces)
  const tabsByWorktree = useAppStore((s) => s.tabsByWorktree)
  const [masterDir, setMasterDir] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void window.api.app.getFloatingMarkdownDirectory().then((base) => {
      if (!cancelled) {
        setMasterDir(joinPath(base, MASTER_FOLDER_NAME))
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const workspace = useMemo(() => {
    if (!masterDir) {
      return null
    }
    const wanted = normalizeRuntimePathForComparison(masterDir)
    return (
      folderWorkspaces.find(
        (row) => !row.isArchived && normalizeRuntimePathForComparison(row.folderPath) === wanted
      ) ?? null
    )
  }, [folderWorkspaces, masterDir])
  const worktreeId = workspace ? folderWorkspaceKey(workspace.id) : null
  const tabId = worktreeId ? (tabsByWorktree[worktreeId]?.[0]?.id ?? null) : null

  // Why: a restored master tab has no mounted pane until its worktree is asked to mount in the background.
  useEffect(() => {
    if (worktreeId && tabId) {
      requestBackgroundTerminalWorktreeMount({ worktreeId, tabIds: [tabId] })
    }
  }, [worktreeId, tabId])

  const start = useCallback(async (): Promise<void> => {
    if (!masterDir || starting) {
      return
    }
    setStarting(true)
    try {
      const state = useAppStore.getState()
      let target = workspace
      if (!target) {
        // Fails only when the folder already exists, which is fine.
        await window.api.fs.createDir({ dirPath: masterDir }).catch(() => undefined)
        const group = await state.createProjectGroup(MASTER_WORKSPACE_NAME, LOCAL_EXECUTION_HOST_ID)
        if (!group) {
          return
        }
        target = await state.createFolderWorkspace(
          { projectGroupId: group.id, name: MASTER_WORKSPACE_NAME, folderPath: masterDir },
          { runtimeEnvironmentId: null }
        )
      }
      if (!target) {
        return
      }
      launchAgentInNewTabWithOutcome({
        agent: 'claude',
        worktreeId: folderWorkspaceKey(target.id),
        requestedSurface: 'terminal',
        activate: false,
        launchSource: 'unknown'
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setStarting(false)
    }
  }, [masterDir, starting, workspace])

  return { worktreeId, tabId, starting, start }
}
