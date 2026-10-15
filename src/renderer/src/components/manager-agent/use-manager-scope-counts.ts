import { useMemo } from 'react'
import { useAppStore } from '@/store'
import type { ManagerScopeKey } from '../../../../shared/manager-agent-records'
import { managerScopeWorktreeIds } from './manager-agent-scope'
import {
  countManagerOverview,
  filterManagerOverviewByScope,
  type ManagerOverview,
  type ManagerOverviewCounts
} from './manager-overview-data'
import { useManagerOverview } from './manager-overview-poller'

const ZERO: ManagerOverviewCounts = { working: 0, needsYou: 0 }

/** A scope's slice of the shared overview; the global scope keeps every run. */
export function useScopedManagerOverview(
  scopeKey: ManagerScopeKey,
  options: { enabled: boolean; page?: boolean }
): { overview: ManagerOverview | null; failed: boolean } {
  const snapshot = useManagerOverview(options)
  const worktreesByRepo = useAppStore((state) => state.worktreesByRepo)
  const projects = useAppStore((state) => state.projects)
  const projectHostSetups = useAppStore((state) => state.projectHostSetups)
  const repos = useAppStore((state) => state.repos)
  const worktreeIds = useMemo(
    () =>
      managerScopeWorktreeIds({ worktreesByRepo, projects, projectHostSetups, repos }, scopeKey),
    [projectHostSetups, projects, repos, scopeKey, worktreesByRepo]
  )
  const overview = useMemo(
    () => (snapshot.overview ? filterManagerOverviewByScope(snapshot.overview, worktreeIds) : null),
    [snapshot.overview, worktreeIds]
  )
  return { overview, failed: snapshot.failed }
}

/** Working and needs-you counts for one scope; zero while `enabled` is false. */
export function useManagerScopeCounts(
  scopeKey: ManagerScopeKey,
  enabled: boolean
): ManagerOverviewCounts {
  const { overview } = useScopedManagerOverview(scopeKey, { enabled })
  return useMemo(
    () => (enabled && overview ? countManagerOverview(overview) : ZERO),
    [enabled, overview]
  )
}
