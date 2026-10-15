import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import type { Tab } from '../../../../shared/tab-types'

const mocks = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  launchAgentInNewTab: vi.fn(),
  revealFloatingWorkspacePanel: vi.fn(),
  focusTerminalTabSurface: vi.fn(),
  uiGet: vi.fn(),
  uiSet: vi.fn(),
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
vi.mock('@/lib/floating-workspace-panel-reveal', () => ({
  revealFloatingWorkspacePanel: mocks.revealFloatingWorkspacePanel
}))
vi.mock('@/lib/focus-terminal-tab-surface', () => ({
  focusTerminalTabSurface: mocks.focusTerminalTabSurface
}))

import { openManagerAgent } from './open-manager-agent'
import { getManagerPageTabId, setManagerPageTabId } from './manager-agent-page-tab'

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

function setFloatingTabs(tabs: Tab[]): void {
  mocks.state.unifiedTabsByWorktree = { [FLOATING_TERMINAL_WORKTREE_ID]: tabs }
}

describe('openManagerAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setManagerPageTabId(null)
    mocks.state = {
      settings: { experimentalManagerAgent: true, defaultTuiAgent: 'claude' },
      activeView: 'tasks',
      setActiveView: vi.fn((view: string) => {
        mocks.state.activeView = view
      }),
      unifiedTabsByWorktree: {},
      focusGroup: vi.fn(),
      setActiveTabForWorktree: vi.fn(),
      activateTab: vi.fn(),
      setActiveTabType: vi.fn(),
      setTabCustomTitle: vi.fn()
    }
    mocks.uiGet.mockResolvedValue({})
    mocks.uiSet.mockResolvedValue(undefined)
    vi.stubGlobal('window', { api: { ui: { get: mocks.uiGet, set: mocks.uiSet } } })
  })

  it('does nothing while the experiment is off', async () => {
    mocks.state.settings = { experimentalManagerAgent: false }
    await openManagerAgent('sidebar')
    expect(mocks.uiGet).not.toHaveBeenCalled()
    expect(mocks.launchAgentInNewTab).not.toHaveBeenCalled()
  })

  it('shows the remembered Manager chat in the Manager view instead of starting another', async () => {
    const manager = agentTab({ id: 'structured-agent-session-s1', entityId: 's1' })
    setFloatingTabs([manager])
    mocks.uiGet.mockResolvedValue({ managerAgentTabId: manager.id })

    await openManagerAgent('sidebar')

    expect(mocks.launchAgentInNewTab).not.toHaveBeenCalled()
    expect(mocks.revealFloatingWorkspacePanel).not.toHaveBeenCalled()
    expect(mocks.state.activeView).toBe('manager')
    expect(getManagerPageTabId()).toBe(manager.id)
  })

  it('starts a new briefed chat when the remembered tab is gone, then remembers it', async () => {
    mocks.uiGet.mockResolvedValue({ managerAgentTabId: 'structured-agent-session-closed' })
    const created = agentTab({ id: 'structured-agent-session-s2', entityId: 's2' })
    mocks.launchAgentInNewTab.mockImplementation(() => {
      setFloatingTabs([created])
      return {
        surface: { kind: 'host-published' },
        structuredSettlement: Promise.resolve({ kind: 'structured', sessionId: 's2' })
      }
    })

    await openManagerAgent('command_palette')

    expect(mocks.launchAgentInNewTab).toHaveBeenCalledTimes(1)
    const launch = mocks.launchAgentInNewTab.mock.calls[0][0]
    expect(launch).toMatchObject({
      agent: 'claude',
      worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
      launchSource: 'command_palette',
      activate: false
    })
    expect(launch.prompt).toContain('skills get orchestration --full')
    expect(mocks.state.setTabCustomTitle).toHaveBeenCalledWith(created.id, 'Manager', {
      recordInteraction: false
    })
    expect(mocks.uiSet).toHaveBeenCalledWith({ managerAgentTabId: created.id })
    expect(mocks.revealFloatingWorkspacePanel).not.toHaveBeenCalled()
    expect(mocks.state.activeView).toBe('manager')
    expect(getManagerPageTabId()).toBe(created.id)
  })

  it('remembers a terminal-backed Manager by its unified tab', async () => {
    const created = agentTab({ id: 'term-1', entityId: 'term-1', contentType: 'terminal' })
    mocks.launchAgentInNewTab.mockImplementation(() => {
      setFloatingTabs([created])
      return { surface: { kind: 'local-terminal', tabId: 'term-1' } }
    })

    await openManagerAgent('sidebar')

    expect(mocks.uiSet).toHaveBeenCalledWith({ managerAgentTabId: 'term-1' })
    expect(mocks.state.activateTab).toHaveBeenCalledWith('term-1', {
      worktreeId: FLOATING_TERMINAL_WORKTREE_ID
    })
    expect(mocks.focusTerminalTabSurface).toHaveBeenCalledWith('term-1')
    expect(mocks.revealFloatingWorkspacePanel).toHaveBeenCalled()
  })

  it('starts only one Manager when opened twice while the first launch settles', async () => {
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
    settle({ kind: 'cancelled', sessionId: null })
    await Promise.all([first, second])

    expect(mocks.launchAgentInNewTab).toHaveBeenCalledTimes(1)
    expect(mocks.uiSet).not.toHaveBeenCalled()
    // A launch that opened nothing returns to the view the user came from.
    expect(mocks.state.activeView).toBe('tasks')
  })
})
