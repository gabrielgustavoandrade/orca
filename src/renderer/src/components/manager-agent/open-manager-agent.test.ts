import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import type { Tab } from '../../../../shared/tab-types'
import type { ManagerAgentRecord } from '../../../../shared/manager-agent-records'
import { makeManagerScopeState } from './manager-agent-scope-test-fixtures'

const mocks = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  launchAgentInNewTab: vi.fn(),
  detected: ['claude', 'codex'] as string[],
  toastError: vi.fn()
}))

vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))
vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.state } }))
vi.mock('@/hooks/useAgentDetectionTarget', () => ({
  getAgentDetectionTargetKeyForWorktree: () => 'local',
  parseAgentDetectionTargetKey: () => ({ kind: 'local' })
}))
vi.mock('@/lib/agent-detection-target-inventory', () => ({
  readDetectedAgentsForTarget: () => mocks.detected,
  ensureDetectedAgentsForTarget: async () => mocks.detected
}))
vi.mock('@/lib/agent-launch-request-id', () => ({ newAgentLaunchRequestId: () => 'request-1' }))
vi.mock('@/lib/launch-agent-in-new-tab', () => ({ launchAgentInNewTab: mocks.launchAgentInNewTab }))
vi.mock('@/lib/agent-session-launch-plan', () => ({
  adoptAgentSessionLaunchVerdict: (verdict: Record<string, unknown>) => ({ ...verdict })
}))
vi.mock('@/lib/launch-agent-execution-context', () => ({
  resolveAgentLaunchExecutionContext: () => ({
    worktreeSshConnectionId: null,
    resolvedLaunchPlatform: 'linux',
    isRemote: false,
    queuedShell: undefined
  })
}))

