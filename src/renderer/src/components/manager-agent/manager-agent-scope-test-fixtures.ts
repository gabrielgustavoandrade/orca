import type { Project, ProjectHostSetup } from '../../../../shared/project-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import type { ManagerAgentRecords } from '../../../../shared/manager-agent-records'
import { makeWorktree } from '../worktree-jump-palette-test-fixtures'
import type { ManagerScopeState } from './manager-agent-scope'

export function makeProject(id: string, displayName: string): Project {
  return { id, displayName, badgeColor: 'gray', sourceRepoIds: [], createdAt: 0, updatedAt: 0 }
}

export function makeRepo(id: string, path: string): Repo {
  return { id, path, displayName: id, badgeColor: 'gray', addedAt: 0, kind: 'git' }
}

export function makeSetup(projectId: string, repoId: string, path: string): ProjectHostSetup {
  return {
    id: `setup-${repoId}`,
    projectId,
    hostId: 'local',
    repoId,
    path,
    displayName: repoId,
    setupState: 'ready',
    setupMethod: 'legacy-repo',
    createdAt: 0,
    updatedAt: 0
  }
}

/**
 * Two projects as the sidebar groups them: orca (repo-orca, a primary and a feature workspace)
 * and ryba (repo-ryba, one primary workspace), plus a repo with no project.
 */
export function makeManagerScopeState(
  managerAgents: ManagerAgentRecords = {}
): ManagerScopeState & { managerAgents: ManagerAgentRecords } {
  const orcaWorktrees: Worktree[] = [
    makeWorktree('orca-feat', 'feat/manager-agent', {
      repoId: 'repo-orca',
      path: '/src/orca-feat',
      branch: 'refs/heads/feat/manager-agent'
    }),
    makeWorktree('orca-main', 'main', {
      repoId: 'repo-orca',
      path: '/src/orca',
      isMainWorktree: true
    }),
    makeWorktree('orca-old', 'old', { repoId: 'repo-orca', isArchived: true })
  ]
  return {
    projects: [makeProject('p-orca', 'orca'), makeProject('p-ryba', 'ryba')],
    projectHostSetups: [
      makeSetup('p-orca', 'repo-orca', '/src/orca'),
      makeSetup('p-ryba', 'repo-ryba', '/src/ryba')
    ],
    repos: [
      makeRepo('repo-orca', '/src/orca'),
      makeRepo('repo-ryba', '/src/ryba'),
      makeRepo('repo-loose', '/src/loose')
    ],
    worktreesByRepo: {
      'repo-orca': orcaWorktrees,
      'repo-ryba': [
        makeWorktree('ryba-main', 'main', { repoId: 'repo-ryba', isMainWorktree: true })
      ],
      'repo-loose': [makeWorktree('loose-main', 'main', { repoId: 'repo-loose' })]
    },
    managerAgents
  }
}
