import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { BriefcaseBusiness, CornerLeftUp } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  structuredAgentSessionOwnerForTab,
  structuredAgentSessionTargetForHost
} from '@/runtime/structured-agent-session-owner'
import { isFloatingWorkspacePanelFocused } from '@/lib/floating-workspace-terminal-actions'
import NativeChatView from '../native-chat/NativeChatView'
import { isStructuredTab } from '../../../../shared/structured-agent-session-tab'
import {
  parseManagerScopeKey,
  projectManagerScopeKey,
  type ManagerAgentRecord,
  type ManagerScopeKey
} from '../../../../shared/manager-agent-records'
import {
  resolveManagerAgentSurface,
  type ManagerAgentSurface
} from '../../../../shared/agent-oversight-experimental-settings'
import {
  findManagerRecordTab,
  openManagerScope,
  startNewManagerForScope
} from './open-manager-agent'
import { ManagerTerminalSurface } from './ManagerTerminalSurface'
import { useManagerScopeLaunching } from './manager-agent-launch-state'
import { ManagerScopeSwitcher } from './ManagerScopeSwitcher'
import { ManagerOverviewPanel } from './ManagerOverviewPanel'
import { managerDisplayName, managerScopeLabel } from './manager-scope-labels'
import { projectIdForManagerWorktree } from './manager-agent-scope'

function subscribeFocus(onChange: () => void): () => void {
  document.addEventListener('focusin', onChange)
  document.addEventListener('focusout', onChange)
  return () => {
    document.removeEventListener('focusin', onChange)
    document.removeEventListener('focusout', onChange)
  }
}

/** Whether keyboard focus is inside the floating workspace panel, which can sit over this page. */
function useFloatingPanelFocused(): boolean {
  return useSyncExternalStore(
    subscribeFocus,
    () => isFloatingWorkspacePanelFocused(),
    () => false
  )
}

function ManagerPageNotice({
  text,
  action
}: {
  text: string
  action?: { label: string; run: () => void }
}): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-sm text-muted-foreground">
      <span>{text}</span>
      {action ? (
        <Button variant="outline" size="sm" onClick={action.run}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}

function ManagerSurface({ record }: { record: ManagerAgentRecord }): React.JSX.Element {
  const tab = useAppStore((state) => findManagerRecordTab(state.unifiedTabsByWorktree, record))
  const owner = useAppStore((state) => (tab ? structuredAgentSessionOwnerForTab(state, tab) : null))
  const target = useMemo(() => structuredAgentSessionTargetForHost(owner), [owner])
  const floatingPanelFocused = useFloatingPanelFocused()
  if (!tab) {
    return (
      <ManagerPageNotice
        text={translate('auto.components.managerAgent.pageStarting', 'Starting the Manager…')}
      />
    )
  }
  if (tab.contentType === 'terminal') {
    return <ManagerTerminalSurface record={record} tab={tab} />
  }
  if (!isStructuredTab(tab) || !tab.agentSessionAgent) {
    return (
      <ManagerPageNotice
        text={translate('auto.components.managerAgent.pageStarting', 'Starting the Manager…')}
      />
    )
  }
  if (!target) {
    return (
      <ManagerPageNotice
        text={translate(
          'auto.components.managerAgent.pageUnsupportedHost',
          'This Manager’s workspace host cannot show chats here yet.'
        )}
      />
    )
  }
  return (
    // Why no groupId: the page is not a tab group, so split shortcuts and layout menu items stay off.
    <NativeChatView
      mode="structured"
      tabId={tab.id}
      sessionId={tab.entityId}
      agent={tab.agentSessionAgent}
      isVisible
      // Why: the floating panel can take focus over this page; its chat then owns find and font chords.
      isFocusedGroup={!floatingPanelFocused}
      target={target}
    />
  )
}

function surfaceLabel(surface: ManagerAgentSurface): string {
  return surface === 'chat'
    ? translate('auto.components.managerAgent.surfaceChat', 'Chat UI')
    : translate('auto.components.managerAgent.surfaceTerminal', 'Terminal')
}

/** Shown when the setting changed after this Manager started; a running Manager is not converted. */
function SurfaceMismatchNotice({
  scopeKey,
  recordSurface
}: {
  scopeKey: ManagerScopeKey
  recordSurface: ManagerAgentSurface
}): React.JSX.Element | null {
  const surface = useAppStore((state) => resolveManagerAgentSurface(state.settings))
  if (surface === recordSurface) {
    return null
  }
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
      <span className="min-w-0 flex-1">
        {translate(
          'auto.components.managerAgent.surfaceMismatch',
          'This Manager runs in {{value0}}. New Managers open in {{value1}}. Starting one leaves this one open in its workspace.',
          { value0: surfaceLabel(recordSurface), value1: surfaceLabel(surface) }
        )}
      </span>
      <Button
        variant="outline"
        size="xs"
        onClick={() => void startNewManagerForScope(scopeKey, 'unknown')}
      >
        {surface === 'chat'
          ? translate('auto.components.managerAgent.startChatManager', 'Start a new Chat UI Manager')
          : translate(
              'auto.components.managerAgent.startTerminalManager',
              'Start a new Terminal Manager'
            )}
      </Button>
    </div>
  )
}

