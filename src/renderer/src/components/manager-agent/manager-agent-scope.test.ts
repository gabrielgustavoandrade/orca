import { describe, expect, it } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import type { ManagerAgentRecord } from '../../../../shared/manager-agent-records'
import {
  listManagerScopeProjects,
  managerScopeNames,
  managerScopeWorktreeIds,
  projectIdForManagerRepo,
  projectIdForManagerWorktree,
  resolveDefaultParentScopeKey,
  resolveManagerHostWorktreeId
} from './manager-agent-scope'
import { makeManagerScopeState } from './manager-agent-scope-test-fixtures'

function record(scopeKey: ManagerAgentRecord['scopeKey']): ManagerAgentRecord {
  return {
    scopeKey,
    tabId: `tab-${scopeKey}`,
    surface: 'terminal',
    agent: 'claude',
    hostWorktreeId: 'orca-main',
    briefVersion: 2,
    createdAt: 1
  }
}

describe('manager scope resolution', () => {
  it('groups workspaces by the project their repo is set up under, primary first', () => {
    const projects = listManagerScopeProjects(makeManagerScopeState())
    expect(projects.map((entry) => entry.project.id)).toEqual(['p-orca', 'p-ryba'])
    // Archived workspaces are not scopes.
    expect(projects[0].worktrees.map((worktree) => worktree.id)).toEqual(['orca-main', 'orca-feat'])
  })

  it('maps worktrees and repos to their project, and leaves project-less repos out', () => {
    const state = makeManagerScopeState()
    expect(projectIdForManagerWorktree(state, 'orca-feat')).toBe('p-orca')
    expect(projectIdForManagerWorktree(state, 'loose-main')).toBeNull()
    expect(projectIdForManagerRepo(state, 'repo-ryba')).toBe('p-ryba')
    expect(projectIdForManagerRepo(state, 'repo-loose')).toBeNull()
  })

  it('hosts global in the floating workspace, a project in its primary, a workspace in itself', () => {
    const state = makeManagerScopeState()
    expect(resolveManagerHostWorktreeId(state, 'global')).toBe(FLOATING_TERMINAL_WORKTREE_ID)
    expect(resolveManagerHostWorktreeId(state, 'project:p-orca')).toBe('orca-main')
    expect(resolveManagerHostWorktreeId(state, 'workspace:orca-feat')).toBe('orca-feat')
    expect(resolveManagerHostWorktreeId(state, 'workspace:gone')).toBeNull()
    expect(resolveManagerHostWorktreeId(state, 'project:gone')).toBeNull()
  })

  it('parents a project to global, and a workspace to its project Manager when one exists', () => {
    expect(resolveDefaultParentScopeKey(makeManagerScopeState(), 'global')).toBeUndefined()
    expect(resolveDefaultParentScopeKey(makeManagerScopeState(), 'project:p-orca')).toBe('global')
    expect(resolveDefaultParentScopeKey(makeManagerScopeState(), 'workspace:orca-feat')).toBe(
      'global'
    )
    const withProjectManager = makeManagerScopeState({
      'project:p-orca': record('project:p-orca')
    })
    expect(resolveDefaultParentScopeKey(withProjectManager, 'workspace:orca-feat')).toBe(
      'project:p-orca'
    )
  })

  it('lists the worktrees each scope covers', () => {
    const state = makeManagerScopeState()
    expect(managerScopeWorktreeIds(state, 'global')).toBeNull()
    expect([...(managerScopeWorktreeIds(state, 'project:p-orca') ?? [])].sort()).toEqual([
      'orca-feat',
      'orca-main'
    ])
    expect([...(managerScopeWorktreeIds(state, 'workspace:ryba-main') ?? [])]).toEqual([
      'ryba-main'
    ])
  })

  it('names a workspace scope by its project and workspace', () => {
    expect(managerScopeNames(makeManagerScopeState(), 'workspace:orca-feat')).toEqual({
      projectName: 'orca',
      workspaceName: 'feat/manager-agent'
    })
  })
})
