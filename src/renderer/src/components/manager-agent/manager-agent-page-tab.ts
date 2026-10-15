import { useSyncExternalStore } from 'react'

// Why module state: v1 keeps the Manager tab id only in persisted UI state, which the store does
// not hydrate; the page needs it synchronously when openManagerAgent switches views.
let managerPageTabId: string | null = null
const subscribers = new Set<() => void>()

export function setManagerPageTabId(tabId: string | null): void {
  if (managerPageTabId === tabId) {
    return
  }
  managerPageTabId = tabId
  for (const subscriber of subscribers) {
    subscriber()
  }
}

export function getManagerPageTabId(): string | null {
  return managerPageTabId
}

function subscribe(onStoreChange: () => void): () => void {
  subscribers.add(onStoreChange)
  return () => {
    subscribers.delete(onStoreChange)
  }
}

export function useManagerPageTabId(): string | null {
  return useSyncExternalStore(subscribe, getManagerPageTabId, getManagerPageTabId)
}
