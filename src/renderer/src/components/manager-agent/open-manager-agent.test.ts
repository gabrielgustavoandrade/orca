import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import type { Tab } from '../../../../shared/tab-types'
import type { ManagerAgentRecord } from '../../../../shared/manager-agent-records'
import { makeManagerScopeState } from './manager-agent-scope-test-fixtures'

const mocks = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  launchAgentInNewTab: vi.fn(),
  activateAndRevealWorktree: vi.fn(),
  focusTerminalTabSurface: vi.fn(),
  toastError: vi.fn()
}))

vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))
vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.state } }))
vi.mock('@/hooks/useAgentDetectionTarget', () => ({
  getAgentDetectionTargetKeyForWorktree: () => 'local',
  parseAgentDetectionTargetKey: () => ({ kind: 'local' })
}))
vi.mock('@/lib/agent-detection-target-inventory', () => ({
  readDetectedAgentsForTarget: () => ['claude', 'codex'],
  ensureDetectedAgentsForTarget: async () => ['claude', 'codex']
}))
vi.mock('@/lib/agent-launch-request-id', () => ({ newAgentLaunchRequestId: () => 'request-1' }))
vi.mock('@/lib/launch-agent-in-new-tab', () => ({ launchAgentInNewTab: mocks.launchAgentInNewTab }))
vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealWorktree: mocks.activateAndRevealWorktree
}))
vi.mock('@/lib/focus-terminal-tab-surface', () => ({
  focusTerminalTabSurface: mocks.focusTerminalTabSurface
}))

import { openManagerAgent, openManagerScope, revealTerminalManager } from './open-manager-agent'
import { isManagerScopeLaunching } from './manager-agent-launch-state'

function agentTab(overrides: Partial<Tab>): Tab {
  return {
    id: 'tab',
    entityId: 'tab',
    groupId: 'group-1',
    worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
    contentType: 'agent-session',
    label: 'Claude',
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 0,
    ...overrides
  }
}

let tabsByWorktree: Record<string, Tab[]> = {}
let savedRecords: Record<string, ManagerAgentRecord> = {}

function setTabs(worktreeId: string, tabs: Tab[]): void {
  tabsByWorktree = { ...tabsByWorktree, [worktreeId]: tabs }
  mocks.state.unifiedTabsByWorktree = tabsByWorktree
}

function setRecords(next: Record<string, ManagerAgentRecord>): void {
  savedRecords = next
  mocks.state.managerAgents = next
}

function launchesStructured(worktreeId: string, sessionId: string): Tab {
  const created = agentTab({
    id: `structured-agent-session-${sessionId}`,
    entityId: sessionId,
    worktreeId
  })
  mocks.launchAgentInNewTab.mockImplementation(() => {
    setTabs(worktreeId, [created])
    return {
      surface: { kind: 'host-published' },
      structuredSettlement: Promise.resolve({ kind: 'structured', sessionId })
    }
  })
  return created
}

function records(): Record<string, ManagerAgentRecord> {
  return savedRecords
}

