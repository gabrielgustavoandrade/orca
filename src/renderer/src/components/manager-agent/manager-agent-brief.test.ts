import { describe, expect, it } from 'vitest'
import { buildManagerAgentBrief, resolveManagerAgentCliCommand } from './manager-agent-brief'

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
      'orca repo list --json',
      'orca worktree ps --json',
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

  it('ends by reporting per task and asking the user what to do', () => {
    const lines = buildManagerAgentBrief('orca').split('\n')
    expect(lines.some((line) => line.startsWith('- For every task: its outcome'))).toBe(true)
    expect(lines.at(-1)).toMatch(/ask what they want done\.$/)
    expect(lines.length).toBeLessThanOrEqual(50)
  })
})
