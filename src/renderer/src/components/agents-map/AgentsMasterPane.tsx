import React, { useLayoutEffect, useEffect, useState } from 'react'
import { Crown } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { AgentStateDot } from '@/components/AgentStateDot'
import { focusTerminalTabSurface } from '@/components/terminal-pane/input/focus/focus-terminal-tab-surface'
import { setActivityTerminalPortals } from '../activity/activity-terminal-portal'
import type { DashboardCardDisplayState } from '../../../../shared/dashboard-snapshot'
import type { MasterAgent } from './use-master-agent'

type Props = {
  master: MasterAgent
  state: DashboardCardDisplayState | null
}

export function AgentsMasterPane({ master, state }: Props): React.JSX.Element {
  const t = useTranslate()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const { worktreeId, tabId } = master
  const running = worktreeId !== null && tabId !== null

  // Why: the workbench keeps the master's pane mounted; the portal only relocates it into this slot.
  useLayoutEffect(() => {
    if (!running || !target) {
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
  }, [running, target, worktreeId, tabId])

  useEffect(() => () => setActivityTerminalPortals([]), [])

  // Why: the master is the page's primary input, so a fresh or restarted terminal takes focus.
  useEffect(() => {
    if (tabId && target) {
      focusTerminalTabSurface(tabId)
    }
  }, [tabId, target])

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
        <Crown className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="text-xs font-medium">
          {t('auto.components.agents.map.AgentsMapPage.master', 'Master')}
        </span>
        {state ? <AgentStateDot state={state} /> : null}
        {master.cwd ? (
          <span className="min-w-0 flex-1 truncate font-mono text-2xs text-muted-foreground">
            {master.cwd}
          </span>
        ) : (
          <div className="flex-1" />
        )}
      </header>
      {running ? (
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
