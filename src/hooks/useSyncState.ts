import { useSyncExternalStore } from 'react'
import { getSyncState, subscribeSync } from '../lib/sync'

/** The current push/pull state, re-rendering whichever components read it. */
export function useSyncState() {
  return useSyncExternalStore(subscribeSync, getSyncState)
}
