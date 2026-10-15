import type {
  ManagerAgentRecord,
  ManagerAgentRecords,
  ManagerScopeKey
} from '../../../../../shared/manager-agent-records'
import type { UISliceSet } from './ui-slice-contract'

export type UISliceManagerAgents = {
  /** Experimental Managers by scope key; persisted through the UI writer. */
  managerAgents: ManagerAgentRecords
  /** The scope the Manager page shows. Not persisted: a restart opens the global Manager. */
  managerScope: ManagerScopeKey
  setManagerScope: (scopeKey: ManagerScopeKey) => void
  setManagerAgentRecord: (record: ManagerAgentRecord) => void
}

export function createUiManagerAgentActions(set: UISliceSet): UISliceManagerAgents {
  return {
    managerAgents: {},
    managerScope: 'global',
    setManagerScope: (scopeKey) => set({ managerScope: scopeKey }),
    setManagerAgentRecord: (record) =>
      set((state) => ({
        managerAgents: { ...state.managerAgents, [record.scopeKey]: record }
      }))
  }
}