import {
  openManagerAgent,
  openManagerScope,
  startNewManagerForScope
} from './open-manager-agent'
import { MANAGER_AGENT_KICKOFF_PROMPT } from './manager-agent-brief-delivery'
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
    mocks.detected = ['claude', 'codex']
    tabsByWorktree = {}
    savedRecords = {}
    mocks.state = {
      ...makeManagerScopeState(),
      settings: {
        experimentalManagerAgent: true,
        managerAgentSurface: 'chat',
        defaultTuiAgent: 'claude'
      },
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
        surface: 'chat',
        agent: null,
        hostWorktreeId: FLOATING_TERMINAL_WORKTREE_ID,
        briefVersion: 0,
        createdAt: 0
      }
    })

    await openManagerAgent('sidebar')

    expect(mocks.launchAgentInNewTab).not.toHaveBeenCalled()
    expect(mocks.state.activeView).toBe('manager')
    expect(mocks.state.managerScope).toBe('global')
  })

  it('starts a chat Manager in the floating workspace with a first-message brief', async () => {
    const created = launchesStructured(FLOATING_TERMINAL_WORKTREE_ID, 's2')

    await openManagerAgent('command_palette')

    const launch = mocks.launchAgentInNewTab.mock.calls[0][0]
    expect(launch).toMatchObject({
      agent: 'claude',
      worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
      launchSource: 'command_palette',
      activate: false,
      requestId: 'request-1'
    })
    expect(launch).not.toHaveProperty('agentSessionLaunchPlan')
    expect(launch).not.toHaveProperty('agentArgs')
    expect(launch.prompt).toContain('Your scope: all projects.')
    expect(records().global).toMatchObject({
      scopeKey: 'global',
      tabId: created.id,
      sessionId: 's2',
      surface: 'chat',
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
        surface: 'chat',
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
        surface: 'chat',
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

  it('records a chat launch the host declined as a terminal Manager', async () => {
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
    expect(record).toMatchObject({ tabId: 'term-1', surface: 'terminal' })
    expect(record).not.toHaveProperty('sessionId')
  })
})

describe('openManagerScope on the terminal surface', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.detected = ['claude', 'codex', 'aider']
    tabsByWorktree = {}
    savedRecords = {}
    mocks.state = {
      ...makeManagerScopeState(),
      // Why no surface: absent is the terminal default.
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
      setTabCustomTitle: vi.fn()
    }
    setTabs(FLOATING_TERMINAL_WORKTREE_ID, [])
  })

  function launchesTerminal(worktreeId: string, terminalId: string): Tab {
    const created = agentTab({
      id: `unified-${terminalId}`,
      entityId: terminalId,
      contentType: 'terminal',
      worktreeId
    })
    mocks.launchAgentInNewTab.mockImplementation(() => {
      setTabs(worktreeId, [...(tabsByWorktree[worktreeId] ?? []), created])
      return { surface: { kind: 'local-terminal', tabId: terminalId } }
    })
    return created
  }

  it("runs Claude's own CLI with the brief appended to its system prompt", async () => {
    const created = launchesTerminal(FLOATING_TERMINAL_WORKTREE_ID, 'term-g')

    await openManagerAgent('sidebar')

    const launch = mocks.launchAgentInNewTab.mock.calls[0][0]
    expect(launch).not.toHaveProperty('requestId')
    expect(launch.agentSessionLaunchPlan).toMatchObject({
      route: 'terminal-tui',
      agent: 'claude',
      worktreeId: FLOATING_TERMINAL_WORKTREE_ID
    })
    expect(launch.prompt).toBe(MANAGER_AGENT_KICKOFF_PROMPT)
    // Orca's shipped default Claude args stay ahead of the flag.
    expect(launch.agentArgs).toMatch(/^--dangerously-skip-permissions --append-system-prompt '/)
    expect(launch.agentArgs).toContain('Your scope: all projects.')
    expect(launch).not.toHaveProperty('promptDelivery')
    expect(records().global).toMatchObject({ tabId: created.id, surface: 'terminal' })
    expect(records().global).not.toHaveProperty('sessionId')
    expect(mocks.state.setTabCustomTitle).toHaveBeenCalledWith('term-g', 'All-projects Manager', {
      recordInteraction: false
    })
  })

  it('keeps the user default Claude args ahead of the brief flag', async () => {
    mocks.state.settings = {
      experimentalManagerAgent: true,
      defaultTuiAgent: 'claude',
      agentDefaultArgs: { claude: '--model opus' }
    }
    launchesTerminal(FLOATING_TERMINAL_WORKTREE_ID, 'term-a')

    await openManagerAgent('sidebar')

    expect(mocks.launchAgentInNewTab.mock.calls[0][0].agentArgs).toMatch(
      /^--model opus --append-system-prompt '/
    )
  })

  it('gives Codex the brief as its initial prompt', async () => {
    mocks.state.settings = { experimentalManagerAgent: true, defaultTuiAgent: 'codex' }
    launchesTerminal(FLOATING_TERMINAL_WORKTREE_ID, 'term-c')

    await openManagerAgent('sidebar')

    const launch = mocks.launchAgentInNewTab.mock.calls[0][0]
    expect(launch.agent).toBe('codex')
    expect(launch.prompt).toContain('Your scope: all projects.')
    expect(launch).not.toHaveProperty('agentArgs')
  })

  it('runs a terminal-only default agent and submits its brief once the TUI is ready', async () => {
    mocks.state.settings = { experimentalManagerAgent: true, defaultTuiAgent: 'aider' }
    launchesTerminal('orca-main', 'term-p')

    await openManagerScope('project:p-orca', 'sidebar')

    const launch = mocks.launchAgentInNewTab.mock.calls[0][0]
    expect(launch.agent).toBe('aider')
    expect(launch.prompt).toContain('Your scope: one project, orca')
    expect(launch.promptDelivery).toBe('submit-after-ready')
    expect(records()['project:p-orca']).toMatchObject({ surface: 'terminal', agent: 'aider' })
  })

  it('starts a new Manager on the current surface over a live one, leaving the old tab', async () => {
    const chat = agentTab({ id: 'structured-agent-session-old', entityId: 'old' })
    setTabs(FLOATING_TERMINAL_WORKTREE_ID, [chat])
    setRecords({
      global: {
        scopeKey: 'global',
        tabId: chat.id,
        sessionId: 'old',
        surface: 'chat',
        agent: 'claude',
        hostWorktreeId: FLOATING_TERMINAL_WORKTREE_ID,
        briefVersion: 2,
        createdAt: 1
      }
    })
    const created = launchesTerminal(FLOATING_TERMINAL_WORKTREE_ID, 'term-new')

    await openManagerAgent('sidebar')
    expect(mocks.launchAgentInNewTab).not.toHaveBeenCalled()

    await startNewManagerForScope('global', 'unknown')

    expect(records().global).toMatchObject({ tabId: created.id, surface: 'terminal' })
    expect(tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID].map((tab) => tab.id)).toEqual([
      chat.id,
      created.id
    ])
  })
})
