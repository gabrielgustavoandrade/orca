import { useEffect, useMemo } from 'react'
import { BriefcaseBusiness } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import {
  structuredAgentSessionOwnerForTab,
  structuredAgentSessionTargetForHost
} from '@/runtime/structured-agent-session-owner'
import NativeChatView from '../native-chat/NativeChatView'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { isStructuredTab } from '../../../../shared/structured-agent-session-tab'
import { findManagerAgentTab } from './manager-agent-tab-resolution'
import { setManagerPageTabId, useManagerPageTabId } from './manager-agent-page-tab'

function ManagerChat({ tabId }: { tabId: string }): React.JSX.Element {
  const tab = useAppStore((state) =>
    findManagerAgentTab(state.unifiedTabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? [], tabId)
  )
  const owner = useAppStore((state) => (tab ? structuredAgentSessionOwnerForTab(state, tab) : null))
  const target = useMemo(() => structuredAgentSessionTargetForHost(owner), [owner])
  if (!tab) {
    return (
      <ManagerPageNotice
        text={translate('auto.components.managerAgent.pageStarting', 'Starting the Manager…')}
      />
    )
  }
  if (!isStructuredTab(tab) || !tab.agentSessionAgent || !target) {
    // Why: a terminal-fallback Manager has a PTY owned by the floating workspace; hosting it here needs the Activity-style portal.
    return (
      <ManagerPageNotice
        text={translate(
          'auto.components.managerAgent.pageTerminalOnly',
          'This Manager runs as a terminal. Open it from the floating workspace.'
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
      isFocusedGroup
      target={target}
    />
  )
}

function ManagerPageNotice({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
      {text}
    </div>
  )
}

/** Full-page Manager view: hosts the Manager's structured chat outside any tab group. */
export default function ManagerPage(): React.JSX.Element | null {
  const enabled = useAppStore((state) => state.settings?.experimentalManagerAgent === true)
  const settingsLoaded = useAppStore((state) => state.settings !== null)
  const setActiveView = useAppStore((state) => state.setActiveView)
  const tabId = useManagerPageTabId()

  useEffect(() => {
    if (settingsLoaded && !enabled) {
      setActiveView('terminal')
    }
  }, [enabled, setActiveView, settingsLoaded])

  useEffect(() => {
    if (tabId !== null) {
      return
    }
    // Why: a restart restores activeView 'manager' before anything has opened the Manager.
    let cancelled = false
    void window.api.ui.get().then(({ managerAgentTabId }) => {
      if (!cancelled && managerAgentTabId) {
        setManagerPageTabId(managerAgentTabId)
      }
    })
    return () => {
      cancelled = true
    }
  }, [tabId])

  if (!enabled) {
    return null
  }
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-[36px] shrink-0 items-center gap-2 border-b border-border px-4 text-sm font-medium">
        <BriefcaseBusiness className="size-4 text-muted-foreground" strokeWidth={1.75} />
        {translate('auto.components.managerAgent.sidebarLabel', 'Manager')}
      </header>
      <div className="flex min-h-0 flex-1">
        {tabId ? (
          <ManagerChat tabId={tabId} />
        ) : (
          <ManagerPageNotice
            text={translate('auto.components.managerAgent.pageStarting', 'Starting the Manager…')}
          />
        )}
      </div>
    </div>
  )
}
