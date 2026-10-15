import { z } from 'zod'

// Why local schemas: the RPC result types live in main; parsing keeps an older or newer runtime's
// extra or missing fields from breaking the read-only panel.
const RunSchema = z.object({
  id: z.string(),
  objective: z.string().catch(''),
  created_at: z.string().catch(''),
  updated_at: z.string().catch('')
})
const RunListSchema = z.object({ runs: z.array(RunSchema) })
const TaskSchema = z.object({
  id: z.string(),
  task_title: z.string().nullable().catch(null),
  display_name: z.string().nullable().catch(null),
  spec: z.string().catch(''),
  status: z.string(),
  completed_at: z.string().nullable().catch(null)
})
const TaskListSchema = z.object({ tasks: z.array(TaskSchema) })
const GateSchema = z.object({
  id: z.string(),
  task_id: z.string().nullable().catch(null),
  question: z.string().catch(''),
  created_at: z.string().catch('')
})
const GateListSchema = z.object({ gates: z.array(GateSchema) })
const WorkerSchema = z.object({
  dispatchId: z.string(),
  taskId: z.string(),
  workerState: z.string().catch(''),
  dispatchStatus: z.string().catch(''),
  resource: z
    .object({ worktreeId: z.string().nullable().catch(null) })
    .nullable()
    .catch(null),
  projection: z
    .object({
      worktreeId: z.string().nullable().catch(null),
      pendingInput: z.boolean().optional().catch(undefined),
      pendingApproval: z.boolean().optional().catch(undefined)
    })
    .nullable()
    .catch(null)
})
const WorkerListSchema = z.object({ workers: z.array(WorkerSchema) })

export type ManagerOverviewTaskState = 'working' | 'needs-you' | 'done' | 'failed' | 'queued'

export type ManagerOverviewWorker = {
  dispatchId: string
  worktreeId: string | null
  needsInput: boolean
}

export type ManagerOverviewTask = {
  id: string
  title: string
  state: ManagerOverviewTaskState
  worker: ManagerOverviewWorker | null
}

export type ManagerOverviewGate = { id: string; taskId: string | null; question: string }

export type ManagerOverviewRun = {
  id: string
  objective: string
  updatedAt: string
  tasks: ManagerOverviewTask[]
  gates: ManagerOverviewGate[]
  /** Every worktree its workers ran in; the scope filter reads this. */
  worktreeIds: string[]
}

export type ManagerOverview = { runs: ManagerOverviewRun[] }

export type ManagerOverviewRpc = (method: string, params: unknown) => Promise<unknown>

/** Newest runs worth showing; older ones are history, not "what is going on". */
const RUN_LIMIT = 12

function taskTitle(task: z.infer<typeof TaskSchema>): string {
  return task.display_name || task.task_title || task.spec.split('\n')[0] || task.id
}

export function deriveManagerTaskState(
  status: string,
  hasOpenGate: boolean,
  workerNeedsInput: boolean
): ManagerOverviewTaskState {
  if (status === 'completed') {
    return 'done'
  }
  if (status === 'failed') {
    return 'failed'
  }
  if (hasOpenGate || workerNeedsInput) {
    return 'needs-you'
  }
  return status === 'dispatched' ? 'working' : 'queued'
}

async function readOptional<T>(read: Promise<unknown>, schema: z.ZodType<T>, empty: T): Promise<T> {
  try {
    const parsed = schema.safeParse(await read)
    return parsed.success ? parsed.data : empty
  } catch {
    return empty
  }
}

async function fetchRun(
  rpc: ManagerOverviewRpc,
  run: z.infer<typeof RunSchema>
): Promise<ManagerOverviewRun> {
  // Why explicit `run`: without it these methods resolve the caller's coordinator terminal.
  const [taskList, gateList, workerList] = await Promise.all([
    readOptional(rpc('orchestration.taskList', { run: run.id }), TaskListSchema, { tasks: [] }),
    readOptional(
      rpc('orchestration.gateList', { run: run.id, status: 'pending' }),
      GateListSchema,
      {
        gates: []
      }
    ),
    readOptional(rpc('orchestration.workerList', { run: run.id, limit: 100 }), WorkerListSchema, {
      workers: []
    })
  ])
  const workerByTaskId = new Map<string, ManagerOverviewWorker>()
  const worktreeIds = new Set<string>()
  for (const worker of workerList.workers) {
    const worktreeId = worker.projection?.worktreeId ?? worker.resource?.worktreeId ?? null
    if (worktreeId) {
      worktreeIds.add(worktreeId)
    }
    workerByTaskId.set(worker.taskId, {
      dispatchId: worker.dispatchId,
      worktreeId,
      needsInput: worker.projection?.pendingInput === true
    })
  }
  const gates = gateList.gates.map((gate) => ({
    id: gate.id,
    taskId: gate.task_id,
    question: gate.question
  }))
  const gatedTaskIds = new Set(gates.map((gate) => gate.taskId))
  return {
    id: run.id,
    objective: run.objective,
    updatedAt: run.updated_at,
    gates,
    worktreeIds: [...worktreeIds],
    tasks: taskList.tasks.map((task) => {
      const worker = workerByTaskId.get(task.id) ?? null
      return {
        id: task.id,
        title: taskTitle(task),
        state: deriveManagerTaskState(
          task.status,
          gatedTaskIds.has(task.id),
          worker?.needsInput === true
        ),
        worker
      }
    })
  }
}

/** Reads the newest runs with their tasks, open gates and workers. */
export async function fetchManagerOverview(rpc: ManagerOverviewRpc): Promise<ManagerOverview> {
  const parsed = RunListSchema.parse(await rpc('orchestration.runList', { limit: RUN_LIMIT }))
  return { runs: await Promise.all(parsed.runs.map((run) => fetchRun(rpc, run))) }
}

/**
 * Runs a scope can see. Global sees everything; a project or workspace sees a run when any of
 * its workers ran in one of the scope's worktrees. The coordinator's own worktree is not on the
 * wire, so a run with no workers yet shows only in the global scope.
 */
export function filterManagerOverviewByScope(
  overview: ManagerOverview,
  worktreeIds: ReadonlySet<string> | null
): ManagerOverview {
  if (!worktreeIds) {
    return overview
  }
  return { runs: overview.runs.filter((run) => run.worktreeIds.some((id) => worktreeIds.has(id))) }
}

export function isManagerRunActive(run: ManagerOverviewRun): boolean {
  return (
    run.tasks.length === 0 ||
    run.tasks.some((task) => task.state !== 'done' && task.state !== 'failed')
  )
}

export type ManagerOverviewCounts = { working: number; needsYou: number }

export function countManagerOverview(overview: ManagerOverview): ManagerOverviewCounts {
  let working = 0
  let needsYou = 0
  for (const run of overview.runs) {
    for (const task of run.tasks) {
      if (task.state === 'working') {
        working += 1
      } else if (task.state === 'needs-you') {
        needsYou += 1
      }
    }
    // Why: a gate on no task still waits on the user.
    needsYou += run.gates.filter((gate) => gate.taskId === null).length
  }
  return { working, needsYou }
}
