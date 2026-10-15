import { describe, expect, it } from 'vitest'
import type { ManagerAgentRecord } from '../../../../shared/manager-agent-records'
import { buildManagerAgentBrief, resolveManagerAgentCliCommand } from './manager-agent-brief'
import { buildManagerBriefScope, managerAgentPromptName } from './manager-agent-brief-scope'
import { makeManagerScopeState } from './manager-agent-scope-test-fixtures'

function record(scopeKey: ManagerAgentRecord['scopeKey']): ManagerAgentRecord {
  return {
    scopeKey,
    tabId: 't',
    agent: 'claude',
    hostWorktreeId: 'h',
    briefVersion: 2,
    createdAt: 1
  }
}

describe('Manager agent brief', () => {
  it('names the dev CLI only in dev builds', () => {
    expect(resolveManagerAgentCliCommand(true)).toBe('orca-dev')
    expect(resolveManagerAgentCliCommand(false)).toBe('orca')
  })

  it('loads both skills before any work, with the given CLI', () => {
    const brief = buildManagerAgentBrief('orca-dev')
    const cliGuide = brief.indexOf('`orca-dev skills get orca-cli`')
    const orchestrationGuide = brief.indexOf('`orca-dev skills get orchestration --full`')
    expect(cliGuide).toBeGreaterThan(-1)
    expect(orchestrationGuide).toBeGreaterThan(cliGuide)
    expect(brief.indexOf('orchestration run-create')).toBeGreaterThan(orchestrationGuide)
    expect(brief).not.toMatch(/(^|[^-])\borca skills/)
  })

  it('delegates through the orchestration loop instead of editing code itself', () => {
    const brief = buildManagerAgentBrief('orca')
    expect(brief).toContain('do not edit code or files yourself unless the user explicitly asks')
    for (const command of [
      'orca status --json',
      'orca project list --json',
      'orca orchestration run-create --objective',
      'orca orchestration worker-start --spec',
      '--worktree new-child|new-top-level|<selector>',
      'orca orchestration check --wait --types "worker_done,escalation,question"',
      'orca orchestration reply --id',
      'orca orchestration worker-release --dispatch'
    ]) {
      expect(brief).toContain(command)
    }
  })

  it('ends with a one-line status and stays short', () => {
    const lines = buildManagerAgentBrief('orca').split('\n')
    expect(lines.at(-1)).toMatch(/one-line status and ask what they want done\.$/)
    expect(lines.length).toBeLessThanOrEqual(60)
  })
})

describe('scope briefs', () => {
  it('global: lists every project with its repos, prefers project Managers, gates merges', () => {
    const state = makeManagerScopeState({ 'project:p-ryba': record('project:p-ryba') })
    const scope = buildManagerBriefScope(state, 'global', undefined)
    const brief = buildManagerAgentBrief('orca', scope!)
    expect(brief).toContain('Your scope: all projects.')
    expect(brief).toContain('- orca (id `p-orca`; repos: `/src/orca`)')
    expect(brief).toContain('- ryba (id `p-ryba`; repos: `/src/ryba`)')
    expect(brief).toContain('These projects have their own Manager: ryba Manager.')
    expect(brief).toContain('Gate every merge and push')
  })

  it('project: stays in the project, names its primary workspace, and its parent once it exists', () => {
    const unparented = buildManagerBriefScope(makeManagerScopeState(), 'project:p-orca', 'global')
    expect(buildManagerAgentBrief('orca', unparented!)).toContain(
      'You report to the user directly.'
    )

    const state = makeManagerScopeState({ global: record('global') })
    const brief = buildManagerAgentBrief(
      'orca',
      buildManagerBriefScope(state, 'project:p-orca', 'global')!
    )
    expect(brief).toContain('Your scope: one project, orca (id `p-orca`; repos: `/src/orca`).')
    expect(brief).toContain(
      'primary workspace, main (id `orca-main`, path `/src/orca`, branch `main`)'
    )
    expect(brief).toContain("Stay inside this project's repos and workspaces")
    expect(brief).toContain('`--worktree new-child`')
    expect(brief).toContain('You report to the all-projects Manager.')
  })

  it('workspace: stays in the workspace, uses child workspaces for writers, reports up', () => {
    const state = makeManagerScopeState({ 'project:p-orca': record('project:p-orca') })
    const brief = buildManagerAgentBrief(
      'orca-dev',
      buildManagerBriefScope(state, 'workspace:orca-feat', 'project:p-orca')!
    )
    expect(brief).toContain(
      'Your scope: one workspace, feat/manager-agent (id `orca-feat`, path `/src/orca-feat`, branch `feat/manager-agent`) in project orca.'
    )
    expect(brief).toContain('Put each parallel writer in its own child workspace')
    expect(brief).toContain('merge its branch back here')
    expect(brief).toContain('You report to the orca Manager')
    expect(brief).toContain('`orca-dev skills get orca-cli`')
  })

  it('has no brief for a scope that no longer resolves', () => {
    expect(buildManagerBriefScope(makeManagerScopeState(), 'workspace:gone', 'global')).toBeNull()
    expect(managerAgentPromptName(makeManagerScopeState(), 'global')).toBe('all-projects Manager')
  })
})
