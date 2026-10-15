import type { TuiAgent } from '../../../../shared/tui-agent'
import type { ManagerAgentSurface } from '../../../../shared/agent-oversight-experimental-settings'
import {
  quoteStartupArg,
  type AgentStartupShell
} from '../../../../shared/tui-agent-startup-shell'

/** The visible first message when the brief already rides the CLI's system prompt. */
export const MANAGER_AGENT_KICKOFF_PROMPT =
  'Get set up as my Orca Manager and give me a one-line status.'

export type ManagerAgentBriefDelivery = {
  /** The launch's initial prompt. */
  prompt: string
  /** Replaces the agent's default CLI args when the brief rides a flag; absent keeps defaults. */
  agentArgs?: string
  channel: 'system-prompt' | 'first-message'
}

/**
 * How a Manager's brief reaches its agent. Chats and most terminal agents get it as the first
 * message. Claude Code in a terminal gets it through `--append-system-prompt`, which works in
 * interactive mode, plus a short visible kickoff.
 */
export function planManagerAgentBriefDelivery(args: {
  agent: TuiAgent
  surface: ManagerAgentSurface
  brief: string
  shell: AgentStartupShell
  /** The user's default CLI args for this agent; kept ahead of the brief flag. */
  defaultAgentArgs: string | null | undefined
}): ManagerAgentBriefDelivery {
  // Why POSIX only: cmd cannot quote a newline, and a multi-line line typed into PowerShell is
  // unverified; those launches fall back to the first-message brief.
  if (args.surface !== 'terminal' || args.agent !== 'claude' || args.shell !== 'posix') {
    return { prompt: args.brief, channel: 'first-message' }
  }
  // Why argv, not a file: the command is typed into the host's shell, so SSH and WSL hosts get
  // it with no upload; the ~4 KB brief is far below argv limits. The args string is re-tokenized
  // and re-quoted by the launch builder, which round-trips this POSIX quoting.
  const flag = `--append-system-prompt ${quoteStartupArg(args.brief, 'posix')}`
  const defaults = args.defaultAgentArgs?.trim()
  return {
    prompt: MANAGER_AGENT_KICKOFF_PROMPT,
    agentArgs: defaults ? `${defaults} ${flag}` : flag,
    channel: 'system-prompt'
  }
}
