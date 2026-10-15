import { translate } from '@/i18n/i18n'
import {
  parseManagerScopeKey,
  type ManagerScopeKey
} from '../../../../shared/manager-agent-records'
import { managerScopeNames, type ManagerScopeState } from './manager-agent-scope'

/** Short UI name of a scope: "All projects", the project's name, or the workspace's name. */
export function managerScopeLabel(state: ManagerScopeState, scopeKey: ManagerScopeKey): string {
  const scope = parseManagerScopeKey(scopeKey)
  if (!scope || scope.kind === 'global') {
    return translate('auto.components.managerAgent.allProjects', 'All projects')
  }
  const names = managerScopeNames(state, scopeKey)
  const name = scope.kind === 'project' ? names.projectName : names.workspaceName
  return name ?? translate('auto.components.managerAgent.unknownScope', 'Unknown')
}

/** UI name of a scope's Manager, e.g. "All-projects Manager" or "orca Manager". */
export function managerDisplayName(state: ManagerScopeState, scopeKey: ManagerScopeKey): string {
  if (parseManagerScopeKey(scopeKey)?.kind === 'global') {
    return translate('auto.components.managerAgent.allProjectsManager', 'All-projects Manager')
  }
  return translate('auto.components.managerAgent.scopeManager', '{{name}} Manager', {
    name: managerScopeLabel(state, scopeKey)
  })
}
