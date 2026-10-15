import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '@/store/types'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { buildCmdJQuickActionContext, type CmdJQuickActionContext } from './quick-action-context'
import { getCmdJQuickActions } from './quick-actions'
import { OPEN_MANAGER_AGENT_QUICK_ACTION_ID } from './manager-agent-quick-action'

const mocks = vi.hoisted(() => ({ openManagerAgent: vi.fn() }))

vi.mock('@/components/manager-agent/open-manager-agent', () => ({
  openManagerAgent: mocks.openManagerAgent
}))

function buildContext(settings: Partial<GlobalSettings> | null): CmdJQuickActionContext {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: buildCmdJQuickActionContext reads only these slices with no workspace active.
  const state = {
    activeWorktreeId: null,
    worktreesByRepo: {},
    repos: [],
    sshConnectionStates: new Map(),
    activeGroupIdByWorktree: {},
    groupsByWorktree: {},
    activeView: 'terminal',
    settings
  } as unknown as AppState
  return buildCmdJQuickActionContext({
    state,
    activeGroupSnapshot: null,
    openNewBrowserTab: async () => {},
    openNewMarkdownFile: async () => {},
    openNewTerminalTab: async () => {},
    openCreateWorkspace: () => {},
    deleteActiveWorkspace: () => {},
    openAddQuickCommand: () => {}
  })
}

function managerAction() {
  const action = getCmdJQuickActions().find(
    (entry) => entry.id === OPEN_MANAGER_AGENT_QUICK_ACTION_ID
  )
  if (!action) {
    throw new Error('missing Open Manager quick action')
  }
  return action
}

describe('Open Manager quick action', () => {
  beforeEach(() => {
    mocks.openManagerAgent.mockReset()
  })

  it('is hidden until the Manager experiment is on, with no workspace required', () => {
    expect(managerAction().isAvailable(buildContext(null))).toEqual({
      available: false,
      reason: 'feature-disabled'
    })
    expect(managerAction().isAvailable(buildContext({ experimentalManagerAgent: false }))).toEqual({
      available: false,
      reason: 'feature-disabled'
    })
    expect(managerAction().isAvailable(buildContext({ experimentalManagerAgent: true }))).toEqual({
      available: true
    })
  })

  it('opens the Manager from the palette', async () => {
    await expect(
      managerAction().run(buildContext({ experimentalManagerAgent: true }))
    ).resolves.toEqual({ status: 'ok' })
    await vi.waitFor(() => expect(mocks.openManagerAgent).toHaveBeenCalledWith('command_palette'))
  })

  it('refuses to run while the experiment is off', async () => {
    await expect(managerAction().run(buildContext(null))).resolves.toEqual({
      status: 'unavailable',
      reason: 'feature-disabled'
    })
    expect(mocks.openManagerAgent).not.toHaveBeenCalled()
  })
})
