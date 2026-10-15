import type { AgentDashboardMode } from './ui-chrome-types'

/** Experimental surfaces for overseeing agents across worktrees: the Agent Dashboard and the Manager chat. */
export type AgentOversightExperimentalSettings = {
  /** Experimental: pop-out Kanban dashboard for monitoring and opening agent terminals across worktrees. */
  experimentalAgentDashboardPopout?: boolean
  /** How the Agent Dashboard opens: an in-window companion board or a separate pop-out window. Defaults to in-window. */
  experimentalAgentDashboardMode?: AgentDashboardMode
  /** Includes stale quiet agents as a fourth Agent Dashboard column. */
  experimentalAgentDashboardShowIdle?: boolean
  /** Experimental: one persistent Manager chat that delegates work to other agents through orchestration. */
  experimentalManagerAgent?: boolean
  /** Where a new Manager runs: the agent's own CLI in a terminal (absent), or the opt-in Chat UI. */
  managerAgentSurface?: ManagerAgentSurface
}

export type ManagerAgentSurface = 'terminal' | 'chat'

/** Why terminal by default: some agent subscriptions may only be used through their own CLI. */
export function resolveManagerAgentSurface(
  settings: Pick<AgentOversightExperimentalSettings, 'managerAgentSurface'> | null | undefined
): ManagerAgentSurface {
  return settings?.managerAgentSurface === 'chat' ? 'chat' : 'terminal'
}
