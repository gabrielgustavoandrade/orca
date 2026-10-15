import type { AppState } from '@/store/types'
import { getRepoMapFromState } from '@/store/selectors'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  parseManagerScopeKey,
  projectManagerScopeKey,
  type ManagerScopeKey
} from '../../../../shared/manager-agent-records'
import type {
  ManagerBriefProject,
  ManagerBriefScope,
  ManagerBriefWorkspace
} from './manager-agent-brief'
import {
  findManagerScopeProject,
  findManagerScopeWorktree,
  listManagerScopeProjects,
  managerScopeNames,
  type ManagerScopeProject,
  type ManagerScopeState
} from './manager-agent-scope'

type BriefState = ManagerScopeState & Pick<AppState, 'managerAgents'>

function briefWorkspace(worktree: Worktree): ManagerBriefWorkspace {
  return {
    id: worktree.id,
    name: worktree.displayName,
    path: worktree.path,
    branch: worktree.branch?.replace(/^refs\/heads\//, '') || null
  }
}

function briefProject(state: BriefState, entry: ManagerScopeProject): ManagerBriefProject {
  const repoMap = getRepoMapFromState(state)
  const repoPaths = new Set<string>()
  for (const worktree of entry.worktrees) {
    const repoPath = repoMap.get(worktree.repoId)?.path
    if (repoPath) {
      repoPaths.add(repoPath)
    }
  }
  return { id: entry.project.id, name: entry.project.displayName, repoPaths: [...repoPaths] }
}

/** English name a Manager uses for another Manager in its brief, e.g. "orca Manager". */
export function managerAgentPromptName(state: BriefState, scopeKey: ManagerScopeKey): string {
  const scope = parseManagerScopeKey(scopeKey)
  if (!scope || scope.kind === 'global') {
    return 'all-projects Manager'
  }
  const names = managerScopeNames(state, scopeKey)
  const name = scope.kind === 'project' ? names.projectName : names.workspaceName
  return `${name ?? scope.kind} Manager`
}

/** The facts a scope's brief names, read from the store at launch time. */
export function buildManagerBriefScope(
  state: BriefState,
  scopeKey: ManagerScopeKey,
  parentScopeKey: ManagerScopeKey | undefined
): ManagerBriefScope | null {
  const scope = parseManagerScopeKey(scopeKey)
  if (!scope) {
    return null
  }
  // Why only a parent with a record: an unstarted parent cannot receive reports.
  const reportsTo =
    parentScopeKey && state.managerAgents[parentScopeKey]
      ? managerAgentPromptName(state, parentScopeKey)
      : null
  if (scope.kind === 'global') {
    const projects = listManagerScopeProjects(state)
    return {
      kind: 'global',
      projects: projects.map((entry) => briefProject(state, entry)),
      projectManagers: projects
        .filter((entry) => state.managerAgents[projectManagerScopeKey(entry.project.id)])
        .map((entry) => `${entry.project.displayName} Manager`)
    }
  }
  if (scope.kind === 'project') {
    const entry = findManagerScopeProject(state, scope.projectId)
    if (!entry) {
      return null
    }
    const primary = entry.worktrees[0]
    return {
      kind: 'project',
      project: briefProject(state, entry),
      primaryWorkspace: primary ? briefWorkspace(primary) : null,
      reportsTo
    }
  }
  const worktree = findManagerScopeWorktree(state, scope.worktreeId)
  if (!worktree) {
    return null
  }
  return {
    kind: 'workspace',
    workspace: briefWorkspace(worktree),
    projectName: managerScopeNames(state, scopeKey).projectName,
    reportsTo
  }
}
