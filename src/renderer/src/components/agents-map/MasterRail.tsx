import React from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { AgentStateDot } from '@/components/AgentStateDot'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { agentTypeToIconAgent } from '../../../../shared/agent-status/presentation/agent-type-icon-agent'
import { AgentsMapDetail } from './AgentsMapDetail'
import type { AgentsMapNode } from './agents-map-types'

export function RailRow({
  node,
  current,
  onSelect
}: {
  node: AgentsMapNode
  current: boolean
  onSelect: (node: AgentsMapNode) => void
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
        <span className="shrink-0 font-mono text-2xs font-normal text-muted-foreground">
          {node.projectLabel} {node.workspaceLabel}
        </span>
      </span>
      {node.activity ? (
        <span className="truncate pl-5 text-2xs text-muted-foreground">{node.activity}</span>
      ) : null}
    </button>
  )
}

export function MasterRail({
  nodes,
  selected,
  onSelect,
  onClose
}: {
  nodes: AgentsMapNode[]
  selected: AgentsMapNode | null
  onSelect: (node: AgentsMapNode) => void
  onClose: () => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <aside className="flex w-[368px] shrink-0 flex-col border-l border-border">
      <div className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-sleek">
        {nodes.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">
            {t(
              'auto.components.agents.map.AgentsMapPage.railEmpty',
              'No other agents yet. Ask the master to start one.'
            )}
          </p>
        ) : (
          nodes.map((node) => (
            <RailRow
              key={node.id}
              node={node}
              current={node.id === selected?.id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
      {selected ? <AgentsMapDetail key={selected.id} node={selected} onClose={onClose} /> : null}
    </aside>
  )
}
