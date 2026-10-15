import type { AppState } from '@/store/types'
import { getRepoMapFromState } from '@/store/selectors'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import type { Project } from '../../../../shared/project-types'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  buildProjectGroupingIndex,
  getProjectGroupingForRepo
} from '../../../../shared/project-section-grouping'
import {
  GLOBAL_MANAGER_SCOPE_KEY,
  parseManagerScopeKey,
  projectManagerScopeKey,
  type ManagerScopeKey
} from '../../../../shared/manager-agent-records'

export type ManagerScopeState = Pick<
  AppState,
  'projects' | 'projectHostSetups' | 'repos' | 'worktreesByRepo'
>

export type ManagerScopeProject = {
  project: Project
  /** Primary worktrees first, then by name. */
  worktrees: Worktree[]
}

type ProjectIndex = {
  projects: ManagerScopeProject[]
  projectIdByWorktreeId: Map<string, string>
  worktreeById: Map<string, Worktree>
}

let cachedInputs: ManagerScopeState | null = null
let cachedIndex: ProjectIndex | null = null

function compareProjectWorktrees(a: Worktree, b: Worktree): number {
  if (a.isMainWorktree !== b.isMainWorktree) {
    return a.isMainWorktree ? -1 : 1
  }
  return a.displayName.localeCompare(b.displayName)
}

/**
 * Projects and their workspaces, grouped the way the sidebar groups them: by the project a
 * repo's host setup belongs to, else the worktree's own `projectId`. Repo-only worktrees with
 * no project have no project scope.
 */
function buildProjectIndex(state: ManagerScopeState): ProjectIndex {
  if (
    cachedIndex &&
    cachedInputs &&
    cachedInputs.projects === state.projects &&
    cachedInputs.projectHostSetups === state.projectHostSetups &&
    cachedInputs.repos === state.repos &&
    cachedInputs.worktreesByRepo === state.worktreesByRepo
  ) {
    return cachedIndex
  }
  const repoMap = getRepoMapFromState(state)
  const grouping = buildProjectGroupingIndex({
    projects: state.projects,
    projectHostSetups: state.projectHostSetups
  })
  const projectById = new Map(state.projects.map((project) => [project.id, project]))
  const worktreesByProjectId = new Map<string, Worktree[]>()
  const projectIdByWorktreeId = new Map<string, string>()
  const worktreeById = new Map<string, Worktree>()
  for (const worktrees of Object.values(state.worktreesByRepo)) {
    for (const worktree of worktrees) {
      worktreeById.set(worktree.id, worktree)
      const projectId =
        getProjectGroupingForRepo(worktree.repoId, repoMap, grouping).projectId ??
        worktree.projectId
      if (!projectId || !projectById.has(projectId) || worktree.isArchived) {
        continue
      }
      projectIdByWorktreeId.set(worktree.id, projectId)
      const list = worktreesByProjectId.get(projectId)
      if (list) {
        list.push(worktree)
      } else {
        worktreesByProjectId.set(projectId, [worktree])
      }
    }
  }
  const projects = state.projects
    .filter((project) => worktreesByProjectId.has(project.id))
    .map((project) => ({
      project,
      worktrees: [...(worktreesByProjectId.get(project.id) ?? [])].sort(compareProjectWorktrees)
    }))
  cachedInputs = state
  cachedIndex = { projects, projectIdByWorktreeId, worktreeById }
  return cachedIndex
}

export function listManagerScopeProjects(state: ManagerScopeState): ManagerScopeProject[] {
  return buildProjectIndex(state).projects
}

export function findManagerScopeProject(
  state: ManagerScopeState,
  projectId: string
): ManagerScopeProject | null {
  return buildProjectIndex(state).projects.find((entry) => entry.project.id === projectId) ?? null
}

export function findManagerScopeWorktree(
  state: ManagerScopeState,
  worktreeId: string
): Worktree | null {
  return buildProjectIndex(state).worktreeById.get(worktreeId) ?? null
}

export function projectIdForManagerWorktree(
  state: ManagerScopeState,
  worktreeId: string
): string | null {
  return buildProjectIndex(state).projectIdByWorktreeId.get(worktreeId) ?? null
}

/** The project a sidebar project header (anchored on one of its repos) stands for. */
export function projectIdForManagerRepo(state: ManagerScopeState, repoId: string): string | null {
  const grouping = buildProjectGroupingIndex({
    projects: state.projects,
    projectHostSetups: state.projectHostSetups
  })
  return getProjectGroupingForRepo(repoId, getRepoMapFromState(state), grouping).projectId ?? null
}

/** Where a scope's Manager chat lives, which also sets its cwd and execution host. */
export function resolveManagerHostWorktreeId(
  state: ManagerScopeState,
  scopeKey: ManagerScopeKey
): string | null {
  const scope = parseManagerScopeKey(scopeKey)
  if (!scope) {
    return null
  }
  if (scope.kind === 'global') {
    return FLOATING_TERMINAL_WORKTREE_ID
  }
  if (scope.kind === 'workspace') {
    return findManagerScopeWorktree(state, scope.worktreeId)?.id ?? null
  }
  const entry = findManagerScopeProject(state, scope.projectId)
  // Why first: worktrees are sorted primary-first, so a project with no main checkout on any
  // host still gets a stable host.
  return entry?.worktrees[0]?.id ?? null
}

/** Project → global; workspace → its project's Manager when one exists, else global. */
export function resolveDefaultParentScopeKey(
  state: ManagerScopeState & Pick<AppState, 'managerAgents'>,
  scopeKey: ManagerScopeKey
): ManagerScopeKey | undefined {
  const scope = parseManagerScopeKey(scopeKey)
  if (!scope || scope.kind === 'global') {
    return undefined
  }
  if (scope.kind === 'project') {
    return GLOBAL_MANAGER_SCOPE_KEY
  }
  const projectId = projectIdForManagerWorktree(state, scope.worktreeId)
  const projectKey = projectId ? projectManagerScopeKey(projectId) : null
  return projectKey && state.managerAgents[projectKey] ? projectKey : GLOBAL_MANAGER_SCOPE_KEY
}

/** Worktree ids a scope covers; null means every worktree (global). */
export function managerScopeWorktreeIds(
  state: ManagerScopeState,
  scopeKey: ManagerScopeKey
): ReadonlySet<string> | null {
  const scope = parseManagerScopeKey(scopeKey)
  if (!scope || scope.kind === 'global') {
    return null
  }
  if (scope.kind === 'workspace') {
    return new Set([scope.worktreeId])
  }
  return new Set(
    findManagerScopeProject(state, scope.projectId)?.worktrees.map((worktree) => worktree.id) ?? []
  )
}

export type ManagerScopeNames = {
  projectName: string | null
  workspaceName: string | null
}

export function managerScopeNames(
  state: ManagerScopeState,
  scopeKey: ManagerScopeKey
): ManagerScopeNames {
  const scope = parseManagerScopeKey(scopeKey)
  if (!scope || scope.kind === 'global') {
    return { projectName: null, workspaceName: null }
  }
  if (scope.kind === 'project') {
    return {
      projectName: findManagerScopeProject(state, scope.projectId)?.project.displayName ?? null,
      workspaceName: null
    }
  }
  const projectId = projectIdForManagerWorktree(state, scope.worktreeId)
  return {
    projectName: projectId
      ? (findManagerScopeProject(state, projectId)?.project.displayName ?? null)
      : null,
    workspaceName: findManagerScopeWorktree(state, scope.worktreeId)?.displayName ?? null
  }
}
