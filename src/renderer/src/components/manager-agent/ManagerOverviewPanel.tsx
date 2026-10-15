import { CornerDownRight, Folder, GitBranch, Globe } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AgentStateDot, type AgentDotState } from '@/components/AgentStateDot'
import { AgentQuestionIcon } from '@/components/AgentQuestionIcon'
import { AgentIcon } from '@/lib/agent-catalog'
import {
  parseManagerScopeKey,
  type ManagerAgentRecord,
  type ManagerScopeKey
} from '../../../../shared/manager-agent-records'
import {
  countManagerOverview,
  isManagerRunActive,
  type ManagerOverview,
  type ManagerOverviewRun,
  type ManagerOverviewTask,
  type ManagerOverviewTaskState
} from './manager-overview-data'
import { useScopedManagerOverview } from './use-manager-scope-counts'
import { findManagerScopeWorktree } from './manager-agent-scope'
import { findManagerRecordTab, openManagerScope } from './open-manager-agent'
import { managerDisplayName } from './manager-scope-labels'
import { buildManagerTree, type ManagerTreeNode } from './manager-tree'

const RECENT_DONE_LIMIT = 5

const TASK_DOT_STATE: Record<ManagerOverviewTaskState, AgentDotState> = {
  working: 'working',
  'needs-you': 'permission',
  done: 'done',
  failed: 'failed',
  queued: 'idle'
}

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="px-1 pb-1.5 pt-3 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  )
}

function EmptyState({ text }: { text: string }): React.JSX.Element {
  return <div className="px-1 py-6 text-center text-xs text-muted-foreground">{text}</div>
}

function TaskRow({ task }: { task: ManagerOverviewTask }): React.JSX.Element {
  const workspaceName = useAppStore((state) =>
    task.worker?.worktreeId
      ? (findManagerScopeWorktree(state, task.worker.worktreeId)?.displayName ?? null)
      : null
  )
  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      <AgentStateDot state={TASK_DOT_STATE[task.state]} />
      <span className="min-w-0 flex-1 truncate">{task.title}</span>
      <span className="max-w-32 shrink-0 truncate text-muted-foreground">
        {workspaceName ??
          (task.state === 'queued'
            ? translate('auto.components.managerAgent.queued', 'queued')
            : '')}
      </span>
    </div>
  )
}

