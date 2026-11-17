import React, { useEffect, useMemo, useState } from 'react'
import { Crown } from 'lucide-react'
import { useAppStore } from '@/store'
import { focusTerminalTabSurface } from '@/components/terminal-pane/input/focus/focus-terminal-tab-surface'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AgentStateDot, agentStateLabel } from '@/components/AgentStateDot'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { useLiveDashboardSnapshot } from '../dashboard/useLiveDashboardSnapshot'
import { revealDashboardAgent } from '../dashboard/reveal-dashboard-agent'
import {
  AGENTS_MAP_NODE_HEIGHT,
  AGENTS_MAP_NODE_WIDTH,
  buildAgentsMap,
  type AgentsMapLayout,
  type AgentsMapNode
} from './agents-map-layout'
import { AgentsMasterPane } from './AgentsMasterPane'
import { useMasterAgent } from './use-master-agent'
import { agentTypeToIconAgent } from '../../../../shared/agent-status/presentation/agent-type-icon-agent'

const WRAP_WIDTH = 1200

function DetailRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="space-y-0.5">
      <div className="text-2xs text-muted-foreground">{label}</div>
      <div className="whitespace-pre-wrap break-words text-xs">{value}</div>
    </div>
  )
}

function AgentsMapDetail({ node }: { node: AgentsMapNode }): React.JSX.Element {
  const t = useTranslate()
  const [unavailable, setUnavailable] = useState(false)
  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-l border-border p-3 scrollbar-sleek">
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <AgentIcon agent={agentTypeToIconAgent(node.agentType)} size={16} />
              <span className="min-w-0 break-words">{node.name}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <DetailRow
              label={t('auto.components.agents.map.AgentsMapPage.project', 'Project')}
              value={node.projectLabel}
            />
            <DetailRow
              label={t('auto.components.agents.map.AgentsMapPage.workspace', 'Workspace')}
              value={node.workspaceLabel}
            />
            <DetailRow
              label={t('auto.components.agents.map.AgentsMapPage.host', 'Host')}
              value={node.hostLabel ?? t('auto.components.agents.map.AgentsMapPage.local', 'Local')}
            />
            <div className="space-y-0.5">
              <div className="text-2xs text-muted-foreground">
                {t('auto.components.agents.map.AgentsMapPage.state', 'State')}
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <AgentStateDot state={node.displayState} />
                {agentStateLabel(node.displayState)}
              </div>
            </div>
            {node.activity ? (
              <DetailRow
                label={t('auto.components.agents.map.AgentsMapPage.activity', 'Activity')}
                value={node.activity}
              />
            ) : null}
            {node.lastAgentMessage ? (
              <DetailRow
                label={t(
                  'auto.components.agents.map.AgentsMapPage.lastMessage',
                  'Last agent message'
                )}
                value={node.lastAgentMessage}
              />
            ) : null}
            {node.subagents.length > 0 ? (
              <div className="space-y-1">
                <div className="text-2xs text-muted-foreground">
                  {t('auto.components.agents.map.AgentsMapPage.subagents', 'Subagents')}
                </div>
                {node.subagents.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-1.5 text-xs">
                    <AgentStateDot state={sub.dotState} />
                    <span className="min-w-0 truncate">{sub.name}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <Button
              size="sm"
              onClick={() => setUnavailable(!revealDashboardAgent(node.reveal))}
              className="w-full"
            >
              {t('auto.components.agents.map.AgentsMapPage.openTerminal', 'Open terminal')}
            </Button>
            {unavailable ? (
              <p className="text-2xs text-muted-foreground">
                {t(
                  'auto.components.agents.map.AgentsMapPage.terminalUnavailable',
                  'Terminal is no longer available'
                )}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </aside>
  )
}

function AgentsMapBody(): React.JSX.Element {
  const t = useTranslate()
  const snapshot = useLiveDashboardSnapshot()
  const liveEntries = useAppStore((s) => s.agentStatusByPaneKey)
  const retained = useAppStore((s) => s.retainedAgentsByPaneKey)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [masterCollapsed, setMasterCollapsed] = useState(false)
  const master = useMasterAgent()
  const map = useMemo(
    () =>
      buildAgentsMap({
        snapshot,
        liveEntries,
        retainedPaneKeys: new Set(Object.keys(retained)),
        masterWorktreeId: master.worktreeId,
        wrapWidth: WRAP_WIDTH
      }),
    [snapshot, liveEntries, retained, master.worktreeId]
  )
  const selected = map.nodes.find((node) => node.id === selectedId) ?? null
  const masterNode = map.nodes.find((node) => node.isMaster) ?? null

  const selectNode = (node: AgentsMapNode): void => {
    setSelectedId(node.id)
    if (node.isMaster && master.tabId) {
      setMasterCollapsed(false)
      focusTerminalTabSurface(master.tabId)
    }
  }

  return (
    <>
      {map.nodes.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
          {t('auto.components.agents.map.AgentsMapPage.empty', 'No live agents')}
        </div>
      ) : (
        <AgentsMapGraph
          map={map}
          selected={selected}
          selectedId={selectedId}
          onSelect={selectNode}
        />
      )}
      <AgentsMasterPane
        master={master}
        state={masterNode?.displayState ?? null}
        collapsed={masterCollapsed}
        onToggleCollapsed={() => setMasterCollapsed((value) => !value)}
      />
    </>
  )
}

function AgentsMapGraph({
  map,
  selected,
  selectedId,
  onSelect
}: {
  map: AgentsMapLayout
  selected: AgentsMapNode | null
  selectedId: string | null
  onSelect: (node: AgentsMapNode) => void
}): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1 overflow-auto p-4 scrollbar-sleek">
        <div className="relative" style={{ width: map.width, height: map.height }}>
          {map.groups.map((group) => (
            <div
              key={group.id}
              className={cn(
                'absolute rounded-lg border border-border px-3 py-1.5 text-2xs text-muted-foreground',
                group.kind !== 'workspace' && 'font-semibold'
              )}
              style={{ left: group.x, top: group.y, width: group.width, height: group.height }}
            >
              {group.kind === 'master' ? (
                <Crown className="mr-1 inline size-3 align-[-2px]" aria-hidden />
              ) : null}
              {group.label}
            </div>
          ))}
          <svg
            aria-hidden
            className="pointer-events-none absolute left-0 top-0"
            width={map.width}
            height={map.height}
          >
            {map.edges.map((edge) => (
              <path
                key={edge.id}
                d={edge.path}
                fill="none"
                stroke="var(--border)"
                strokeWidth={1.5}
                strokeDasharray={edge.crossWorkspace ? '4 3' : undefined}
              />
            ))}
          </svg>
          {map.nodes.map((node) => {
            const current = node.id === selectedId
            return (
              <button
                key={node.id}
                type="button"
                data-current={current ? 'true' : undefined}
                onClick={() => onSelect(node)}
                className={cn(
                  'absolute flex flex-col justify-center gap-0.5 rounded-md border border-border bg-card px-2.5 text-left transition-colors hover:bg-accent',
                  current && 'bg-accent ring-1 ring-ring'
                )}
                style={{
                  left: node.x,
                  top: node.y,
                  width: AGENTS_MAP_NODE_WIDTH,
                  height: AGENTS_MAP_NODE_HEIGHT
                }}
              >
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
                  <AgentIcon
                    agent={agentTypeToIconAgent(node.agentType)}
                    size={14}
                    className="shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate">{node.name}</span>
                  {node.isMaster ? (
                    <Crown className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                  ) : null}
                  <AgentStateDot state={node.displayState} />
                </span>
                {node.activity ? (
                  <span className="truncate text-2xs text-muted-foreground">{node.activity}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
      {selected ? <AgentsMapDetail key={selected.id} node={selected} /> : null}
    </div>
  )
}

export default function AgentsMapPage(): React.JSX.Element | null {
  const enabled = useAppStore((s) => s.settings?.experimentalAgentsMap === true)
  const closeAgentsMapPage = useAppStore((s) => s.closeAgentsMapPage)
  // Why: a persisted 'agents-map' view can be restored after the flag is turned off.
  useEffect(() => {
    if (!enabled) {
      closeAgentsMapPage()
    }
  }, [enabled, closeAgentsMapPage])
  if (!enabled) {
    return null
  }
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <AgentsMapBody />
    </div>
  )
}
