import React, { useLayoutEffect, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Crown } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { AgentStateDot } from '@/components/AgentStateDot'
import { setActivityTerminalPortals } from '../activity/activity-terminal-portal'
import type { DashboardCardDisplayState } from '../../../../shared/dashboard-snapshot'
import type { MasterAgent } from './use-master-agent'

type Props = {
  master: MasterAgent
  state: DashboardCardDisplayState | null
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function AgentsMasterPane({
  master,
  state,
  collapsed,
  onToggleCollapsed
}: Props): React.JSX.Element {
  const t = useTranslate()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const { worktreeId, tabId } = master
  const running = worktreeId !== null && tabId !== null
  const showTerminal = running && !collapsed

  // Why: the workbench keeps the master's pane mounted; the portal only relocates it into this slot.
  useLayoutEffect(() => {
    if (!showTerminal || !target || worktreeId === null || tabId === null) {
      setActivityTerminalPortals([])
      return
    }
    setActivityTerminalPortals([
      {
        slotId: 'primary',
        requestToken: `agents-map-master:${tabId}`,
        target,
        worktreeId,
        tabId,
        paneKey: null,
        active: true
      }
    ])
  }, [showTerminal, target, worktreeId, tabId])

  useEffect(() => () => setActivityTerminalPortals([]), [])

  return (
    <section
      className={cn(
        'flex shrink-0 flex-col border-t border-border',
        !collapsed && 'h-[45%] min-h-48'
      )}
    >
      <header className="flex h-9 shrink-0 items-center gap-2 px-3">
        <Crown className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="text-xs font-medium">
          {t('auto.components.agents.map.AgentsMapPage.master', 'Master')}
        </span>
        {state ? <AgentStateDot state={state} /> : null}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={
            collapsed
              ? t('auto.components.agents.map.AgentsMapPage.expandMaster', 'Expand master pane')
              : t('auto.components.agents.map.AgentsMapPage.collapseMaster', 'Collapse master pane')
          }
          onClick={onToggleCollapsed}
        >
          {collapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </Button>
      </header>
      {collapsed ? null : running ? (
        <div className="relative min-h-0 flex-1 overflow-hidden bg-editor-surface">
          <div ref={setTarget} className="absolute inset-0 min-h-0 min-w-0" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
          <p>
            {t(
              'auto.components.agents.map.AgentsMapPage.masterHint',
              'A long-lived Claude Code session in its own folder.'
            )}
          </p>
          <Button size="sm" disabled={master.starting} onClick={() => void master.start()}>
            {t('auto.components.agents.map.AgentsMapPage.startMaster', 'Start master')}
          </Button>
        </div>
      )}
    </section>
  )
}