function RunCard({ run }: { run: ManagerOverviewRun }): React.JSX.Element {
  const done = run.tasks.filter((task) => task.state === 'done').length
  return (
    <div className="mb-2 rounded-lg border border-border bg-card p-3">
      <div className="mb-1 truncate text-sm font-medium">{run.objective || run.id}</div>
      {run.tasks.length > 0 ? (
        <div className="mb-2 text-2xs text-muted-foreground">
          {translate('auto.components.managerAgent.tasksDone', '{{done}} of {{total}} tasks done', {
            done,
            total: run.tasks.length
          })}
        </div>
      ) : null}
      {run.tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </div>
  )
}

function WorkTab({ overview }: { overview: ManagerOverview }): React.JSX.Element {
  const active = overview.runs.filter(isManagerRunActive)
  const recent = overview.runs.filter((run) => !isManagerRunActive(run)).slice(0, RECENT_DONE_LIMIT)
  if (active.length === 0 && recent.length === 0) {
    return (
      <EmptyState
        text={translate('auto.components.managerAgent.noWork', 'No delegated work yet')}
      />
    )
  }
  return (
    <>
      {active.length > 0 ? (
        <SectionLabel>
          {translate('auto.components.managerAgent.activeRuns', 'Active runs')}
        </SectionLabel>
      ) : null}
      {active.map((run) => (
        <RunCard key={run.id} run={run} />
      ))}
      {recent.length > 0 ? (
        <SectionLabel>
          {translate('auto.components.managerAgent.recentlyDone', 'Recently done')}
        </SectionLabel>
      ) : null}
      {recent.map((run) => (
        <RunCard key={run.id} run={run} />
      ))}
    </>
  )
}

function NeedsYouTab({ overview }: { overview: ManagerOverview }): React.JSX.Element {
  const items = overview.runs.flatMap((run) => [
    ...run.gates.map((gate) => ({
      key: `gate:${gate.id}`,
      title: gate.question,
      detail: translate('auto.components.managerAgent.decisionGate', 'Decision gate · {{run}}', {
        run: run.objective || run.id
      })
    })),
    ...run.tasks
      .filter((task) => task.worker?.needsInput)
      .map((task) => ({
        key: `ask:${task.id}`,
        title: task.title,
        detail: translate('auto.components.managerAgent.workerAsks', 'Worker is asking · {{run}}', {
          run: run.objective || run.id
        })
      }))
  ])
  if (items.length === 0) {
    return (
      <EmptyState
        text={translate('auto.components.managerAgent.nothingWaiting', 'Nothing is waiting on you')}
      />
    )
  }
  return (
    <>
      {items.map((item) => (
        <div
          key={item.key}
          className="mb-2 rounded-lg border border-agent-question/40 bg-agent-question/10 p-3"
        >
          <div className="flex items-center gap-1.5 text-sm font-medium text-agent-question-text">
            <AgentQuestionIcon className="size-3.5" />
            <span className="min-w-0 truncate">{item.title}</span>
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</div>
        </div>
      ))}
    </>
  )
}

function ManagerTreeRow({
  node,
  depth
}: {
  node: ManagerTreeNode
  depth: number
}): React.JSX.Element {
  const name = useAppStore((state) => managerDisplayName(state, node.record.scopeKey))
  const alive = useAppStore(
    (state) => findManagerRecordTab(state.unifiedTabsByWorktree, node.record) !== null
  )
  const kind = parseManagerScopeKey(node.record.scopeKey)?.kind
  const Icon = kind === 'workspace' ? GitBranch : kind === 'project' ? Folder : Globe
  return (
    <>
      <button
        type="button"
        onClick={() => void openManagerScope(node.record.scopeKey, 'unknown')}
        className="flex w-full items-center gap-2 rounded-md py-1 pr-1 text-left text-xs hover:bg-accent"
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        {depth > 0 ? <CornerDownRight className="size-3 text-muted-foreground" /> : null}
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {node.record.agent ? <AgentIcon agent={node.record.agent} size={12} /> : null}
        <span className="text-2xs text-muted-foreground">
          {alive
            ? translate('auto.components.managerAgent.statusOpen', 'open')
            : translate('auto.components.managerAgent.statusClosed', 'closed')}
        </span>
      </button>
      {node.children.map((child) => (
        <ManagerTreeRow key={child.record.scopeKey} node={child} depth={depth + 1} />
      ))}
    </>
  )
}

function ManagersTab({ records }: { records: ManagerAgentRecord[] }): React.JSX.Element {
  const tree = buildManagerTree(records)
  if (tree.length === 0) {
    return (
      <EmptyState text={translate('auto.components.managerAgent.noManagers', 'No Managers yet')} />
    )
  }
  return (
    <div className="pt-2">
      {tree.map((node) => (
        <ManagerTreeRow key={node.record.scopeKey} node={node} depth={0} />
      ))}
    </div>
  )
}

/** Read-only overview of the scope's delegated work, what waits on the user, and the Managers. */
export function ManagerOverviewPanel({
  scopeKey
}: {
  scopeKey: ManagerScopeKey
}): React.JSX.Element {
  const { overview, failed } = useScopedManagerOverview(scopeKey, { enabled: true, page: true })
  const managerAgents = useAppStore((state) => state.managerAgents)
  const records = Object.values(managerAgents)
  const counts = overview ? countManagerOverview(overview) : { working: 0, needsYou: 0 }
  const body = (render: (value: ManagerOverview) => React.JSX.Element): React.JSX.Element =>
    overview ? (
      render(overview)
    ) : (
      <EmptyState
        text={
          failed
            ? translate(
                'auto.components.managerAgent.overviewFailed',
                'Could not read delegated work.'
              )
            : translate('auto.components.managerAgent.overviewLoading', 'Loading…')
        }
      />
    )
  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-border bg-muted/40">
      <Tabs defaultValue="work" className="min-h-0 flex-1">
        <div className="border-b border-border px-3">
          <TabsList variant="line" className="h-10">
            <TabsTrigger value="work" className="flex-none">
              {translate('auto.components.managerAgent.tabWork', 'Work')}
            </TabsTrigger>
            <TabsTrigger value="needs-you" className="flex-none">
              {translate('auto.components.managerAgent.tabNeedsYou', 'Needs you')}
              {counts.needsYou > 0 ? (
                <span className="rounded-full bg-agent-question px-1.5 text-3xs font-semibold text-background tabular-nums">
                  {counts.needsYou}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="managers" className="flex-none">
              {translate('auto.components.managerAgent.tabManagers', 'Managers')}
              <span className="text-3xs text-muted-foreground tabular-nums">{records.length}</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek px-3 pb-3">
          <TabsContent value="work">
            {body((value) => (
              <WorkTab overview={value} />
            ))}
          </TabsContent>
          <TabsContent value="needs-you">
            {body((value) => (
              <NeedsYouTab overview={value} />
            ))}
          </TabsContent>
          <TabsContent value="managers">
            <ManagersTab records={records} />
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  )
}
