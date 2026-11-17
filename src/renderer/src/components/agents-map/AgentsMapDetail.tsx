import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AgentStateDot, agentStateLabel } from '@/components/AgentStateDot'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { revealDashboardAgent } from '../dashboard/reveal-dashboard-agent'
import { agentTypeToIconAgent } from '../../../../shared/agent-status/presentation/agent-type-icon-agent'
import type { AgentsMapNode } from './agents-map-types'

function DetailRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="space-y-0.5">
      <div className="text-2xs text-muted-foreground">{label}</div>
      <div className="whitespace-pre-wrap break-words text-xs">{value}</div>
    </div>
  )
}

export function AgentsMapDetail({
  node,
  onClose
}: {
  node: AgentsMapNode
  onClose: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const [unavailable, setUnavailable] = useState(false)
  return (
    <div className="max-h-[55%] shrink-0 overflow-y-auto border-t border-border p-3 scrollbar-sleek">
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <AgentIcon agent={agentTypeToIconAgent(node.agentType)} size={16} />
              <span className="min-w-0 flex-1 break-words">{node.name}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t('auto.components.agents.map.AgentsMapPage.closeDetail', 'Close')}
                onClick={onClose}
              >
                <X className="size-3.5" />
              </Button>
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
    </div>
  )
}
