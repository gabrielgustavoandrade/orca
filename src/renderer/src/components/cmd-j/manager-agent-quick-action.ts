import { BriefcaseBusiness } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { CmdJQuickAction } from './quick-actions'
import type { CmdJQuickActionAvailability, CmdJQuickActionContext } from './quick-action-context'

export const OPEN_MANAGER_AGENT_QUICK_ACTION_ID = 'open-manager-agent'

export function getManagerAgentQuickActionAvailability(
  ctx: Pick<CmdJQuickActionContext, 'managerAgentEnabled'>
): CmdJQuickActionAvailability {
  return ctx.managerAgentEnabled === true
    ? { available: true }
    : { available: false, reason: 'feature-disabled' }
}

export function getManagerAgentQuickAction(): CmdJQuickAction {
  return {
    id: OPEN_MANAGER_AGENT_QUICK_ACTION_ID,
    kind: 'action',
    title: translate('auto.components.cmd.j.quick.actions.openManager', 'Open Manager'),
    description: translate(
      'auto.components.cmd.j.quick.actions.openManagerDescription',
      'Open the Manager chat that delegates work to other agents.'
    ),
    icon: BriefcaseBusiness,
    verbKeywords: [
      translate('auto.components.cmd.j.quick.actions.verbs.openManager', 'open manager'),
      translate('auto.components.cmd.j.quick.actions.verbs.manager', 'manager'),
      translate('auto.components.cmd.j.quick.actions.verbs.chiefOfStaff', 'chief of staff'),
      translate('auto.components.cmd.j.quick.actions.verbs.delegate', 'delegate work')
    ],
    isAvailable: getManagerAgentQuickActionAvailability,
    run: async (ctx) => {
      const availability = getManagerAgentQuickActionAvailability(ctx)
      if (!availability.available) {
        return { status: 'unavailable', reason: availability.reason }
      }
      // Why lazy: the launch path is heavy and only needed once the action runs.
      void import('@/components/manager-agent/open-manager-agent').then(({ openManagerAgent }) =>
        openManagerAgent('command_palette')
      )
      return { status: 'ok' }
    }
  }
}
