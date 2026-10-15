import { describe, expect, it } from 'vitest'
import {
  hydrateManagerAgentRecords,
  isManagerScopeKey,
  parseManagerScopeKey,
  projectManagerScopeKey,
  structuredSessionIdFromTabId,
  workspaceManagerScopeKey
} from './manager-agent-records'
import { structuredAgentSessionTabId } from './structured-agent-session-projection'

const FLOATING = 'global-floating-terminal'

describe('manager scope keys', () => {
  it('round-trips global, project and workspace scopes', () => {
    expect(parseManagerScopeKey('global')).toEqual({ kind: 'global' })
    expect(parseManagerScopeKey(projectManagerScopeKey('p1'))).toEqual({
      kind: 'project',
      projectId: 'p1'
    })
    // Worktree ids carry `::` and a path; everything after the prefix is the id.
    const worktreeId = 'repo-1::/Users/me/orca/feat'
    expect(parseManagerScopeKey(workspaceManagerScopeKey(worktreeId))).toEqual({
      kind: 'workspace',
      worktreeId
    })
  })

  it('rejects empty ids and unknown kinds', () => {
    for (const key of ['project:', 'workspace:', 'repo:r1', '', null, 3]) {
      expect(isManagerScopeKey(key)).toBe(false)
    }
  })

  it('reads the session id back out of a structured tab id only', () => {
    expect(structuredSessionIdFromTabId(structuredAgentSessionTabId('s1'))).toBe('s1')
    expect(structuredSessionIdFromTabId('term-1')).toBeNull()
  })
})

describe('hydrateManagerAgentRecords', () => {
  it('migrates the v1 floating Manager into the global record', () => {
    const records = hydrateManagerAgentRecords(
      undefined,
      structuredAgentSessionTabId('s1'),
      FLOATING
    )
    expect(records).toEqual({
      global: {
        scopeKey: 'global',
        tabId: structuredAgentSessionTabId('s1'),
        sessionId: 's1',
        agent: null,
        hostWorktreeId: FLOATING,
        briefVersion: 0,
        createdAt: 0
      }
    })
  })

  it('migrates a v1 terminal Manager without a session id', () => {
    expect(hydrateManagerAgentRecords({}, 'term-1', FLOATING).global).toMatchObject({
      tabId: 'term-1',
      hostWorktreeId: FLOATING
    })
    expect(hydrateManagerAgentRecords({}, 'term-1', FLOATING).global).not.toHaveProperty(
      'sessionId'
    )
  })

  it('keeps an existing global record over the v1 id', () => {
    const global = {
      scopeKey: 'global',
      tabId: 'structured-agent-session-new',
      sessionId: 'new',
      agent: 'claude',
      hostWorktreeId: FLOATING,
      briefVersion: 2,
      createdAt: 5
    }
    expect(
      hydrateManagerAgentRecords({ global }, 'structured-agent-session-old', FLOATING)
    ).toEqual({ global })
  })

  it('drops malformed records and records filed under the wrong key', () => {
    const project = {
      scopeKey: 'project:p1',
      tabId: 't',
      agent: 'not-an-agent',
      hostWorktreeId: 'w1',
      parentScopeKey: 'project:p1'
    }
    const records = hydrateManagerAgentRecords(
      {
        'project:p1': project,
        'project:p2': { ...project },
        'workspace:w1': { scopeKey: 'workspace:w1', tabId: '', hostWorktreeId: 'w1' },
        bogus: { scopeKey: 'bogus', tabId: 't', hostWorktreeId: 'w1' }
      },
      null,
      FLOATING
    )
    expect(Object.keys(records)).toEqual(['project:p1'])
    // Unknown agents and a self-parent are cleared rather than trusted.
    expect(records['project:p1']).toEqual({
      scopeKey: 'project:p1',
      tabId: 't',
      agent: null,
      hostWorktreeId: 'w1',
      briefVersion: 0,
      createdAt: 0
    })
  })

  it('returns no records when nothing was ever saved', () => {
    expect(hydrateManagerAgentRecords(undefined, undefined, FLOATING)).toEqual({})
  })
})
