import { useSyncExternalStore } from 'react'
import type { ManagerScopeKey } from '../../../../shared/manager-agent-records'

// Why module state: a launch outlives the page mount that started it, and only lasts a few seconds.
let launchingScopes: ReadonlySet<ManagerScopeKey> = new Set()
const subscribers = new Set<() => void>()

export function setManagerScopeLaunching(scopeKey: ManagerScopeKey, launching: boolean): void {
  if (launchingScopes.has(scopeKey) === launching) {
    return
  }
  const next = new Set(launchingScopes)
  if (launching) {
    next.add(scopeKey)
  } else {
    next.delete(scopeKey)
  }
  launchingScopes = next
  for (const subscriber of subscribers) {
    subscriber()
  }
}

export function isManagerScopeLaunching(scopeKey: ManagerScopeKey): boolean {
  return launchingScopes.has(scopeKey)
}

function subscribe(onStoreChange: () => void): () => void {
  subscribers.add(onStoreChange)
  return () => {
    subscribers.delete(onStoreChange)
  }
}

export function useManagerScopeLaunching(scopeKey: ManagerScopeKey): boolean {
  return useSyncExternalStore(
    subscribe,
    () => launchingScopes.has(scopeKey),
    () => launchingScopes.has(scopeKey)
  )
}
