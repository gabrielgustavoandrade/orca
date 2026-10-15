import { BriefcaseBusiness } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { openManagerAgent } from './open-manager-agent'

export default function ManagerAgentSidebarEntry(): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => void openManagerAgent('sidebar')}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight text-worktree-sidebar-foreground/60 transition-colors hover:bg-worktree-sidebar-foreground/8"
    >
      <BriefcaseBusiness
        className="size-4 shrink-0 text-worktree-sidebar-foreground/30"
        strokeWidth={1.75}
      />
      <span className="flex-1">
        {translate('auto.components.managerAgent.sidebarLabel', 'Manager')}
      </span>
    </button>
  )
}
