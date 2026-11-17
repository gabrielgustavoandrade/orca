import {
  AGENTS_MAP_NODE_HEIGHT,
  AGENTS_MAP_NODE_WIDTH,
  type AgentsMapEdge,
  type AgentsMapGroup,
  type AgentsMapInput,
  type AgentsMapLayout,
  type TreeItem
} from './agents-map-types'
import { buildItems, byStart, groupByWorkspace, workspaceKeyOf } from './agents-map-items'

export { agentsMapActivity } from './agents-map-items'
export { AGENTS_MAP_NODE_HEIGHT, AGENTS_MAP_NODE_WIDTH } from './agents-map-types'
export type * from './agents-map-types'

const COL_GAP = 40
const ROW_GAP = 12
const PAD = 12
const HEADER_H = 28
const WS_GAP = 16
const PROJECT_GAP = 24

function layoutForest(items: TreeItem[]): { width: number; height: number } {
  const byId = new Map(items.map((item) => [item.node.id, item]))
  const visited = new Set<string>()
  const roots: TreeItem[] = []
  for (const item of [...items].sort(byStart)) {
    const parent = item.parentId ? byId.get(item.parentId) : undefined
    if (parent) {
      parent.children.push(item)
    } else {
      roots.push(item)
    }
  }
  // Subagents keep snapshot order ahead of child agents so siblings stay stable.
  for (const item of items) {
    item.children.sort((a, b) => {
      if (a.node.kind !== b.node.kind) {
        return a.node.kind === 'subagent' ? -1 : 1
      }
      return a.node.kind === 'subagent' ? 0 : byStart(a, b)
    })
  }
  let nextRow = 0
  const place = (item: TreeItem, depth: number): void => {
    visited.add(item.node.id)
    item.depth = depth
    const kids = item.children.filter((child) => !visited.has(child.node.id))
    kids.forEach((child) => place(child, depth + 1))
    item.row = kids.length === 0 ? nextRow++ : (kids[0].row + kids.at(-1)!.row) / 2
  }
  roots.forEach((root) => place(root, 0))
  // Parent cycles never reach a root; surface them as roots instead of dropping nodes.
  items.filter((item) => !visited.has(item.node.id)).forEach((item) => place(item, 0))
  let maxDepth = 0
  for (const item of items) {
    maxDepth = Math.max(maxDepth, item.depth)
    item.node.x = item.depth * (AGENTS_MAP_NODE_WIDTH + COL_GAP)
    item.node.y = item.row * (AGENTS_MAP_NODE_HEIGHT + ROW_GAP)
  }
  return {
    width: maxDepth * (AGENTS_MAP_NODE_WIDTH + COL_GAP) + AGENTS_MAP_NODE_WIDTH,
    height: Math.max(nextRow - 1, 0) * (AGENTS_MAP_NODE_HEIGHT + ROW_GAP) + AGENTS_MAP_NODE_HEIGHT
  }
}

export function buildAgentsMap(input: AgentsMapInput): AgentsMapLayout {
  const items = buildItems(input)
  const projects = groupByWorkspace(input, items)
  const groups: AgentsMapGroup[] = []
  let totalWidth = 0
  let cursorY = 0
  for (const project of projects) {
    const wsGroups: AgentsMapGroup[] = []
    let x = PAD
    let y = HEADER_H + PAD
    let rowHeight = 0
    let projectWidth = 0
    for (const ws of project.workspaces) {
      const tree = layoutForest(ws.items)
      const width = tree.width + PAD * 2
      const height = tree.height + PAD * 2 + HEADER_H
      if (x > PAD && x + width > input.wrapWidth - PAD) {
        x = PAD
        y += rowHeight + WS_GAP
        rowHeight = 0
      }
      const group: AgentsMapGroup = {
        id: `workspace:${ws.key}`,
        kind: 'workspace',
        label: ws.label,
        hostLabel: ws.hostLabel,
        x,
        y: cursorY + y,
        width,
        height
      }
      wsGroups.push(group)
      for (const item of ws.items) {
        item.node.x += group.x + PAD
        item.node.y += group.y + HEADER_H + PAD
      }
      x += width + WS_GAP
      rowHeight = Math.max(rowHeight, height)
      projectWidth = Math.max(projectWidth, group.x + width + PAD)
    }
    const projectHeight = y + rowHeight + PAD
    groups.push(
      {
        id: `project:${project.repoId}`,
        kind: project.isMaster ? 'master' : 'project',
        label: project.label,
        x: 0,
        y: cursorY,
        width: projectWidth,
        height: projectHeight
      },
      ...wsGroups
    )
    totalWidth = Math.max(totalWidth, projectWidth)
    cursorY += projectHeight + PROJECT_GAP
  }
  const placed = projects.flatMap((p) => p.workspaces.flatMap((w) => w.items))
  const nodesById = new Map(placed.map((item) => [item.node.id, item]))
  const edges: AgentsMapEdge[] = []
  for (const item of placed) {
    const parent = item.parentId ? nodesById.get(item.parentId) : undefined
    if (!parent) {
      continue
    }
    const x1 = parent.node.x + AGENTS_MAP_NODE_WIDTH
    const y1 = parent.node.y + AGENTS_MAP_NODE_HEIGHT / 2
    const x2 = item.node.x
    const y2 = item.node.y + AGENTS_MAP_NODE_HEIGHT / 2
    const mx = (x1 + x2) / 2
    edges.push({
      id: `${parent.node.id}->${item.node.id}`,
      from: parent.node.id,
      to: item.node.id,
      crossWorkspace: workspaceKeyOf(parent.card) !== workspaceKeyOf(item.card),
      path: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
    })
  }
  return {
    width: totalWidth,
    height: Math.max(cursorY - PROJECT_GAP, 0),
    groups,
    nodes: placed.map((item) => item.node),
    edges
  }
}