function ManagerSurfaceToggle(): React.JSX.Element {
  const surface = useAppStore((state) => resolveManagerAgentSurface(state.settings))
  const updateSettings = useAppStore((state) => state.updateSettings)
  return (
    <ToggleGroup
      type="single"
      size="xs"
      variant="outline"
      value={surface}
      onValueChange={(next) => {
        // Why: pressing the selected item again would clear it; one surface is always picked.
        if (next === 'terminal' || next === 'chat') {
          void updateSettings({ managerAgentSurface: next })
        }
      }}
      aria-label={translate('auto.components.managerAgent.surfaceToggle', 'New Managers open in')}
      title={translate('auto.components.managerAgent.surfaceToggle', 'New Managers open in')}
    >
      <ToggleGroupItem value="terminal">{surfaceLabel('terminal')}</ToggleGroupItem>
      <ToggleGroupItem value="chat">{surfaceLabel('chat')}</ToggleGroupItem>
    </ToggleGroup>
  )
}

function ManagerScopeBody({ scopeKey }: { scopeKey: ManagerScopeKey }): React.JSX.Element {
  const record = useAppStore((state) => state.managerAgents[scopeKey])
  const alive = useAppStore(
    (state) => findManagerRecordTab(state.unifiedTabsByWorktree, record) !== null
  )
  const launching = useManagerScopeLaunching(scopeKey)
  if (launching) {
    return (
      <ManagerPageNotice
        text={translate('auto.components.managerAgent.pageStarting', 'Starting the Manager…')}
      />
    )
  }
  if (!record || !alive) {
    return (
      <ManagerPageNotice
        text={
          record
            ? translate('auto.components.managerAgent.pageClosed', 'This Manager was closed.')
            : translate('auto.components.managerAgent.pageNone', 'No Manager here yet.')
        }
        action={{
          label: record
            ? translate('auto.components.managerAgent.restart', 'Start a new Manager')
            : translate('auto.components.managerAgent.start', 'Start Manager'),
          run: () => void openManagerScope(scopeKey, 'unknown')
        }}
      />
    )
  }
  return (
    <>
      <SurfaceMismatchNotice scopeKey={scopeKey} recordSurface={record.surface} />
      <ManagerSurface record={record} />
    </>
  )
}

function ReportsToChip({ scopeKey }: { scopeKey: ManagerScopeKey }): React.JSX.Element | null {
  const parentKey = useAppStore((state) => {
    const recorded = state.managerAgents[scopeKey]?.parentScopeKey
    if (recorded) {
      return recorded
    }
    // Why: before its first launch a workspace still shows the parent it would report to.
    const scope = parseManagerScopeKey(scopeKey)
    if (scope?.kind === 'project') {
      return 'global'
    }
    if (scope?.kind === 'workspace') {
      const projectId = projectIdForManagerWorktree(state, scope.worktreeId)
      const projectKey = projectId ? projectManagerScopeKey(projectId) : null
      return projectKey && state.managerAgents[projectKey] ? projectKey : 'global'
    }
    return null
  })
  const parentName = useAppStore((state) => (parentKey ? managerDisplayName(state, parentKey) : ''))
  if (!parentKey) {
    return null
  }
  return (
    <Button
      variant="outline"
      size="xs"
      onClick={() => void openManagerScope(parentKey, 'unknown')}
      title={translate(
        'auto.components.managerAgent.openParent',
        'Open the Manager this one reports to'
      )}
    >
      <CornerLeftUp className="size-3" />
      <span className="text-muted-foreground">
        {translate('auto.components.managerAgent.reportsTo', 'Reports to')}
      </span>
      <span className="max-w-48 truncate">{parentName}</span>
    </Button>
  )
}

function ManagerPageHeader({ scopeKey }: { scopeKey: ManagerScopeKey }): React.JSX.Element {
  const scope = parseManagerScopeKey(scopeKey)
  // Why primitives: an object built in a selector is a new snapshot every read and loops renders.
  const projectId = useAppStore((state) =>
    scope?.kind === 'workspace' ? projectIdForManagerWorktree(state, scope.worktreeId) : null
  )
  const projectKey = projectId ? projectManagerScopeKey(projectId) : null
  const projectLabel = useAppStore((state) =>
    projectKey ? managerScopeLabel(state, projectKey) : ''
  )
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
      <span className="flex items-center gap-2 text-sm font-medium">
        <BriefcaseBusiness className="size-4 text-muted-foreground" strokeWidth={1.75} />
        {translate('auto.components.managerAgent.sidebarLabel', 'Manager')}
      </span>
      <span className="text-muted-foreground">/</span>
      {projectKey ? (
        <>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => void openManagerScope(projectKey, 'unknown')}
          >
            {projectLabel}
          </Button>
          <span className="text-muted-foreground">/</span>
        </>
      ) : null}
      <ManagerScopeSwitcher scopeKey={scopeKey} />
      <div className="ml-auto flex items-center gap-2">
        <ManagerSurfaceToggle />
        <ReportsToChip scopeKey={scopeKey} />
      </div>
    </header>
  )
}

/** Full-page Manager view: one scope's Manager terminal or chat beside a read-only overview of delegated work. */
export default function ManagerPage(): React.JSX.Element | null {
  const enabled = useAppStore((state) => state.settings?.experimentalManagerAgent === true)
  const settingsLoaded = useAppStore((state) => state.settings !== null)
  const setActiveView = useAppStore((state) => state.setActiveView)
  const scopeKey = useAppStore((state) => state.managerScope)

  useEffect(() => {
    if (settingsLoaded && !enabled) {
      setActiveView('terminal')
    }
  }, [enabled, setActiveView, settingsLoaded])

  if (!enabled) {
    return null
  }
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ManagerPageHeader scopeKey={scopeKey} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Why keyed: each scope is its own Manager; a remount drops the previous scope's view state. */}
          <ManagerScopeBody key={scopeKey} scopeKey={scopeKey} />
        </div>
        <ManagerOverviewPanel scopeKey={scopeKey} />
      </div>
    </div>
  )
}
