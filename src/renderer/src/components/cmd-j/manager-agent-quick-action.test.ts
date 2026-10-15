import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '@/store/types'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { buildCmdJQuickActionContext, type CmdJQuickActionContext } from './quick-action-context'
import { getCmdJQuickActions } from './quick-actions'
import {
  OPEN_MANAGER_AGENT_QUICK_ACTION_ID,
  OPEN_PROJECT_MANAGER_QUICK_ACTION_ID,
  OPEN_WORKSPACE_MANAGER_QUICK_ACTION_ID,
  resolveManagerQuickActionTarget
} from './manager-agent-quick-action'

const mocks = vi.hoisted(() => ({ openManagerScope: vi.fn() }))

vi.mock('@/components/manager-agent/open-manager-agent', () => ({
  openManagerScope: mocks.openManagerScope
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

function action(id: string) {
  const found = getCmdJQuickActions().find((entry) => entry.id === id)
  if (!found) {
    throw new Error(`missing quick action ${id}`)
  }
  return found
}

const ON = { managerAgentEnabled: true, activeWorktreeId: 'w1', managerProjectId: 'p1' }

describe('Manager quick actions', () => {
  beforeEach(() => {
    mocks.openManagerScope.mockReset()
  })

  it('stay hidden until the Manager experiment is on', () => {
    for (const id of [
      OPEN_MANAGER_AGENT_QUICK_ACTION_ID,
      OPEN_PROJECT_MANAGER_QUICK_ACTION_ID,
      OPEN_WORKSPACE_MANAGER_QUICK_ACTION_ID
    ]) {
      expect(action(id).isAvailable(buildContext(null))).toEqual({
        available: false,
        reason: 'feature-disabled'
      })
    }
    expect(
      action(OPEN_MANAGER_AGENT_QUICK_ACTION_ID).isAvailable(
        buildContext({ experimentalManagerAgent: true })
      )
    ).toEqual({ available: true })
  })

  it('target global, the active project and the active workspace', () => {
    expect(resolveManagerQuickActionTarget('global', ON)).toEqual({
      available: true,
      scopeKey: 'global'
    })
    expect(resolveManagerQuickActionTarget('project', ON)).toEqual({
      available: true,
      scopeKey: 'project:p1'
    })
    expect(resolveManagerQuickActionTarget('workspace', ON)).toEqual({
      available: true,
      scopeKey: 'workspace:w1'
    })
  })

  it('need an active workspace, and a project for the project Manager', () => {
    const noWorkspace = { ...ON, activeWorktreeId: null, managerProjectId: null }
    expect(resolveManagerQuickActionTarget('global', noWorkspace)).toMatchObject({
      available: true
    })
    expect(resolveManagerQuickActionTarget('workspace', noWorkspace)).toEqual({
      available: false,
      reason: 'no-active-workspace'
    })
    expect(resolveManagerQuickActionTarget('project', { ...ON, managerProjectId: null })).toEqual({
      available: false,
      reason: 'no-project'
    })
    expect(
      action(OPEN_PROJECT_MANAGER_QUICK_ACTION_ID).isAvailable(
        buildContext({ experimentalManagerAgent: true })
      )
    ).toEqual({ available: false, reason: 'no-active-workspace' })
  })

  it('open the resolved scope from the palette', async () => {
    const ctx = { ...buildContext({ experimentalManagerAgent: true }), ...ON }
    await expect(action(OPEN_PROJECT_MANAGER_QUICK_ACTION_ID).run(ctx)).resolves.toEqual({
      status: 'ok'
    })
    await vi.waitFor(() =>
      expect(mocks.openManagerScope).toHaveBeenCalledWith('project:p1', 'command_palette')
    )
  })

  it('refuse to run while the experiment is off', async () => {
    await expect(
      action(OPEN_MANAGER_AGENT_QUICK_ACTION_ID).run(buildContext(null))
    ).resolves.toEqual({ status: 'unavailable', reason: 'feature-disabled' })
    expect(mocks.openManagerScope).not.toHaveBeenCalled()
  })
})
