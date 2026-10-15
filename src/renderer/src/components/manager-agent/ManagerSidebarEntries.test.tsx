// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ManagerAgentRecord } from '../../../../shared/manager-agent-records'
import { makeManagerScopeState } from './manager-agent-scope-test-fixtures'

const mocks = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  openManagerScope: vi.fn(),
  counts: { working: 0, needsYou: 0 }
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mocks.state)
}))
vi.mock('./open-manager-agent', () => ({ openManagerScope: mocks.openManagerScope }))
vi.mock('./use-manager-scope-counts', () => ({ useManagerScopeCounts: () => mocks.counts }))
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenuItem: ({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) => (
    <button type="button" data-menu-item="" onClick={onSelect}>
      {children}
    </button>
  )
}))

import {
  ManagerProjectHeaderBadge,
  ManagerProjectMenuItem,
  ManagerWorktreeBadge,
  ManagerWorktreeMenuItem
} from './ManagerSidebarEntries'
import { formatManagerCardCounts } from './ManagerSidebarCard'

function record(scopeKey: ManagerAgentRecord['scopeKey']): ManagerAgentRecord {
  return {
    scopeKey,
    tabId: 't',
    agent: 'claude',
    hostWorktreeId: 'h',
    briefVersion: 2,
    createdAt: 1
  }
}

const roots: Root[] = []

async function render(node: ReactNode): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(node)
  })
  return container
}

function setState(
  records: Record<string, ManagerAgentRecord>,
  extra: Record<string, unknown> = {}
) {
  mocks.state = {
    ...makeManagerScopeState(records),
    settings: { experimentalManagerAgent: true },
    activeView: 'terminal',
    managerScope: 'global',
    ...extra
  }
}

describe('Manager sidebar badges and menu entries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.counts = { working: 0, needsYou: 0 }
  })

  afterEach(async () => {
    await act(async () => {
      for (const root of roots.splice(0)) {
        root.unmount()
      }
    })
    document.body.innerHTML = ''
  })

  it('shows a project badge only when that project has a Manager', async () => {
    setState({})
    expect((await render(<ManagerProjectHeaderBadge repoId="repo-orca" />)).innerHTML).toBe('')

    setState({ 'project:p-orca': record('project:p-orca') })
    const container = await render(<ManagerProjectHeaderBadge repoId="repo-orca" />)
    const badge = container.querySelector('[role="img"]')
    expect(badge?.getAttribute('aria-label')).toBe('Has a Manager')
    expect(badge?.getAttribute('data-open')).toBeNull()
    await act(async () => {
      container.querySelector('button')?.click()
    })
    expect(mocks.openManagerScope).toHaveBeenCalledWith('project:p-orca', 'sidebar')
  })

  it('fills the badge while its Manager page is open and dots it when work needs the user', async () => {
    mocks.counts = { working: 0, needsYou: 2 }
    setState(
      { 'workspace:orca-feat': record('workspace:orca-feat') },
      { activeView: 'manager', managerScope: 'workspace:orca-feat' }
    )
    const container = await render(<ManagerWorktreeBadge worktreeId="orca-feat" />)
    const badge = container.querySelector('[role="img"]')
    expect(badge?.getAttribute('data-open')).toBe('true')
    expect(badge?.getAttribute('aria-label')).toBe('Has a Manager that needs you')
    expect(badge?.querySelector('.bg-agent-question')).not.toBeNull()
  })

  it('renders nothing while the experiment is off', async () => {
    setState({ 'workspace:orca-feat': record('workspace:orca-feat') }, { settings: {} })
    expect((await render(<ManagerWorktreeBadge worktreeId="orca-feat" />)).innerHTML).toBe('')
    expect((await render(<ManagerWorktreeMenuItem worktreeId="orca-feat" />)).innerHTML).toBe('')
  })

  it('offers "Add manager", then "Open manager", in the row menus', async () => {
    setState({})
    const add = await render(<ManagerWorktreeMenuItem worktreeId="orca-feat" />)
    expect(add.textContent).toBe('Add manager')
    await act(async () => {
      add.querySelector('button')?.click()
    })
    expect(mocks.openManagerScope).toHaveBeenCalledWith('workspace:orca-feat', 'sidebar')

    setState({ 'project:p-orca': record('project:p-orca') })
    expect((await render(<ManagerProjectMenuItem repoId="repo-orca" />)).textContent).toBe(
      'Open manager'
    )
    // A repo outside any project has no project scope to offer.
    expect((await render(<ManagerProjectMenuItem repoId="repo-loose" />)).innerHTML).toBe('')
  })

  it('formats the card counts, hiding zeros and falling back to Idle', () => {
    expect(formatManagerCardCounts({ working: 4, needsYou: 1 })).toEqual({
      working: '4 working',
      needsYou: '1 need you',
      idle: null
    })
    expect(formatManagerCardCounts({ working: 0, needsYou: 3 })).toEqual({
      working: null,
      needsYou: '3 need you',
      idle: null
    })
    expect(formatManagerCardCounts({ working: 0, needsYou: 0 }).idle).toBe('Idle')
  })
})
