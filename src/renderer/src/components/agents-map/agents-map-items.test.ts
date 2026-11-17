import { describe, expect, it } from 'vitest'
import { agentsMapActivity, buildItems } from './agents-map-items'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'

function card(overrides: Partial<DashboardCard> & { paneKey: string }): DashboardCard {
  return {
    ptyId: null,
    agentType: 'claude',
    bucket: 'working',
    dotState: 'working',
    task: 'task',
    repoId: 'r1',
    worktreeId: 'w1',
    tabId: 'tab',
    leafId: 'leaf',
    repoName: 'Repo One',
    worktreeName: 'main',
    startedAt: 1,
    finishedAt: null,
    stateChangedAt: 0,
    unseen: false,
    ...overrides
  }
}

describe('buildItems', () => {
  it('drops retained cards that are no longer live but keeps live and title-derived ones', () => {
    const cards = [card({ paneKey: 'dead' }), card({ paneKey: 'live' }), card({ paneKey: 'title' })]
    const ids = (retained: string[], live: Record<string, object>): string[] =>
      buildItems({
        snapshot: { cards },
        liveEntries: live,
        retainedPaneKeys: new Set(retained)
      }).map((item) => item.node.id)
    expect(ids(['dead', 'live'], { live: {} })).toEqual(['live', 'title'])
    expect(ids(['dead'], { dead: {} })).toEqual(['dead', 'live', 'title'])
  })
})

describe('agentsMapActivity', () => {
  it('picks activity from ask summary, tool, first message line, then task', () => {
    const live = { toolName: 'Bash', toolInput: 'pnpm test\nmore' }
    expect(
      agentsMapActivity(card({ paneKey: 'a', bucket: 'attention', askSummary: 'Approve?' }), live)
    ).toBe('Approve?')
    expect(agentsMapActivity(card({ paneKey: 'a', lastAgentMessage: 'msg' }), live)).toBe(
      'Bash: pnpm test'
    )
    expect(
      agentsMapActivity(
        card({ paneKey: 'a', bucket: 'done', lastAgentMessage: '\n First\nSecond' }),
        live
      )
    ).toBe('First')
    expect(
      agentsMapActivity(card({ paneKey: 'a', bucket: 'idle', task: 'Fix bug' }), undefined)
    ).toBe('Fix bug')
  })
})
