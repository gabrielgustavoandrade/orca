import { ChevronDown, Folder, GitBranch, Globe } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  GLOBAL_MANAGER_SCOPE_KEY,
  parseManagerScopeKey,
  projectManagerScopeKey,
  workspaceManagerScopeKey,
  type ManagerScopeKey
} from '../../../../shared/manager-agent-records'
import { listManagerScopeProjects } from './manager-agent-scope'
import { managerScopeLabel } from './manager-scope-labels'
import { ManagerScopeBadge } from './ManagerScopeBadge'
import { openManagerScope } from './open-manager-agent'

function ScopeEntryTrailing({ scopeKey }: { scopeKey: ManagerScopeKey }): React.JSX.Element {
  const hasManager = useAppStore((state) => Boolean(state.managerAgents[scopeKey]))
  return hasManager ? (
    <ManagerScopeBadge scopeKey={scopeKey} className="ml-auto" />
  ) : (
    <span className="ml-auto text-2xs text-muted-foreground">
      {translate('auto.components.managerAgent.addManager', '+ add manager')}
    </span>
  )
}

function WorkspaceEntry({ worktree }: { worktree: Worktree }): React.JSX.Element {
  const scopeKey = workspaceManagerScopeKey(worktree.id)
  return (
    <DropdownMenuItem inset onSelect={() => void openManagerScope(scopeKey, 'unknown')}>
      <GitBranch />
      <span className="min-w-0 flex-1 truncate">{worktree.displayName}</span>
      <ScopeEntryTrailing scopeKey={scopeKey} />
    </DropdownMenuItem>
  )
}

/**
 * Breadcrumb switcher: all projects, then each project with the workspaces worth listing inline
 * (ones with a Manager, the active one, the open scope). The rest sit in a per-project submenu.
 */
export function ManagerScopeSwitcher({
  scopeKey
}: {
  scopeKey: ManagerScopeKey
}): React.JSX.Element {
  const label = useAppStore((state) => managerScopeLabel(state, scopeKey))
  const projects = useAppStore(listManagerScopeProjects)
  const managerAgents = useAppStore((state) => state.managerAgents)
  const activeWorktreeId = useAppStore((state) => state.activeWorktreeId)
  const scope = parseManagerScopeKey(scopeKey)
  const ScopeIcon =
    scope?.kind === 'workspace' ? GitBranch : scope?.kind === 'project' ? Folder : Globe
  const isInline = (worktree: Worktree): boolean =>
    Boolean(managerAgents[workspaceManagerScopeKey(worktree.id)]) ||
    worktree.id === activeWorktreeId ||
    (scope?.kind === 'workspace' && scope.worktreeId === worktree.id)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="xs" className="max-w-64">
          <ScopeIcon className="size-3.5 text-muted-foreground" />
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel>
          {translate('auto.components.managerAgent.switchManager', 'Switch manager')}
        </DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => void openManagerScope(GLOBAL_MANAGER_SCOPE_KEY, 'unknown')}
        >
          <Globe />
          <span className="flex-1">
            {translate('auto.components.managerAgent.allProjects', 'All projects')}
          </span>
          <ScopeEntryTrailing scopeKey={GLOBAL_MANAGER_SCOPE_KEY} />
        </DropdownMenuItem>
        {projects.length > 0 ? (
          <DropdownMenuLabel>
            {translate('auto.components.managerAgent.projects', 'Projects')}
          </DropdownMenuLabel>
        ) : null}
        {projects.map(({ project, worktrees }) => {
          const projectKey = projectManagerScopeKey(project.id)
          const inline = worktrees.filter(isInline)
          const rest = worktrees.filter((worktree) => !isInline(worktree))
          return (
            <div key={project.id}>
              <DropdownMenuItem onSelect={() => void openManagerScope(projectKey, 'unknown')}>
                <Folder />
                <span className="min-w-0 flex-1 truncate">{project.displayName}</span>
                <ScopeEntryTrailing scopeKey={projectKey} />
              </DropdownMenuItem>
              {inline.map((worktree) => (
                <WorkspaceEntry key={worktree.id} worktree={worktree} />
              ))}
              {rest.length > 0 ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger inset>
                    <span className="text-muted-foreground">
                      {translate(
                        'auto.components.managerAgent.moreWorkspaces',
                        '{{count}} more workspaces',
                        { count: rest.length }
                      )}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-80 w-72">
                    {rest.map((worktree) => (
                      <WorkspaceEntry key={worktree.id} worktree={worktree} />
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : null}
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
