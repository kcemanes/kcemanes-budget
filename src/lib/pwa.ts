/**
 * Service worker registration, and the two prompts that come with being
 * installable.
 *
 * Both are exposed as external stores rather than React state because the
 * events behind them fire outside React — one from the worker's lifecycle,
 * one from the browser deciding the app qualifies for installation — and can
 * arrive before or after any particular component mounts.
 */
import { registerSW } from 'virtual:pwa-register'

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------

let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null
let waiting = false

const updateListeners = new Set<() => void>()

function announceUpdate() {
  for (const listener of updateListeners) listener()
}

export function subscribeUpdate(listener: () => void) {
  updateListeners.add(listener)
  return () => {
    updateListeners.delete(listener)
  }
}

export function getUpdateWaiting() {
  return waiting
}

/** Activates the waiting worker and reloads onto the new build. */
export function reloadForUpdate() {
  void applyUpdate?.(true)
}

export function registerServiceWorker() {
  applyUpdate = registerSW({
    onNeedRefresh() {
      waiting = true
      announceUpdate()
    },
  })
}

// ---------------------------------------------------------------------------
// Installation
//
// Chromium fires `beforeinstallprompt` when the app is installable and lets
// the page defer it. Safari and Firefox never fire it and install through
// their own menus, so the button simply never appears there.
// ---------------------------------------------------------------------------

type InstallEvent = Event & { prompt: () => Promise<void> }

let deferred: InstallEvent | null = null
const installListeners = new Set<() => void>()

function announceInstall() {
  for (const listener of installListeners) listener()
}

export function subscribeInstall(listener: () => void) {
  installListeners.add(listener)
  return () => {
    installListeners.delete(listener)
  }
}

export function getCanInstall() {
  return deferred !== null
}

export async function promptInstall() {
  const event = deferred
  if (!event) return

  // The event is single-use, so it goes whether the user accepts or dismisses.
  deferred = null
  announceInstall()
  await event.prompt()
}

export function watchInstallability() {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Without this the browser shows its own bar instead of letting the
    // header button do it.
    event.preventDefault()
    deferred = event as InstallEvent
    announceInstall()
  })

  window.addEventListener('appinstalled', () => {
    deferred = null
    announceInstall()
  })
}
