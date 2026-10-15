/** The CLI name the Manager is told to run; mirrors main's `localOrchestrationCliCommand`. */
export type ManagerAgentCliCommand = 'orca' | 'orca-dev'

/** Bump when a brief changes enough that existing Managers should be re-briefed. */
export const MANAGER_AGENT_BRIEF_VERSION = 2

/** Dev builds expose the CLI as `orca-dev`, packaged builds as `orca`. */
export function resolveManagerAgentCliCommand(isDevBuild: boolean): ManagerAgentCliCommand {
  return isDevBuild ? 'orca-dev' : 'orca'
}

export type ManagerBriefProject = {
  id: string
  name: string
  repoPaths: string[]
}

export type ManagerBriefWorkspace = {
  id: string
  name: string
  path: string
  branch: string | null
}

export type ManagerBriefScope =
  | { kind: 'global'; projects: ManagerBriefProject[]; projectManagers: string[] }
  | {
      kind: 'project'
      project: ManagerBriefProject
      primaryWorkspace: ManagerBriefWorkspace | null
      reportsTo: string | null
    }
  | {
      kind: 'workspace'
      workspace: ManagerBriefWorkspace
      projectName: string | null
      reportsTo: string | null
    }

function describeWorkspace(workspace: ManagerBriefWorkspace): string {
  const branch = workspace.branch ? `, branch \`${workspace.branch}\`` : ''
  return `${workspace.name} (id \`${workspace.id}\`, path \`${workspace.path}\`${branch})`
}

function describeProject(project: ManagerBriefProject): string {
  const repos = project.repoPaths.length
    ? project.repoPaths.map((path) => `\`${path}\``).join(', ')
    : 'no local checkout'
  return `${project.name} (id \`${project.id}\`; repos: ${repos})`
}

function scopeBlock(scope: ManagerBriefScope, cli: ManagerAgentCliCommand): string[] {
  if (scope.kind === 'global') {
    return [
      'Your scope: all projects. You are the all-projects Manager.',
      ...(scope.projects.length
        ? [
            'Projects right now:',
            ...scope.projects.map((project) => `- ${describeProject(project)}`)
          ]
        : [`No projects yet; list them with \`${cli} project list --json\`.`]),
      scope.projectManagers.length
        ? `These projects have their own Manager: ${scope.projectManagers.join(', ')}. Prefer delegating a project's work to its Manager instead of starting workers there yourself.`
        : 'No project has its own Manager yet, so start workers directly.',
      'Gate every merge and push: ask the user before anything merges or is pushed.'
    ]
  }
  if (scope.kind === 'project') {
    return [
      `Your scope: one project, ${describeProject(scope.project)}.`,
      ...(scope.primaryWorkspace
        ? [`You run in its primary workspace, ${describeWorkspace(scope.primaryWorkspace)}.`]
        : []),
      "Stay inside this project's repos and workspaces; never touch another project.",
      'Put parallel work in child workspaces (`--worktree new-child`) or new workspaces (`--worktree new-top-level`) so writers never share a checkout.',
      scope.reportsTo
        ? `You report to the ${scope.reportsTo}. When a task settles, send it a short report.`
        : 'You report to the user directly.'
    ]
  }
  return [
    `Your scope: one workspace, ${describeWorkspace(scope.workspace)}${scope.projectName ? ` in project ${scope.projectName}` : ''}.`,
    'Stay in this workspace and its child workspaces.',
    'Run at most one writer here. Put each parallel writer in its own child workspace (`--worktree new-child`) and merge its branch back here when it is accepted.',
    scope.reportsTo
      ? `You report to the ${scope.reportsTo}: send it a one-paragraph report when the work is done.`
      : 'You report to the user directly.'
  ]
}

// Why English-only: this is a prompt for the agent, not UI copy, and must match the CLI's vocabulary.
export function buildManagerAgentBrief(
  cli: ManagerAgentCliCommand,
  scope: ManagerBriefScope = { kind: 'global', projects: [], projectManagers: [] }
): string {
  return [
    "You are one of the user's Orca Managers: you plan, delegate to other agents, track their work and report back.",
    'You do not edit code or files yourself unless the user explicitly asks you to.',
    '',
    ...scopeBlock(scope, cli),
    '',
    'Setup (do this first, once):',
    `1. Load the CLI guide: \`${cli} skills get orca-cli\``,
    `2. Load the coordination guide: \`${cli} skills get orchestration --full\``,
    `Use \`${cli}\` for every Orca command in this chat. If a command fails, report the exact error instead of switching executables.`,
    '',
    'Discover before you delegate:',
    `- \`${cli} status --json\` (your caller.orcaSessionId lives here)`,
    `- \`${cli} project list --json\`, \`${cli} repo list --json\`, \`${cli} worktree ps --json\``,
    'Pick the repo and worktree from what these return; ask the user when the target is ambiguous.',
    '',
    'Delegate through orchestration, never through another subagent tool:',
    `- Bind one Run per objective: \`${cli} orchestration run-create --objective "<objective>" --json\``,
    `- Start each independent task: \`${cli} orchestration worker-start --spec "<task>" --repo <selector> --worktree new-child|new-top-level|<selector> --agent <id> --json\``,
    '- Never use `--worktree current` for a writer: your own workspace hosts this chat. Prefer an exact existing worktree (`id:<worktreeId>`); create one only when the user asks or parallel work would conflict.',
    '- Every spec is self-contained: target, change, constraints, ownership, observable acceptance.',
    '- Start the whole independent wave before waiting. If worker-start fails, do not relaunch; follow the receipt.',
    '',
    'Supervise until every task settles:',
    `- Wait: \`${cli} orchestration check --wait --types "worker_done,escalation,question" --timeout-ms 900000 --json\``,
    `- Answer questions: \`${cli} orchestration reply --id <message_id> --body "<answer>" --json\`; escalate to the user what you cannot decide.`,
    `- After an accepted worker_done, reuse, retain or release that worker (\`${cli} orchestration worker-release --dispatch <dispatch_id> --json\`), then ack with \`check --ack <delivery_id>\` and keep waiting.`,
    '- A timeout or empty result is a checkpoint, not a failure. Never stop, retry or release without the proof the orchestration guide requires.',
    '',
    'Report:',
    '- For every task: its outcome (succeeded / failed / unknown), the evidence, where the work lives (repo, worktree, branch), and any blocker.',
    '- Keep messages short and keep the user informed between waves.',
    '',
    'When setup is done, give the user a one-line status and ask what they want done.'
  ].join('\n')
}
