import { describe, expect, it } from 'vitest'
import { buildAgentsMap, agentsMapActivity } from './agents-map-layout'
import type { DashboardCard, DashboardWorkspace } from '../../../../shared/dashboard-snapshot'

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

function workspace(repoId: string, worktreeId: string): DashboardWorkspace {
  return {
    repoId,
    worktreeId,
    repoName: repoId,
    worktreeName: worktreeId,
    hostKind: 'local',
    executionHostId: 'local',
    workspaceKind: 'worktree'
  }
}

const build = (
  cards: DashboardCard[],
  extra: Partial<Parameters<typeof buildAgentsMap>[0]> = {},
  workspaces?: DashboardWorkspace[]
): ReturnType<typeof buildAgentsMap> =>
  buildAgentsMap({
    snapshot: { cards, workspaces },
    liveEntries: {},
    retainedPaneKeys: new Set(),
    wrapWidth: 1200,
    ...extra
  })

describe('buildAgentsMap', () => {
  it('groups by project then workspace in snapshot order and omits empty workspaces', () => {
    const map = build(
      [
        card({ paneKey: 'a', repoId: 'r1', worktreeId: 'w1' }),
        card({ paneKey: 'b', repoId: 'r1', worktreeId: 'w2' }),
        card({ paneKey: 'c', repoId: 'r2', worktreeId: 'w3' })
      ],
      {},
      [
        workspace('r2', 'w3'),
        workspace('r1', 'w2'),
        workspace('r1', 'w1'),
        workspace('r1', 'empty')
      ]
    )
    expect(map.groups.map((g) => g.id)).toEqual([
      'project:r2',
      'workspace:r2:w3',
      'project:r1',
      'workspace:r1:w2',
      'workspace:r1:w1'
    ])
  })

  it('drops retained cards that are no longer live but keeps live and title-derived ones', () => {
    const cards = [card({ paneKey: 'dead' }), card({ paneKey: 'live' }), card({ paneKey: 'title' })]
    const gone = build(cards, {
      retainedPaneKeys: new Set(['dead', 'live']),
      liveEntries: { live: {} }
    })
    expect(gone.nodes.map((n) => n.id)).toEqual(['live', 'title'])
    const revived = build(cards, { retainedPaneKeys: new Set(['dead']), liveEntries: { dead: {} } })
    expect(revived.nodes.map((n) => n.id)).toEqual(['dead', 'live', 'title'])
  })

  it('links parents, cross-workspace parents, subagents and ignores filtered parents', () => {
    const map = build(
      [
        card({
          paneKey: 'parent',
          startedAt: 1,
          subagents: [{ id: 's1', name: 'Explorer', dotState: 'working' }]
        }),
        card({ paneKey: 'child', startedAt: 2, parentPaneKey: 'parent' }),
        card({ paneKey: 'remote', startedAt: 3, worktreeId: 'w2', parentPaneKey: 'parent' }),
        card({ paneKey: 'dead', startedAt: 0 }),
        card({ paneKey: 'orphan', startedAt: 4, worktreeId: 'w2', parentPaneKey: 'dead' })
      ],
      { retainedPaneKeys: new Set(['dead']) }
    )
    expect(map.edges.map((e) => [e.from, e.to, e.crossWorkspace])).toEqual([
      ['parent', 'parent/s1', false],
      ['parent', 'child', false],
      ['parent', 'remote', true]
    ])
    expect(map.nodes.find((n) => n.id === 'remote')?.x).toBe(544)
  })

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

  it('centres a parent between two children', () => {
    const map = build([
      card({ paneKey: 'p', startedAt: 1 }),
      card({ paneKey: 'c1', startedAt: 2, parentPaneKey: 'p' }),
      card({ paneKey: 'c2', startedAt: 3, parentPaneKey: 'p' })
    ])
    expect(map.nodes.map((n) => [n.id, n.x, n.y])).toEqual([
      ['p', 24, 114],
      ['c1', 284, 80],
      ['c2', 284, 148]
    ])
    expect(map.width).toBe(528)
    expect(map.height).toBe(228)
  })
})
