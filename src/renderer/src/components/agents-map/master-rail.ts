import { buildItems, byStart } from './agents-map-items'
import type { AgentsMapInput, AgentsMapNode, TreeItem } from './agents-map-types'

export type RailTreeNode = { item: TreeItem; children: RailTreeNode[] }
export type NeedsYouItem = { item: TreeItem; startedByMaster: boolean }

export type MasterRailGroups = {
  master: AgentsMapNode | null
  needsYou: NeedsYouItem[]
  started: RailTreeNode[]
  other: TreeItem[]
  /** Every non-master agent, for resolving the selected row. */
  listed: TreeItem[]
}

export function buildMasterRail(input: AgentsMapInput): MasterRailGroups {
  const items = buildItems(input)
  const byId = new Map(items.map((item) => [item.node.id, item]))
  const startedByMaster = (item: TreeItem): boolean => {
    const seen = new Set<string>()
    let parent = item.parentId ? byId.get(item.parentId) : undefined
    while (parent && !seen.has(parent.node.id)) {
      if (parent.node.isMaster) {
        return true
      }
      seen.add(parent.node.id)
      parent = parent.parentId ? byId.get(parent.parentId) : undefined
    }
    return false
  }

  const listed = items.filter((item) => !item.node.isMaster)
  const started = listed.filter(startedByMaster).sort(byStart)
  const startedIds = new Set(started.map((item) => item.node.id))
  const childrenOf = (parentId: string): RailTreeNode[] =>
    started
      .filter((item) => item.parentId === parentId)
      .map((item) => ({ item, children: childrenOf(item.node.id) }))
  const roots = started
    .filter((item) => item.parentId && byId.get(item.parentId)?.node.isMaster)
    .map((item) => ({ item, children: childrenOf(item.node.id) }))

  return {
    master: items.find((item) => item.node.isMaster)?.node ?? null,
    needsYou: listed
      .filter((item) => item.card.bucket === 'attention' && item.card.askSummary)
      .sort((a, b) => b.card.stateChangedAt - a.card.stateChangedAt)
      .map((item) => ({ item, startedByMaster: startedIds.has(item.node.id) })),
    started: roots,
    other: listed.filter((item) => !startedIds.has(item.node.id)).sort(byStart),
    listed
  }
}
