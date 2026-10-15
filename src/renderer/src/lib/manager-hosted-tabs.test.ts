import { describe, expect, it, vi } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import type { Tab, TabGroup } from '../../../shared/tab-types'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import type { ManagerAgentRecords } from '../../../shared/manager-agent-records'
import { structuredAgentSessionTabId } from '../../../shared/structured-agent-session-projection'
import { isManagerHostedTab, selectManagerHostedTabIds } from './manager-hosted-tabs'
import { selectFloatingVisibleTabCount } from '@/store/floating-workspace-panel-selector'
import { resolveFloatingWorkspaceSurfaceModel } from '@/components/floating-terminal/floating-workspace-surface-model'
import {
  nextVisibleGroupTabId,
  repairManagerHostedActiveTabs
} from '@/components/manager-agent/manager-hosted-tab-repair'

const MANAGER_TAB = structuredAgentSessionTabId('s1')
const ON: Partial<GlobalSettings> = { experimentalManagerAgent: true }

function settings(value: Partial<GlobalSettings>): GlobalSettings {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the selectors under test read only experimentalManagerAgent.
  return value as GlobalSettings
}

const records: ManagerAgentRecords = {
  global: {
    scopeKey: 'global',
    tabId: MANAGER_TAB,
    sessionId: 's1',
    agent: 'claude',
    hostWorktreeId: FLOATING_TERMINAL_WORKTREE_ID,
    briefVersion: 2,
    createdAt: 1
  },
  'workspace:w1': {
    scopeKey: 'workspace:w1',
    tabId: 'term-manager',
    agent: 'aider',
    hostWorktreeId: 'w1',
    briefVersion: 2,
    createdAt: 1
  }
}

function tab(id: string, worktreeId: string, overrides: Partial<Tab> = {}): Tab {
  return {
    id,
    entityId: id,
    groupId: 'g1',
    worktreeId,
    contentType: 'agent-session',
    label: id,
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 0,
    ...overrides
  }
}

function group(overrides: Partial<TabGroup>): TabGroup {
  return { id: 'g1', worktreeId: 'w1', activeTabId: null, tabOrder: [], ...overrides }
}

describe('selectManagerHostedTabIds', () => {
  it('hides structured Manager chats only, and nothing while the experiment is off', () => {
    const on = { managerAgents: records, settings: settings(ON) }
    expect(isManagerHostedTab(on, MANAGER_TAB)).toBe(true)
    // A terminal-fallback Manager stays reachable in its workspace.
    expect(isManagerHostedTab(on, 'term-manager')).toBe(false)
    expect(
      isManagerHostedTab({ managerAgents: records, settings: settings({}) }, MANAGER_TAB)
    ).toBe(false)
    expect(selectManagerHostedTabIds({})).toEqual(new Set())
  })

  it('keeps one identity per records object so selectors can cache on it', () => {
    const state = { managerAgents: records, settings: settings(ON) }
    expect(selectManagerHostedTabIds(state)).toBe(selectManagerHostedTabIds({ ...state }))
  })
})

describe('floating workspace with a Manager chat', () => {
  const floatingState = {
    managerAgents: records,
    settings: settings(ON),
    tabsByWorktree: {},
    browserTabsByWorktree: {},
    openFiles: [],
    unifiedTabsByWorktree: {
      [FLOATING_TERMINAL_WORKTREE_ID]: [tab(MANAGER_TAB, FLOATING_TERMINAL_WORKTREE_ID)]
    },
    groupsByWorktree: {
      [FLOATING_TERMINAL_WORKTREE_ID]: [
        group({ worktreeId: FLOATING_TERMINAL_WORKTREE_ID, activeTabId: MANAGER_TAB })
      ]
    },
    layoutByWorktree: {
      [FLOATING_TERMINAL_WORKTREE_ID]: { type: 'leaf' as const, groupId: 'g1' }
    },
    activeGroupIdByWorktree: {}
  }

  it('does not count it as a visible tab, so it alone does not mount the panel', () => {
    expect(selectFloatingVisibleTabCount(floatingState)).toBe(0)
    expect(selectFloatingVisibleTabCount({ ...floatingState, settings: settings({}) })).toBe(1)
  })

  it('shows the empty floating panel instead of a blank workspace', () => {
    expect(resolveFloatingWorkspaceSurfaceModel(floatingState)).toEqual({ kind: 'empty' })
  })
})

describe('repairManagerHostedActiveTabs', () => {
  it('falls back to the most recent visible tab of the group', () => {
    expect(
      nextVisibleGroupTabId(
        { recentTabIds: ['a', 'b', MANAGER_TAB], tabOrder: [MANAGER_TAB, 'a', 'b'] },
        new Set(['a', 'b', MANAGER_TAB]),
        new Set([MANAGER_TAB])
      )
    ).toBe('b')
    expect(
      nextVisibleGroupTabId(
        { tabOrder: [MANAGER_TAB] },
        new Set([MANAGER_TAB]),
        new Set([MANAGER_TAB])
      )
    ).toBeNull()
  })

  function repairState(tabs: Tab[], activeTabId: string, active = true) {
    return {
      managerAgents: {
        'project:p1': { ...records.global, scopeKey: 'project:p1' as const, hostWorktreeId: 'w1' }
      },
      settings: settings(ON),
      unifiedTabsByWorktree: { w1: tabs },
      groupsByWorktree: {
        w1: [group({ activeTabId, tabOrder: tabs.map((item) => item.id), recentTabIds: ['t1'] })]
      },
      activeWorktreeId: active ? 'w1' : 'other',
      activeView: 'terminal' as const,
      activateTab: vi.fn(),
      createTab: vi.fn()
    }
  }

  it('moves a group off a hidden Manager chat without creating anything', () => {
    const state = repairState(
      [tab('t1', 'w1', { contentType: 'terminal' }), tab(MANAGER_TAB, 'w1')],
      MANAGER_TAB
    )
    repairManagerHostedActiveTabs(state, 'w1')
    expect(state.activateTab).toHaveBeenCalledWith('t1', { worktreeId: 'w1', recordFocus: false })
    expect(state.createTab).not.toHaveBeenCalled()
  })

  it('gives the active workspace a terminal when its only tab is a Manager chat', () => {
    const state = repairState([tab(MANAGER_TAB, 'w1')], MANAGER_TAB)
    repairManagerHostedActiveTabs(state, 'w1')
    expect(state.createTab).toHaveBeenCalledWith('w1')
  })

  it('leaves a background workspace alone until the user opens it', () => {
    const state = repairState([tab(MANAGER_TAB, 'w1')], MANAGER_TAB, false)
    repairManagerHostedActiveTabs(state, 'w1')
    expect(state.createTab).not.toHaveBeenCalled()
  })
})
