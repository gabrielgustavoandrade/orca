import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { buildAgentStartupPlan } from '../../../../shared/tui-agent-startup'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { buildManagerAgentBrief } from './manager-agent-brief'
import {
  MANAGER_AGENT_KICKOFF_PROMPT,
  planManagerAgentBriefDelivery
} from './manager-agent-brief-delivery'

const BRIEF = [
  buildManagerAgentBrief('orca'),
  `Edge cases: it's "quoted", a \\ backslash, $HOME, $(whoami), \`tick\`, !bang, %PATH%.`
].join('\n')

function startupCommand(agent: TuiAgent, defaultAgentArgs: string | null = null): string {
  const delivery = planManagerAgentBriefDelivery({
    agent,
    surface: 'terminal',
    brief: BRIEF,
    shell: 'posix',
    defaultAgentArgs
  })
  const plan = buildAgentStartupPlan({
    agent,
    prompt: delivery.prompt,
    cmdOverrides: {},
    platform: 'linux',
    shell: 'posix',
    agentArgs: delivery.agentArgs ?? defaultAgentArgs
  })
  if (!plan) {
    throw new Error('no startup plan')
  }
  return plan.launchCommand
}

/** The argv a POSIX shell hands the agent for this command line. */
function shellArgv(command: string, executable: string): string[] {
  expect(command.startsWith(`${executable} `)).toBe(true)
  const script = `${JSON.stringify(process.execPath)} -e 'process.stdout.write(JSON.stringify(process.argv.slice(1)))' -- ${command.slice(executable.length + 1)}`
  return JSON.parse(execFileSync('/bin/sh', ['-c', script], { encoding: 'utf8' }))
}

describe('planManagerAgentBriefDelivery', () => {
  it('sends Claude in a terminal the brief as an appended system prompt plus a kickoff', () => {
    const delivery = planManagerAgentBriefDelivery({
      agent: 'claude',
      surface: 'terminal',
      brief: BRIEF,
      shell: 'posix',
      defaultAgentArgs: null
    })
    expect(delivery.channel).toBe('system-prompt')
    expect(delivery.prompt).toBe(MANAGER_AGENT_KICKOFF_PROMPT)
  })

  it.skipIf(process.platform === 'win32')(
    'quotes the multi-line brief so a POSIX shell passes it to Claude as one argument',
    () => {
      expect(shellArgv(startupCommand('claude'), 'claude')).toEqual([
        '--append-system-prompt',
        BRIEF,
        MANAGER_AGENT_KICKOFF_PROMPT
      ])
    }
  )

  it.skipIf(process.platform === 'win32')('keeps the user default Claude args first', () => {
    expect(shellArgv(startupCommand('claude', '--model opus'), 'claude')).toEqual([
      '--model',
      'opus',
      '--append-system-prompt',
      BRIEF,
      MANAGER_AGENT_KICKOFF_PROMPT
    ])
  })

  it.skipIf(process.platform === 'win32')(
    'gives Codex the brief as its initial prompt argument',
    () => {
      const delivery = planManagerAgentBriefDelivery({
        agent: 'codex',
        surface: 'terminal',
        brief: BRIEF,
        shell: 'posix',
        defaultAgentArgs: null
      })
      expect(delivery).toEqual({ prompt: BRIEF, channel: 'first-message' })
      expect(shellArgv(startupCommand('codex'), 'codex')).toEqual([BRIEF])
    }
  )

  it('uses the first-message brief for other terminal agents', () => {
    for (const agent of ['gemini', 'opencode', 'pi'] satisfies TuiAgent[]) {
      expect(
        planManagerAgentBriefDelivery({
          agent,
          surface: 'terminal',
          brief: BRIEF,
          shell: 'posix',
          defaultAgentArgs: '--x'
        })
      ).toEqual({ prompt: BRIEF, channel: 'first-message' })
    }
  })

  it('keeps chats on the first-message brief, Claude included', () => {
    expect(
      planManagerAgentBriefDelivery({
        agent: 'claude',
        surface: 'chat',
        brief: BRIEF,
        shell: 'posix',
        defaultAgentArgs: null
      })
    ).toEqual({ prompt: BRIEF, channel: 'first-message' })
  })

  it('falls back to the first message on Windows shells', () => {
    for (const shell of ['cmd', 'powershell'] as const) {
      expect(
        planManagerAgentBriefDelivery({
          agent: 'claude',
          surface: 'terminal',
          brief: BRIEF,
          shell,
          defaultAgentArgs: null
        }).channel
      ).toBe('first-message')
    }
  })
})
