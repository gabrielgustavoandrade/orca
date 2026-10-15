import { useEffect, useSyncExternalStore } from 'react'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { fetchManagerOverview, type ManagerOverview } from './manager-overview-data'

/** While the Manager page is open. */
const PAGE_POLL_MS = 5_000
/** While only the sidebar card and badges are watching. */
const BACKGROUND_POLL_MS = 20_000

export type ManagerOverviewSnapshot = { overview: ManagerOverview | null; failed: boolean }

let snapshot: ManagerOverviewSnapshot = { overview: null, failed: false }
const listeners = new Set<() => void>()
let pageWatchers = 0
let watchers = 0
let timer: ReturnType<typeof setTimeout> | null = null
let inFlight = false

// Why local: orchestration state lives in this app's runtime database.
const LOCAL_RUNTIME = { kind: 'local' } as const

function publish(next: ManagerOverviewSnapshot): void {
  snapshot = next
  for (const listener of listeners) {
    listener()
  }
}

function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

function schedule(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (watchers === 0 || isDocumentHidden()) {
    return
  }
  timer = setTimeout(() => void poll(), pageWatchers > 0 ? PAGE_POLL_MS : BACKGROUND_POLL_MS)
}

async function poll(): Promise<void> {
  if (inFlight || watchers === 0) {
    return
  }
  inFlight = true
  try {
    const overview = await fetchManagerOverview((method, params) =>
      callRuntimeRpc<unknown>(LOCAL_RUNTIME, method, params, { suppressFeatureInteraction: true })
    )
    publish({ overview, failed: false })
  } catch {
    // Why keep the last overview: a transient RPC failure should not blank the panel.
    publish({ overview: snapshot.overview, failed: true })
  } finally {
    inFlight = false
    schedule()
  }
}

function onVisibilityChange(): void {
  if (isDocumentHidden()) {
    schedule()
  } else {
    void poll()
  }
}

function watch(page: boolean): () => void {
  watchers += 1
  pageWatchers += page ? 1 : 0
  if (watchers === 1 && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }
  void poll()
  return () => {
    watchers -= 1
    pageWatchers -= page ? 1 : 0
    if (watchers === 0 && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    schedule()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = (): ManagerOverviewSnapshot => snapshot

/**
 * Shared orchestration overview. The page polls every 5 s; the sidebar alone every 20 s; nothing
 * polls while the window is hidden or nobody watches. Orchestration has no change event to subscribe to.
 */
export function useManagerOverview(options: {
  enabled: boolean
  page?: boolean
}): ManagerOverviewSnapshot {
  const { enabled, page = false } = options
  useEffect(() => (enabled ? watch(page) : undefined), [enabled, page])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
