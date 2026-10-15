import { BriefcaseBusiness } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import {
  GLOBAL_MANAGER_SCOPE_KEY,
  projectManagerScopeKey,
  workspaceManagerScopeKey,
  type ManagerScopeKey
} from '../../../../shared/manager-agent-records'
import type { CmdJQuickAction } from './quick-actions'
import type { CmdJQuickActionAvailability, CmdJQuickActionContext } from './quick-action-context'

export const OPEN_MANAGER_AGENT_QUICK_ACTION_ID = 'open-manager-agent'
export const OPEN_PROJECT_MANAGER_QUICK_ACTION_ID = 'open-project-manager'
export const OPEN_WORKSPACE_MANAGER_QUICK_ACTION_ID = 'open-workspace-manager'

type ManagerQuickActionContext = Pick<
  CmdJQuickActionContext,
  'managerAgentEnabled' | 'activeWorktreeId' | 'managerProjectId'
>

type ManagerQuickActionTarget =
  | { available: true; scopeKey: ManagerScopeKey }
  | Extract<CmdJQuickActionAvailability, { available: false }>

type ManagerScopeKind = 'global' | 'project' | 'workspace'

export function resolveManagerQuickActionTarget(
  kind: ManagerScopeKind,
  ctx: ManagerQuickActionContext
): ManagerQuickActionTarget {
  if (ctx.managerAgentEnabled !== true) {
    return { available: false, reason: 'feature-disabled' }
  }
  if (kind === 'global') {
    return { available: true, scopeKey: GLOBAL_MANAGER_SCOPE_KEY }
  }
  if (!ctx.activeWorktreeId) {
    return { available: false, reason: 'no-active-workspace' }
  }
  if (kind === 'workspace') {
    return { available: true, scopeKey: workspaceManagerScopeKey(ctx.activeWorktreeId) }
  }
  return ctx.managerProjectId
    ? { available: true, scopeKey: projectManagerScopeKey(ctx.managerProjectId) }
    : { available: false, reason: 'no-project' }
}

function managerQuickAction(args: {
  id: string
  kind: ManagerScopeKind
  title: string
  description: string
  verbKeywords: string[]
}): CmdJQuickAction {
  const availability = (ctx: CmdJQuickActionContext): CmdJQuickActionAvailability => {
    const target = resolveManagerQuickActionTarget(args.kind, ctx)
    return target.available ? { available: true } : target
  }
  return {
    id: args.id,
    kind: 'action',
    title: args.title,
    description: args.description,
    icon: BriefcaseBusiness,
    verbKeywords: args.verbKeywords,
    isAvailable: availability,
    run: async (ctx) => {
      const target = resolveManagerQuickActionTarget(args.kind, ctx)
      if (!target.available) {
        return { status: 'unavailable', reason: target.reason }
      }
      // Why lazy: the launch path is heavy and only needed once the action runs.
      void import('@/components/manager-agent/open-manager-agent').then(({ openManagerScope }) =>
        openManagerScope(target.scopeKey, 'command_palette')
      )
      return { status: 'ok' }
    }
  }
}

export function getManagerAgentQuickActions(): CmdJQuickAction[] {
  const managerVerb = translate('auto.components.cmd.j.quick.actions.verbs.manager', 'manager')
  return [
    managerQuickAction({
      id: OPEN_MANAGER_AGENT_QUICK_ACTION_ID,
      kind: 'global',
      title: translate('auto.components.cmd.j.quick.actions.openManager', 'Open Manager'),
      description: translate(
        'auto.components.cmd.j.quick.actions.openManagerDescription',
        'Open the all-projects Manager that delegates work to other agents.'
      ),
      verbKeywords: [
        translate('auto.components.cmd.j.quick.actions.verbs.openManager', 'open manager'),
        managerVerb,
        translate('auto.components.cmd.j.quick.actions.verbs.chiefOfStaff', 'chief of staff'),
        translate('auto.components.cmd.j.quick.actions.verbs.delegate', 'delegate work')
      ]
    }),
    managerQuickAction({
      id: OPEN_PROJECT_MANAGER_QUICK_ACTION_ID,
      kind: 'project',
      title: translate(
        'auto.components.cmd.j.quick.actions.openProjectManager',
        'Open project manager'
      ),
      description: translate(
        'auto.components.cmd.j.quick.actions.openProjectManagerDescription',
        "Open the Manager for the active workspace's project."
      ),
      verbKeywords: [
        managerVerb,
        translate('auto.components.cmd.j.quick.actions.verbs.projectManager', 'project manager')
      ]
    }),
    managerQuickAction({
      id: OPEN_WORKSPACE_MANAGER_QUICK_ACTION_ID,
      kind: 'workspace',
      title: translate(
        'auto.components.cmd.j.quick.actions.openWorkspaceManager',
        'Open workspace manager'
      ),
      description: translate(
        'auto.components.cmd.j.quick.actions.openWorkspaceManagerDescription',
        'Open the Manager that coordinates agents in the active workspace.'
      ),
      verbKeywords: [
        managerVerb,
        translate('auto.components.cmd.j.quick.actions.verbs.workspaceManager', 'workspace manager')
      ]
    })
  ]
}
