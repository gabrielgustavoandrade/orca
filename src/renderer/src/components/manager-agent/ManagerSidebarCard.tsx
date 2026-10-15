import { BriefcaseBusiness, ChevronRight } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { GLOBAL_MANAGER_SCOPE_KEY } from '../../../../shared/manager-agent-records'
import { openManagerAgent } from './open-manager-agent'
import { useManagerScopeCounts } from './use-manager-scope-counts'

/** "4 working · 1 needs you", hiding zero counts; "Idle" when nothing is going on. */
export function formatManagerCardCounts(counts: { working: number; needsYou: number }): {
  working: string | null
  needsYou: string | null
  idle: string | null
} {
  const working =
    counts.working > 0
      ? translate('auto.components.managerAgent.countWorking', '{{count}} working', {
          count: counts.working
        })
      : null
  const needsYou =
    counts.needsYou > 0
      ? translate('auto.components.managerAgent.countNeedsYou', '{{count}} need you', {
          count: counts.needsYou
        })
      : null
  return {
    working,
    needsYou,
    idle: working || needsYou ? null : translate('auto.components.managerAgent.idle', 'Idle')
  }
}

/** The all-projects Manager, pinned above Search; opens the Manager page. */
export default function ManagerSidebarCard(): React.JSX.Element {
  const active = useAppStore(
    (state) => state.activeView === 'manager' && state.managerScope === GLOBAL_MANAGER_SCOPE_KEY
  )
  const counts = useManagerScopeCounts(GLOBAL_MANAGER_SCOPE_KEY, true)
  const text = formatManagerCardCounts(counts)
  return (
    <button
      type="button"
      data-manager-sidebar-card=""
      onClick={() => void openManagerAgent('sidebar')}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'mb-1 flex w-full items-center gap-2.5 rounded-lg border bg-worktree-sidebar-foreground/3 px-2 py-2 text-left transition-colors hover:bg-worktree-sidebar-foreground/8',
        active ? 'border-worktree-sidebar-foreground/40' : 'border-worktree-sidebar-border'
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
        <BriefcaseBusiness className="size-4" strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] font-semibold tracking-tight text-worktree-sidebar-foreground">
          {translate('auto.components.managerAgent.sidebarLabel', 'Manager')}
        </span>
        <span className="flex items-center gap-2 text-2xs text-worktree-sidebar-foreground/60">
          {text.working ? (
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-workspace-status-progress" />
              {text.working}
            </span>
          ) : null}
          {text.needsYou ? (
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-agent-question" />
              {text.needsYou}
            </span>
          ) : null}
          {text.idle}
        </span>
      </span>
      <ChevronRight className="size-3.5 shrink-0 text-worktree-sidebar-foreground/40" />
    </button>
  )
}
