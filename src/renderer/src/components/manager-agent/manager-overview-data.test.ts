import { describe, expect, it, vi } from 'vitest'
import {
  countManagerOverview,
  deriveManagerTaskState,
  fetchManagerOverview,
  filterManagerOverviewByScope,
  isManagerRunActive
} from './manager-overview-data'
import { buildManagerTree } from './manager-tree'

function fakeRpc() {
  const responses: Record<string, unknown> = {
    'orchestration.runList': {
      runs: [
        { id: 'run-a', objective: 'Ship scope switcher', created_at: '1', updated_at: '2' },
        { id: 'run-b', objective: 'Rate-limit login', created_at: '1', updated_at: '2' },
        { id: 'run-c', objective: 'Planning only', created_at: '1', updated_at: '2' }
      ],
      nextCursor: null
    },
    'orchestration.taskList:run-a': {
      tasks: [
        {
          id: 'a1',
          task_title: 'Implement switcher',
          display_name: null,
          spec: '',
          status: 'dispatched',
          completed_at: null
        },
        {
          id: 'a2',
          task_title: null,
          display_name: 'Screenshots',
          spec: '',
          status: 'dispatched',
          completed_at: null
        },
        {
          id: 'a3',
          task_title: null,
          display_name: null,
          spec: 'Review diff\nmore',
          status: 'pending',
          completed_at: null
        }
      ]
    },
    'orchestration.gateList:run-a': { gates: [] },
    'orchestration.workerList:run-a': {
      workers: [
        {
          dispatchId: 'd1',
          taskId: 'a1',
          workerState: 'ready',
          dispatchStatus: 'dispatched',
          resource: null,
          projection: { worktreeId: 'orca-feat' }
        },
        {
          dispatchId: 'd2',
          taskId: 'a2',
          workerState: 'ready',
          dispatchStatus: 'dispatched',
          resource: { worktreeId: 'orca-e2e' },
          projection: { worktreeId: null, pendingInput: true }
        }
      ]
    },
    'orchestration.taskList:run-b': {
      tasks: [
        {
          id: 'b1',
          task_title: 'Fix + tests',
          display_name: null,
          spec: '',
          status: 'completed',
          completed_at: '3'
        },
        {
          id: 'b2',
          task_title: 'Merge to main',
          display_name: null,
          spec: '',
          status: 'dispatched',
          completed_at: null
        }
      ]
    },
    'orchestration.gateList:run-b': {
      gates: [{ id: 'g1', task_id: 'b2', question: 'Merge ryba #412?', created_at: '4' }]
    },
    'orchestration.workerList:run-b': {
      workers: [
        {
          dispatchId: 'd3',
          taskId: 'b1',
          workerState: 'succeeded',
          dispatchStatus: 'completed',
          resource: null,
          projection: { worktreeId: 'ryba-api' }
        }
      ]
    },
    'orchestration.taskList:run-c': { tasks: [] }
  }
  return vi.fn(async (method: string, params: unknown) => {
    const run =
      params && typeof params === 'object' && 'run' in params && typeof params.run === 'string'
        ? params.run
        : undefined
    const key = run ? `${method}:${run}` : method
    if (!(key in responses)) {
      throw new Error(`no response for ${key}`)
    }
    return responses[key]
  })
}

describe('manager overview data', () => {
  it('reads runs with tasks, open gates and workers, scoped by explicit run ids', async () => {
    const rpc = fakeRpc()
    const overview = await fetchManagerOverview(rpc)
    expect(rpc).toHaveBeenCalledWith('orchestration.runList', { limit: 12 })
    expect(rpc).toHaveBeenCalledWith('orchestration.gateList', { run: 'run-a', status: 'pending' })
    const [runA, runB, runC] = overview.runs
    expect(
      runA.tasks.map((task) => [task.title, task.state, task.worker?.worktreeId ?? null])
    ).toEqual([
      ['Implement switcher', 'working', 'orca-feat'],
      ['Screenshots', 'needs-you', 'orca-e2e'],
      ['Review diff', 'queued', null]
    ])
    expect(runB.tasks.map((task) => task.state)).toEqual(['done', 'needs-you'])
    // A run whose gate or worker reads fail still shows its tasks.
    expect(runC).toMatchObject({ id: 'run-c', tasks: [], gates: [], worktreeIds: [] })
    expect(countManagerOverview(overview)).toEqual({ working: 1, needsYou: 2 })
  })

  it('scopes runs by the worktrees their workers ran in', async () => {
    const overview = await fetchManagerOverview(fakeRpc())
    expect(filterManagerOverviewByScope(overview, null).runs).toHaveLength(3)
    expect(
      filterManagerOverviewByScope(overview, new Set(['orca-main', 'orca-feat'])).runs.map(
        (run) => run.id
      )
    ).toEqual(['run-a'])
    expect(
      filterManagerOverviewByScope(overview, new Set(['ryba-api'])).runs.map((run) => run.id)
    ).toEqual(['run-b'])
    // A run with no workers yet has no known worktree, so only global sees it.
    expect(filterManagerOverviewByScope(overview, new Set(['nowhere'])).runs).toEqual([])
  })

  it('derives task states, with the user gate winning over a running worker', () => {
    expect(deriveManagerTaskState('dispatched', true, false)).toBe('needs-you')
    expect(deriveManagerTaskState('completed', true, false)).toBe('done')
    expect(deriveManagerTaskState('failed', false, true)).toBe('failed')
    expect(deriveManagerTaskState('blocked', false, false)).toBe('queued')
  })

  it('treats a run as finished once every task settled', async () => {
    const overview = await fetchManagerOverview(fakeRpc())
    expect(overview.runs.map(isManagerRunActive)).toEqual([true, true, true])
    expect(isManagerRunActive({ ...overview.runs[1], tasks: [overview.runs[1].tasks[0]] })).toBe(
      false
    )
  })

  it('fails the whole read only when the run list itself is unreadable', async () => {
    await expect(fetchManagerOverview(async () => ({ nope: true }))).rejects.toThrow()
  })
})

describe('buildManagerTree', () => {
  const base = {
    tabId: 't',
    surface: 'terminal' as const,
    agent: null,
    hostWorktreeId: 'h',
    briefVersion: 2,
    createdAt: 0
  }
  it('nests managers under the parent they report to', () => {
    const tree = buildManagerTree([
      { ...base, scopeKey: 'workspace:w1', parentScopeKey: 'project:p1' },
      { ...base, scopeKey: 'project:p1', parentScopeKey: 'global' },
      { ...base, scopeKey: 'global' },
      { ...base, scopeKey: 'workspace:w2', parentScopeKey: 'project:gone' }
    ])
    expect(tree.map((node) => node.record.scopeKey)).toEqual(['global', 'workspace:w2'])
    expect(tree[0].children[0].record.scopeKey).toBe('project:p1')
    expect(tree[0].children[0].children[0].record.scopeKey).toBe('workspace:w1')
  })
})
