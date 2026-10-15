import { BriefcaseBusiness } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import {
  projectManagerScopeKey,
  workspaceManagerScopeKey,
  type ManagerScopeKey
} from '../../../../shared/manager-agent-records'
import { ManagerScopeBadge } from './ManagerScopeBadge'
import { openManagerScope } from './open-manager-agent'
import { projectIdForManagerRepo } from './manager-agent-scope'

function useManagerEnabled(): boolean {
  return useAppStore((state) => state.settings?.experimentalManagerAgent === true)
}

function useProjectScopeKeyForRepo(repoId: string): ManagerScopeKey | null {
  const projectId = useAppStore((state) => projectIdForManagerRepo(state, repoId))
  return projectId ? projectManagerScopeKey(projectId) : null
}

function OpenManagerBadge({ scopeKey }: { scopeKey: ManagerScopeKey }): React.JSX.Element {
  return (
    <button
      type="button"
      className="inline-flex shrink-0 rounded-md"
      data-repo-header-action=""
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void openManagerScope(scopeKey, 'sidebar')
      }}
    >
      <ManagerScopeBadge scopeKey={scopeKey} />
    </button>
  )
}

function ScopeBadge({ scopeKey }: { scopeKey: ManagerScopeKey }): React.JSX.Element | null {
  const hasManager = useAppStore((state) => Boolean(state.managerAgents[scopeKey]))
  return hasManager ? <OpenManagerBadge scopeKey={scopeKey} /> : null
}

/** Briefcase badge on a project header row, shown only when that project has a Manager. */
export function ManagerProjectHeaderBadge({
  repoId
}: {
  repoId: string
}): React.JSX.Element | null {
  const enabled = useManagerEnabled()
  const scopeKey = useProjectScopeKeyForRepo(repoId)
  return enabled && scopeKey ? <ScopeBadge scopeKey={scopeKey} /> : null
}

/** Briefcase badge on a workspace row, shown only when that workspace has a Manager. */
export function ManagerWorktreeBadge({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  const enabled = useManagerEnabled()
  return enabled ? <ScopeBadge scopeKey={workspaceManagerScopeKey(worktreeId)} /> : null
}

function ManagerScopeMenuItem({ scopeKey }: { scopeKey: ManagerScopeKey }): React.JSX.Element {
  const hasManager = useAppStore((state) => Boolean(state.managerAgents[scopeKey]))
  return (
    <DropdownMenuItem onSelect={() => void openManagerScope(scopeKey, 'sidebar')}>
      <BriefcaseBusiness className="size-3.5" />
      {hasManager
        ? translate('auto.components.managerAgent.openManager', 'Open manager')
        : translate('auto.components.managerAgent.addManagerMenu', 'Add manager')}
    </DropdownMenuItem>
  )
}

/** "Add manager" / "Open manager" in a project header's actions menu. */
export function ManagerProjectMenuItem({ repoId }: { repoId: string }): React.JSX.Element | null {
  const enabled = useManagerEnabled()
  const scopeKey = useProjectScopeKeyForRepo(repoId)
  return enabled && scopeKey ? <ManagerScopeMenuItem scopeKey={scopeKey} /> : null
}

/** "Add manager" / "Open manager" in a workspace row's context menu. */
export function ManagerWorktreeMenuItem({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  const enabled = useManagerEnabled()
  return enabled ? <ManagerScopeMenuItem scopeKey={workspaceManagerScopeKey(worktreeId)} /> : null
}
