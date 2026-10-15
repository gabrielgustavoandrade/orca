import { translate } from '@/i18n/i18n'
import type { SettingsSearchEntry } from './settings-search'
import { translateSearchKeyword } from './settings-search-keywords'

export function getManagerAgentExperimentalSearchEntry(): SettingsSearchEntry {
  return {
    title: translate('auto.components.settings.experimental.search.managerAgent.title', 'Manager'),
    description: translate(
      'auto.components.settings.experimental.search.managerAgent.description',
      'One persistent chat that finds work across projects and delegates it to other agents.'
    ),
    keywords: [
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.0d24759f14',
        'experimental'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.managerAgent.manager',
        'manager'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.managerAgent.chiefOfStaff',
        'chief of staff'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.managerAgent.orchestration',
        'orchestration'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.managerAgent.delegate',
        'delegate'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.managerAgent.agent',
        'agent'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.experimental.search.managerAgent.chat',
        'chat'
      )
    ]
  }
}
