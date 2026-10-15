import { describe, expect, it } from 'vitest'
import type { Tab } from '../../../../shared/tab-types'
import {
  findAddedManagerAgentTab,
  findManagerAgentTab,
  pickManagerAgent
} from './manager-agent-tab-resolution'

type TabRow = Pick<Tab, 'id' | 'entityId' | 'contentType'>

const chatTab: TabRow = {
  id: 'structured-agent-session-s1',
  entityId: 's1',
  contentType: 'agent-session'
}
const terminalTab: TabRow = { id: 'term-1', entityId: 'term-1', contentType: 'terminal' }
const editorTab: TabRow = { id: '/tmp/notes.md', entityId: '/tmp/notes.md', contentType: 'editor' }

describe('findManagerAgentTab', () => {
  it('finds the persisted chat or terminal tab', () => {
    expect(findManagerAgentTab([editorTab, chatTab], chatTab.id)).toBe(chatTab)
    expect(findManagerAgentTab([terminalTab], 'term-1')).toBe(terminalTab)
  })

  it('matches a terminal by the terminal id its launch reported', () => {
    const unified: TabRow = { id: 'unified-1', entityId: 'term-2', contentType: 'terminal' }
    expect(findManagerAgentTab([unified], 'term-2')).toBe(unified)
  })

  it('returns null when nothing is remembered or the tab is gone', () => {
    expect(findManagerAgentTab([chatTab], null)).toBeNull()
    expect(findManagerAgentTab([chatTab], undefined)).toBeNull()
    expect(findManagerAgentTab([chatTab], 'structured-agent-session-closed')).toBeNull()
  })

  it('never reuses a non-agent tab that happens to share the id', () => {
    expect(findManagerAgentTab([editorTab], editorTab.id)).toBeNull()
  })
})

describe('findAddedManagerAgentTab', () => {
  it('returns the single agent tab the launch added', () => {
    expect(findAddedManagerAgentTab(new Set([editorTab.id]), [editorTab, terminalTab])).toBe(
      terminalTab
    )
  })

  it('refuses to guess when zero or several agent tabs appeared', () => {
    expect(findAddedManagerAgentTab(new Set([terminalTab.id]), [terminalTab])).toBeNull()
    expect(findAddedManagerAgentTab(new Set(), [terminalTab, chatTab])).toBeNull()
  })
})

describe('pickManagerAgent', () => {
  it('uses the default agent when it is installed, enabled and can open as a chat', () => {
    expect(pickManagerAgent({ defaultTuiAgent: 'codex', detected: ['claude', 'codex'] })).toBe(
      'codex'
    )
  })

  it('prefers a chat-capable agent over a default that can only run as a terminal', () => {
    expect(pickManagerAgent({ defaultTuiAgent: 'gemini', detected: ['claude', 'gemini'] })).toBe(
      'claude'
    )
  })

  it('falls back to an installed chat-capable agent', () => {
    expect(pickManagerAgent({ defaultTuiAgent: 'blank', detected: ['gemini', 'codex'] })).toBe(
      'codex'
    )
    expect(pickManagerAgent({ defaultTuiAgent: 'aider', detected: ['gemini', 'codex'] })).toBe(
      'codex'
    )
    expect(
      pickManagerAgent({
        defaultTuiAgent: 'gemini',
        detected: ['gemini', 'claude'],
        disabled: ['gemini']
      })
    ).toBe('claude')
  })

  it('falls back to the terminal-only default, then any installed agent, then none', () => {
    expect(pickManagerAgent({ defaultTuiAgent: 'aider', detected: ['gemini', 'aider'] })).toBe(
      'aider'
    )
    expect(pickManagerAgent({ defaultTuiAgent: null, detected: ['gemini'] })).toBe('gemini')
    expect(pickManagerAgent({ defaultTuiAgent: 'claude', detected: [] })).toBeNull()
  })
})
