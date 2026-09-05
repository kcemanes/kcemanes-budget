import { useSyncExternalStore } from 'react'
import {
  getCanInstall,
  getUpdateWaiting,
  subscribeInstall,
  subscribeUpdate,
} from '../lib/pwa'

/** True once a newer build has downloaded and is waiting to take over. */
export function useUpdateWaiting() {
  return useSyncExternalStore(subscribeUpdate, getUpdateWaiting)
}

/** True while the browser is offering an install prompt to pass along. */
export function useCanInstall() {
  return useSyncExternalStore(subscribeInstall, getCanInstall)
}
