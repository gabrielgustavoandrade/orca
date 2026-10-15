import type { AppState } from '@/store/types'
import type { ManagerAgentRecords } from '../../../shared/manager-agent-records'
import { structuredAgentSessionTabId } from '../../../shared/structured-agent-session-projection'

// Why partial: many narrow selector states predate Managers; missing fields hide nothing.
export type ManagerHostedTabState = Partial<Pick<AppState, 'managerAgents' | 'settings'>>

const EMPTY: ReadonlySet<string> = new Set()
let cachedRecords: ManagerAgentRecords | null = null
let cachedTabIds: ReadonlySet<string> = EMPTY

/**
 * Tab ids of Manager chats and terminals. The Manager page is their only surface, so tab strips,
 * chat overlays, palettes and bulk closes skip them; terminal overlays still mount the PTY for the
 * page to portal. With the experiment off nothing is hidden.
 */
export function selectManagerHostedTabIds(state: ManagerHostedTabState): ReadonlySet<string> {
  if (state.settings?.experimentalManagerAgent !== true) {
    return EMPTY
  }
  const records = state.managerAgents ?? null
  if (records === cachedRecords) {
    return cachedTabIds
  }
  const ids = new Set<string>()
  for (const record of Object.values(records ?? {})) {
    ids.add(record.tabId)
    if (record.sessionId) {
      ids.add(structuredAgentSessionTabId(record.sessionId))
    }
  }
  cachedRecords = records
  cachedTabIds = ids.size > 0 ? ids : EMPTY
  return cachedTabIds
}

export function isManagerHostedTab(state: ManagerHostedTabState, tabId: string): boolean {
  return selectManagerHostedTabIds(state).has(tabId)
}
