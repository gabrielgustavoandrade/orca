import { describe, expect, it } from 'vitest'
import { buildMasterRail } from './master-rail'
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

const rail = (cards: DashboardCard[]): ReturnType<typeof buildMasterRail> =>
  buildMasterRail({
    snapshot: { cards },
    liveEntries: {},
    retainedPaneKeys: new Set(),
    masterTabId: 'master-tab'
  })

describe('buildMasterRail', () => {
  it('splits agents into started-by-master tree, other agents, and omits the master', () => {
    const result = rail([
      card({ paneKey: 'm', tabId: 'master-tab' }),
      card({ paneKey: 'w2', startedAt: 3, parentPaneKey: 'm' }),
      card({ paneKey: 'w1', startedAt: 2, parentPaneKey: 'm' }),
      card({ paneKey: 'grandchild', startedAt: 4, parentPaneKey: 'w1' }),
      card({ paneKey: 'solo', startedAt: 5 }),
      card({ paneKey: 'led-by-solo', startedAt: 6, parentPaneKey: 'solo' }),
      card({ paneKey: 'cycle-a', startedAt: 7, parentPaneKey: 'cycle-b' }),
      card({ paneKey: 'cycle-b', startedAt: 8, parentPaneKey: 'cycle-a' })
    ])
    expect(result.master?.id).toBe('m')
    expect(
      result.started.map((root) => [
        root.item.node.id,
        root.children.map((child) => child.item.node.id)
      ])
    ).toEqual([
      ['w1', ['grandchild']],
      ['w2', []]
    ])
    expect(result.other.map((item) => item.node.id)).toEqual([
      'solo',
      'led-by-solo',
      'cycle-a',
      'cycle-b'
    ])
  })

  it('lists only attention cards with an ask, newest first, flagging master-started ones', () => {
    const result = rail([
      card({ paneKey: 'm', tabId: 'master-tab' }),
      card({
        paneKey: 'old',
        bucket: 'attention',
        askSummary: 'Pick one',
        stateChangedAt: 10,
        parentPaneKey: 'm'
      }),
      card({ paneKey: 'new', bucket: 'attention', askSummary: 'Run it?', stateChangedAt: 20 }),
      card({ paneKey: 'no-ask', bucket: 'attention', stateChangedAt: 30 }),
      card({ paneKey: 'busy', askSummary: 'stale ask', stateChangedAt: 40 })
    ])
    expect(result.needsYou.map((entry) => [entry.item.node.id, entry.startedByMaster])).toEqual([
      ['new', false],
      ['old', true]
    ])
  })

  it('lists a worker in the master worktree under started, not dropped as a master', () => {
    const result = rail([
      card({ paneKey: 'm', tabId: 'master-tab' }),
      card({ paneKey: 'worker', tabId: 'worker-tab', parentPaneKey: 'm' }),
      card({ paneKey: 'loner', tabId: 'other-tab' })
    ])
    expect(result.started.map((root) => root.item.node.id)).toEqual(['worker'])
    expect(result.other.map((item) => item.node.id)).toEqual(['loner'])
  })

  it('has no master and no tree before the master exists', () => {
    const result = rail([card({ paneKey: 'a' })])
    expect(result.master).toBeNull()
    expect(result.started).toEqual([])
    expect(result.other.map((item) => item.node.id)).toEqual(['a'])
  })
})
