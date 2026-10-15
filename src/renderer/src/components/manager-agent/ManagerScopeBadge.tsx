import { BriefcaseBusiness } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { ManagerScopeKey } from '../../../../shared/manager-agent-records'
import { useManagerScopeCounts } from './use-manager-scope-counts'

/**
 * Briefcase badge for a scope that has a Manager: filled while that Manager's page is open, with
 * an orange dot when its delegated work is waiting on the user. Renders nothing without a Manager.
 */
export function ManagerScopeBadge({
  scopeKey,
  className
}: {
  scopeKey: ManagerScopeKey
  className?: string
}): React.JSX.Element | null {
  const hasManager = useAppStore((state) => Boolean(state.managerAgents[scopeKey]))
  const open = useAppStore(
    (state) => state.activeView === 'manager' && state.managerScope === scopeKey
  )
  const { needsYou } = useManagerScopeCounts(scopeKey, hasManager)
  if (!hasManager) {
    return null
  }
  const label =
    needsYou > 0
      ? translate('auto.components.managerAgent.badgeNeedsYou', 'Has a Manager that needs you')
      : translate('auto.components.managerAgent.badge', 'Has a Manager')
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-open={open ? 'true' : undefined}
      className={cn(
        'inline-flex h-4.5 shrink-0 items-center gap-1 rounded-md border px-1',
        open
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-background text-muted-foreground',
        className
      )}
    >
      <BriefcaseBusiness className="size-3" strokeWidth={1.75} />
      {needsYou > 0 ? <span className="size-1.5 rounded-full bg-agent-question" /> : null}
    </span>
  )
}