describe('openManagerScope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tabsByWorktree = {}
    savedRecords = {}
    mocks.state = {
      ...makeManagerScopeState(),
      settings: { experimentalManagerAgent: true, defaultTuiAgent: 'claude' },
      activeView: 'tasks',
      managerScope: 'global',
      setActiveView: vi.fn((view: string) => {
        mocks.state.activeView = view
      }),
      setManagerScope: vi.fn((scopeKey: string) => {
        mocks.state.managerScope = scopeKey
      }),
      setManagerAgentRecord: vi.fn((record: ManagerAgentRecord) => {
        setRecords({ ...savedRecords, [record.scopeKey]: record })
      }),
      focusGroup: vi.fn(),
      setActiveTabForWorktree: vi.fn(),
      activateTab: vi.fn(),
      setActiveTabType: vi.fn(),
      setTabCustomTitle: vi.fn()
    }
    setTabs(FLOATING_TERMINAL_WORKTREE_ID, [])
  })

  it('does nothing while the experiment is off', async () => {
    mocks.state.settings = { experimentalManagerAgent: false }
    await openManagerAgent('sidebar')
    expect(mocks.launchAgentInNewTab).not.toHaveBeenCalled()
    expect(mocks.state.activeView).toBe('tasks')
  })

  it('shows a live Manager on the page instead of starting another', async () => {
    const manager = agentTab({ id: 'structured-agent-session-s1', entityId: 's1' })
    setTabs(FLOATING_TERMINAL_WORKTREE_ID, [manager])
    setRecords({
      global: {
        scopeKey: 'global',
        tabId: manager.id,
        sessionId: 's1',
        agent: null,
        hostWorktreeId: FLOATING_TERMINAL_WORKTREE_ID,
        briefVersion: 0,
        createdAt: 0
      }
    })

    await openManagerAgent('sidebar')

    expect(mocks.launchAgentInNewTab).not.toHaveBeenCalled()
    expect(mocks.activateAndRevealWorktree).not.toHaveBeenCalled()
    expect(mocks.state.activeView).toBe('manager')
    expect(mocks.state.managerScope).toBe('global')
  })

  it('starts the global Manager in the floating workspace and records it', async () => {
    const created = launchesStructured(FLOATING_TERMINAL_WORKTREE_ID, 's2')

    await openManagerAgent('command_palette')

    const launch = mocks.launchAgentInNewTab.mock.calls[0][0]
    expect(launch).toMatchObject({
      agent: 'claude',
      worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
      launchSource: 'command_palette',
      activate: false
    })
    expect(launch.prompt).toContain('Your scope: all projects.')
    expect(records().global).toMatchObject({
      scopeKey: 'global',
      tabId: created.id,
      sessionId: 's2',
      agent: 'claude',
      hostWorktreeId: FLOATING_TERMINAL_WORKTREE_ID,
      briefVersion: 2
    })
    expect(records().global).not.toHaveProperty('parentScopeKey')
    expect(mocks.state.setTabCustomTitle).toHaveBeenCalledWith(created.id, 'All-projects Manager', {
      recordInteraction: false
    })
    expect(mocks.state.activeView).toBe('manager')
    expect(isManagerScopeLaunching('global')).toBe(false)
  })

  it("starts a project Manager in the project's primary workspace, reporting to global", async () => {
    launchesStructured('orca-main', 's3')

    await openManagerScope('project:p-orca', 'sidebar')

    const launch = mocks.launchAgentInNewTab.mock.calls[0][0]
    expect(launch.worktreeId).toBe('orca-main')
    expect(launch.prompt).toContain('Your scope: one project, orca')
    expect(records()['project:p-orca']).toMatchObject({
      hostWorktreeId: 'orca-main',
      parentScopeKey: 'global'
    })
    expect(mocks.state.managerScope).toBe('project:p-orca')
  })

  it('starts a workspace Manager in that workspace, under its project Manager', async () => {
    setRecords({
      'project:p-orca': {
        scopeKey: 'project:p-orca',
        tabId: 'gone',
        agent: 'claude',
        hostWorktreeId: 'orca-main',
        briefVersion: 2,
        createdAt: 1
      }
    })
    launchesStructured('orca-feat', 's4')

    await openManagerScope('workspace:orca-feat', 'command_palette')

    expect(mocks.launchAgentInNewTab.mock.calls[0][0].worktreeId).toBe('orca-feat')
    expect(records()['workspace:orca-feat']).toMatchObject({
      hostWorktreeId: 'orca-feat',
      parentScopeKey: 'project:p-orca'
    })
  })

  it('replaces a record whose chat is gone', async () => {
    setRecords({
      global: {
        scopeKey: 'global',
        tabId: 'structured-agent-session-closed',
        sessionId: 'closed',
        agent: 'claude',
        hostWorktreeId: FLOATING_TERMINAL_WORKTREE_ID,
        briefVersion: 1,
        createdAt: 1
      }
    })
    launchesStructured(FLOATING_TERMINAL_WORKTREE_ID, 's5')

    await openManagerAgent('sidebar')

    expect(records().global).toMatchObject({ sessionId: 's5', briefVersion: 2 })
  })

  it('reports a project with no workspace to host its Manager', async () => {
    await openManagerScope('project:missing', 'sidebar')
    expect(mocks.launchAgentInNewTab).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalled()
    // The page stays on the scope and offers to start it again.
    expect(mocks.state.activeView).toBe('manager')
  })

  it('starts only one Manager per scope when opened twice while the first launch settles', async () => {
    let settle: (value: unknown) => void = () => {}
    mocks.launchAgentInNewTab.mockImplementation(() => ({
      surface: { kind: 'host-published' },
      structuredSettlement: new Promise((resolve) => {
        settle = resolve
      })
    }))

    const first = openManagerAgent('sidebar')
    const second = openManagerAgent('sidebar')
    await vi.waitFor(() => expect(mocks.launchAgentInNewTab).toHaveBeenCalled())
    expect(isManagerScopeLaunching('global')).toBe(true)
    settle({ kind: 'cancelled', sessionId: null })
    await Promise.all([first, second])

    expect(mocks.launchAgentInNewTab).toHaveBeenCalledTimes(1)
    expect(mocks.state.setManagerAgentRecord).not.toHaveBeenCalled()
    expect(isManagerScopeLaunching('global')).toBe(false)
  })

  it('remembers a terminal-backed Manager and reveals it in its workspace on request', async () => {
    const created = agentTab({
      id: 'term-1',
      entityId: 'term-1',
      contentType: 'terminal',
      worktreeId: 'orca-feat'
    })
    mocks.launchAgentInNewTab.mockImplementation(() => {
      setTabs('orca-feat', [created])
      return { surface: { kind: 'local-terminal', tabId: 'term-1' } }
    })

    await openManagerScope('workspace:orca-feat', 'sidebar')

    const record = records()['workspace:orca-feat']
    expect(record).toMatchObject({ tabId: 'term-1' })
    expect(record).not.toHaveProperty('sessionId')
    expect(mocks.activateAndRevealWorktree).not.toHaveBeenCalled()

    revealTerminalManager(record)
    expect(mocks.activateAndRevealWorktree).toHaveBeenCalledWith('orca-feat')
    expect(mocks.state.activateTab).toHaveBeenCalledWith('term-1', { worktreeId: 'orca-feat' })
    expect(mocks.focusTerminalTabSurface).toHaveBeenCalledWith('term-1')
  })
})
