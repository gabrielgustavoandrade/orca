import { describe, expect, it } from 'vitest'
import { getExperimentalSearchEntry } from './experimental-search'
import { getManagerAgentExperimentalSearchEntry } from './manager-agent-experimental-search-entry'
import { matchesSettingsSearch } from './settings-search'

describe('Manager experimental search entry', () => {
  it.each(['manager', 'chief of staff', 'orchestration', 'delegate'])('matches %s', (query) => {
    expect(matchesSettingsSearch(query, getManagerAgentExperimentalSearchEntry())).toBe(true)
  })

  it('is registered on the Experimental page', () => {
    expect(getExperimentalSearchEntry().managerAgent.title).toBe('Manager')
  })
})
