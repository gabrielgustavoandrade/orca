import React, { useState } from 'react'
import { Crown } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { Button } from '@/components/ui/button'
import { AgentStateDot } from '@/components/AgentStateDot'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { revealDashboardAgent } from '../dashboard/reveal-dashboard-agent'
import { agentTypeToIconAgent } from '../../../../shared/agent-status/presentation/agent-type-icon-agent'
import { AgentsMapDetail } from './AgentsMapDetail'
import type { MasterRailGroups, NeedsYouItem, RailTreeNode } from './master-rail'
import type { AgentsMapNode } from './agents-map-types'

type SelectProps = {
  selectedId: string | null
  onSelect: (node: AgentsMapNode) => void
}

function SectionTitle({
  icon,
  children
}: {
  icon?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <h3 className="flex items-center gap-1.5 px-2 pb-1 pt-3 text-2xs font-medium text-muted-foreground">
      {icon}
      {children}
    </h3>
  )
}

function Where({ node }: { node: AgentsMapNode }): React.JSX.Element {
  return (
    <span className="shrink-0 font-mono text-2xs font-normal text-muted-foreground">
      {node.projectLabel} {node.workspaceLabel}
    </span>
  )
}

function RailRow({
  node,
  current,
  onSelect,
  showWhere
}: {
  node: AgentsMapNode
  current: boolean
  onSelect: (node: AgentsMapNode) => void
  showWhere?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      data-current={current ? 'true' : undefined}
      onClick={() => onSelect(node)}
      className={cn(
        'flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent',
        current && 'bg-accent'
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
        <AgentStateDot state={node.displayState} />
        <AgentIcon agent={agentTypeToIconAgent(node.agentType)} size={14} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        {showWhere ? <Where node={node} /> : null}
      </span>
      {node.activity ? (
        <span className="truncate pl-5 text-2xs text-muted-foreground">{node.activity}</span>
      ) : null}
    </button>
  )
}

function TreeBranch({
  nodes,
  selectedId,
  onSelect
}: { nodes: RailTreeNode[] } & SelectProps): React.JSX.Element {
  return (
    <ul className="ml-3 border-l border-[color-mix(in_srgb,var(--foreground)_24%,var(--background))] pl-1">
      {nodes.map(({ item, children }) => (
        <li key={item.node.id}>
          <RailRow node={item.node} current={item.node.id === selectedId} onSelect={onSelect} />
          {item.node.subagents.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center gap-1.5 truncate py-0.5 pl-7 text-2xs text-muted-foreground"
            >
              <AgentStateDot state={sub.dotState} />
              <span className="min-w-0 truncate">{sub.name}</span>
            </div>
          ))}
          {children.length > 0 ? (
            <TreeBranch nodes={children} selectedId={selectedId} onSelect={onSelect} />
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function NeedsYouCard({ entry }: { entry: NeedsYouItem }): React.JSX.Element {
  const t = useTranslate()
  const [unavailable, setUnavailable] = useState(false)
  const { node } = entry.item
  return (
    <div className="space-y-1 rounded-md border border-agent-question/40 bg-[color-mix(in_srgb,var(--agent-question)_5%,var(--background))] p-2">
      <div className="truncate text-xs font-medium">{node.name}</div>
      <p className="break-words text-xs">{node.activity}</p>
      <div className="flex items-center gap-1.5">
        {entry.startedByMaster ? (
          <Crown className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
        <span className="min-w-0 flex-1 truncate font-mono text-2xs text-muted-foreground">
          {node.projectLabel} {node.workspaceLabel}
        </span>
        <Button
          size="xs"
          variant="outline"
          onClick={() => setUnavailable(!revealDashboardAgent(node.reveal))}
        >
          {t('auto.components.agents.map.AgentsMapPage.openTerminal', 'Open terminal')}
        </Button>
      </div>
      {unavailable ? (
        <p className="text-2xs text-muted-foreground">
          {t(
            'auto.components.agents.map.AgentsMapPage.terminalUnavailable',
            'Terminal is no longer available'
          )}
        </p>
      ) : null}
    </div>
  )
}

export function MasterRail({
  groups,
  selected,
  onSelect,
  onClose
}: {
  groups: MasterRailGroups
  selected: AgentsMapNode | null
  onSelect: (node: AgentsMapNode) => void
  onClose: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const selectedId = selected?.id ?? null
  const empty =
    groups.needsYou.length === 0 && groups.started.length === 0 && groups.other.length === 0
  return (
    <aside className="flex w-[368px] shrink-0 flex-col border-l border-border">
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 scrollbar-sleek">
        {empty ? (
          <p className="p-2 pt-3 text-xs text-muted-foreground">
            {t(
              'auto.components.agents.map.AgentsMapPage.railEmpty',
              'No other agents yet. Ask the master to start one.'
            )}
          </p>
        ) : null}
        {groups.needsYou.length > 0 ? (
          <section>
            <SectionTitle>
              {t('auto.components.agents.map.AgentsMapPage.needsYou', 'Needs you')}
            </SectionTitle>
            <div className="space-y-1.5">
              {groups.needsYou.map((entry) => (
                <NeedsYouCard key={entry.item.node.id} entry={entry} />
              ))}
            </div>
          </section>
        ) : null}
        {groups.started.length > 0 ? (
          <section>
            <SectionTitle icon={<Crown className="size-3" aria-hidden />}>
              {t('auto.components.agents.map.AgentsMapPage.startedByMaster', 'Started by Master')}
            </SectionTitle>
            <TreeBranch nodes={groups.started} selectedId={selectedId} onSelect={onSelect} />
          </section>
        ) : null}
        {groups.other.length > 0 ? (
          <section>
            <SectionTitle>
              {t('auto.components.agents.map.AgentsMapPage.otherAgents', 'Other agents')}
            </SectionTitle>
            {groups.other.map((item) => (
              <RailRow
                key={item.node.id}
                node={item.node}
                current={item.node.id === selectedId}
                onSelect={onSelect}
                showWhere
              />
            ))}
          </section>
        ) : null}
      </div>
      {selected ? <AgentsMapDetail key={selected.id} node={selected} onClose={onClose} /> : null}
    </aside>
  )
}
