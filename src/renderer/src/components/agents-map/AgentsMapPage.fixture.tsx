import { defineFixture } from '../../component-fixtures/component-fixture'
import { useAppStore } from '@/store'
import { getDefaultSettings } from '../../../../shared/constants'
import { makePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import type { AgentStatusRouting } from '@/store/slices/agent-status/agent-status-contract'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import type { TerminalTab } from '../../../../shared/workspace-layout/terminal-tab-types'
import AgentsMapPage from './AgentsMapPage'

const WEB_REPO = 'fixture-web'
const NOTES_REPO = 'fixture-notes'
const CHECKOUT = `${WEB_REPO}::/fixture/web-checkout`
const LOGIN = `${WEB_REPO}::/fixture/web-login`
const NOTES = `${NOTES_REPO}::/fixture/notes`

const leaf = (n: number): string => `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`

function repo(id: string, name: string, kind: 'git' | 'folder'): Repo {
  return {
    id,
    path: `/fixture/${name}`,
    displayName: name,
    badgeColor: '#8b5cf6',
    addedAt: 0,
    kind,
    executionHostId: 'local'
  }
}

function worktree(id: string, repoId: string, name: string, order: number): Worktree {
  return {
    id,
    repoId,
    path: id.split('::')[1],
    head: 'fixture-head',
    branch: name,
    isBare: false,
    isMainWorktree: false,
    displayName: name,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: order,
    lastActivityAt: 0
  }
}

function tab(
  id: string,
  worktreeId: string,
  title: string,
  agent: 'claude' | 'codex'
): TerminalTab {
  return {
    id,
    ptyId: null,
    worktreeId,
    title,
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 0,
    launchAgent: agent
  }
}

const tabs = {
  lead: tab('tab-lead', CHECKOUT, 'Coordinate release checks', 'claude'),
  blocked: tab('tab-blocked', CHECKOUT, 'Run staging migration', 'claude'),
  child: tab('tab-child', LOGIN, 'Fix login redirect', 'codex'),
  done: tab('tab-done', LOGIN, 'Add rate limiter', 'codex'),
  idle: tab('tab-idle', NOTES, 'Summarize meeting notes', 'claude')
}
const paneKeys = {
  lead: makePaneKey(tabs.lead.id, leaf(1)),
  blocked: makePaneKey(tabs.blocked.id, leaf(2)),
  child: makePaneKey(tabs.child.id, leaf(3)),
  done: makePaneKey(tabs.done.id, leaf(4)),
  idle: makePaneKey(tabs.idle.id, leaf(5))
}

function seedAgents(): void {
  const now = Date.now()
  const route = (key: keyof typeof tabs): AgentStatusRouting => ({
    tabId: tabs[key].id,
    worktreeId: tabs[key].worktreeId,
    connectionId: null
  })
  useAppStore.getState().setAgentStatuses([
    {
      paneKey: paneKeys.lead,
      payload: {
        state: 'working',
        prompt: 'Coordinate release checks',
        agentType: 'claude',
        toolName: 'Bash',
        toolInput: 'pnpm test --maxWorkers=2',
        lastAssistantMessage: 'Dispatched the login fix to a worker and started the test run.',
        subagents: [
          { id: 'explore', description: 'Explore changelog', state: 'working', startedAt: now },
          { id: 'review', description: 'Review diff', state: 'idle', startedAt: now }
        ]
      },
      timing: { updatedAt: now - 3_000, stateStartedAt: now - 300_000 },
      routing: route('lead')
    },
    {
      paneKey: paneKeys.blocked,
      payload: {
        state: 'blocked',
        prompt: 'Run staging migration',
        agentType: 'claude',
        toolName: 'AskUserQuestion',
        interactivePrompt: JSON.stringify({
          questions: [
            {
              question: 'Run the migration on staging?',
              options: [{ label: 'Yes' }, { label: 'No' }]
            }
          ]
        })
      },
      timing: { updatedAt: now - 20_000, stateStartedAt: now - 240_000 },
      routing: route('blocked')
    },
    {
      paneKey: paneKeys.child,
      payload: {
        state: 'working',
        prompt: 'Fix login redirect',
        agentType: 'codex',
        toolName: 'Edit',
        toolInput: 'src/auth/redirect.ts',
        orchestration: { taskId: 'task-1', dispatchId: 'dispatch-1', parentPaneKey: paneKeys.lead }
      },
      timing: { updatedAt: now - 2_000, stateStartedAt: now - 120_000 },
      routing: route('child')
    },
    {
      paneKey: paneKeys.done,
      payload: {
        state: 'done',
        prompt: 'Add rate limiter',
        agentType: 'codex',
        lastAssistantMessage: 'Added the limiter and covered it with a test.\nSee limiter.ts.'
      },
      timing: { updatedAt: now - 30_000, stateStartedAt: now - 200_000 },
      routing: route('done')
    },
    {
      paneKey: paneKeys.idle,
      payload: {
        state: 'done',
        prompt: 'Summarize meeting notes',
        agentType: 'claude',
        lastAssistantMessage: 'Summary saved to notes/summary.md.'
      },
      timing: { updatedAt: now - 3_600_000, stateStartedAt: now - 3_700_000 },
      routing: route('idle')
    }
  ])
}

export const agentsMap = defineFixture({
  width: 1200,
  store: {
    settings: { ...getDefaultSettings('/'), experimentalAgentsMap: true },
    activeView: 'agents-map',
    repos: [repo(WEB_REPO, 'web-app', 'git'), repo(NOTES_REPO, 'notes', 'folder')],
    worktreesByRepo: {
      [WEB_REPO]: [
        worktree(CHECKOUT, WEB_REPO, 'feature/checkout', 0),
        worktree(LOGIN, WEB_REPO, 'fix/login', 1)
      ],
      [NOTES_REPO]: [worktree(NOTES, NOTES_REPO, 'notes', 0)]
    },
    tabsByWorktree: {
      [CHECKOUT]: [tabs.lead, tabs.blocked],
      [LOGIN]: [tabs.child, tabs.done],
      [NOTES]: [tabs.idle]
    }
  },
  setup: seedAgents,
  render: () => (
    <div className="flex h-[560px] bg-background text-foreground">
      <AgentsMapPage />
    </div>
  )
})
