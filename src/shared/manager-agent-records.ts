import type { TuiAgent } from './tui-agent'
import { isTuiAgent } from './tui-agent-config'
import { structuredAgentSessionTabId } from './structured-agent-session-projection'

/** Which slice of the user's work a Manager owns: everything, one project, or one workspace. */
export type ManagerScopeKey = 'global' | `project:${string}` | `workspace:${string}`

export type ManagerScope =
  | { kind: 'global' }
  | { kind: 'project'; projectId: string }
  | { kind: 'workspace'; worktreeId: string }

export type ManagerAgentRecord = {
  scopeKey: ManagerScopeKey
  /** Unified tab id of the Manager's chat in its host worktree. */
  tabId: string
  /** Structured session id; absent for a terminal-fallback Manager. */
  sessionId?: string
  /** Null only for a record migrated from v1, which never stored its agent. */
  agent: TuiAgent | null
  hostWorktreeId: string
  parentScopeKey?: ManagerScopeKey
  briefVersion: number
  createdAt: number
}

export type ManagerAgentRecords = Record<string, ManagerAgentRecord>

export const GLOBAL_MANAGER_SCOPE_KEY: ManagerScopeKey = 'global'

export function projectManagerScopeKey(projectId: string): ManagerScopeKey {
  return `project:${projectId}`
}

export function workspaceManagerScopeKey(worktreeId: string): ManagerScopeKey {
  return `workspace:${worktreeId}`
}

export function parseManagerScopeKey(key: unknown): ManagerScope | null {
  if (key === 'global') {
    return { kind: 'global' }
  }
  if (typeof key !== 'string') {
    return null
  }
  if (key.startsWith('project:') && key.length > 'project:'.length) {
    return { kind: 'project', projectId: key.slice('project:'.length) }
  }
  if (key.startsWith('workspace:') && key.length > 'workspace:'.length) {
    return { kind: 'workspace', worktreeId: key.slice('workspace:'.length) }
  }
  return null
}

export function isManagerScopeKey(key: unknown): key is ManagerScopeKey {
  return parseManagerScopeKey(key) !== null
}

const STRUCTURED_TAB_ID_PREFIX = structuredAgentSessionTabId('')

/** The session behind a structured tab id; null for a terminal tab id. */
export function structuredSessionIdFromTabId(tabId: string): string | null {
  return tabId.startsWith(STRUCTURED_TAB_ID_PREFIX) &&
    tabId.length > STRUCTURED_TAB_ID_PREFIX.length
    ? tabId.slice(STRUCTURED_TAB_ID_PREFIX.length)
    : null
}

function sanitizeManagerAgentRecord(key: string, value: unknown): ManagerAgentRecord | null {
  if (!value || typeof value !== 'object' || !isManagerScopeKey(key)) {
    return null
  }
  const raw: Record<string, unknown> = Object.fromEntries(Object.entries(value))
  if (
    raw.scopeKey !== key ||
    typeof raw.tabId !== 'string' ||
    raw.tabId.length === 0 ||
    typeof raw.hostWorktreeId !== 'string' ||
    raw.hostWorktreeId.length === 0
  ) {
    return null
  }
  return {
    scopeKey: key,
    tabId: raw.tabId,
    ...(typeof raw.sessionId === 'string' && raw.sessionId ? { sessionId: raw.sessionId } : {}),
    agent: isTuiAgent(raw.agent) ? raw.agent : null,
    hostWorktreeId: raw.hostWorktreeId,
    ...(isManagerScopeKey(raw.parentScopeKey) && raw.parentScopeKey !== key
      ? { parentScopeKey: raw.parentScopeKey }
      : {}),
    briefVersion: typeof raw.briefVersion === 'number' ? raw.briefVersion : 0,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0
  }
}

/**
 * Hydrated Manager records, plus the v1 floating Manager (`managerAgentTabId`) as the global
 * record when no global record exists yet.
 */
export function hydrateManagerAgentRecords(
  rawRecords: unknown,
  legacyGlobalTabId: unknown,
  floatingWorktreeId: string
): ManagerAgentRecords {
  const records: ManagerAgentRecords = {}
  if (rawRecords && typeof rawRecords === 'object') {
    for (const [key, value] of Object.entries(rawRecords)) {
      const record = sanitizeManagerAgentRecord(key, value)
      if (record) {
        records[key] = record
      }
    }
  }
  if (!records.global && typeof legacyGlobalTabId === 'string' && legacyGlobalTabId) {
    const sessionId = structuredSessionIdFromTabId(legacyGlobalTabId)
    records.global = {
      scopeKey: 'global',
      tabId: legacyGlobalTabId,
      ...(sessionId ? { sessionId } : {}),
      agent: null,
      hostWorktreeId: floatingWorktreeId,
      // Why 0: v1 briefs predate scope briefs, so the record reads as outdated.
      briefVersion: 0,
      createdAt: 0
    }
  }
  return records
}
