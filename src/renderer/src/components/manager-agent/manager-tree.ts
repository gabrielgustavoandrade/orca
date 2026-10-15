import type { ManagerAgentRecord } from '../../../../shared/manager-agent-records'

export type ManagerTreeNode = { record: ManagerAgentRecord; children: ManagerTreeNode[] }

const SCOPE_RANK = { global: 0, project: 1, workspace: 2 } as const

function scopeRank(record: ManagerAgentRecord): number {
  if (record.scopeKey === 'global') {
    return SCOPE_RANK.global
  }
  return record.scopeKey.startsWith('project:') ? SCOPE_RANK.project : SCOPE_RANK.workspace
}

/** Chain of command: each Manager under the parent it reports to; orphans become roots. */
export function buildManagerTree(records: readonly ManagerAgentRecord[]): ManagerTreeNode[] {
  const sorted = [...records].sort(
    (a, b) => scopeRank(a) - scopeRank(b) || a.createdAt - b.createdAt
  )
  const nodes = new Map<string, ManagerTreeNode>(
    sorted.map((record) => [record.scopeKey, { record, children: [] }])
  )
  const roots: ManagerTreeNode[] = []
  for (const node of nodes.values()) {
    const parent = node.record.parentScopeKey ? nodes.get(node.record.parentScopeKey) : undefined
    // Why the rank check: a parent must sit above its child, which also rules out cycles.
    if (parent && scopeRank(parent.record) < scopeRank(node.record)) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}
