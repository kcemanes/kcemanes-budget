import { useSyncState } from '../hooks/useSyncState'

/**
 * A pill in the header saying where the user's changes are.
 *
 * It says nothing when there is nothing to say — everything synced, nothing
 * queued — because the ordinary case is the one the user should not have to
 * think about. It appears when a change is still only on this device, which
 * is the only state where the difference matters.
 */
const PILL =
  'rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap'

function SyncStatus() {
  const { status, pending } = useSyncState()

  const queued = pending > 0 ? `${pending} unsynced` : null

  let label: string | null = null
  let tone = 'border-line text-muted'

  if (status === 'offline') {
    label = queued ? `Offline · ${queued}` : 'Offline'
    tone = 'border-notice bg-notice-soft text-notice-strong'
  } else if (status === 'error') {
    label = queued ? `Sync failed · ${queued}` : 'Sync failed'
    tone = 'border-danger bg-danger-soft text-danger'
  } else if (status === 'syncing') {
    label = 'Syncing…'
  } else if (queued) {
    label = queued
  }

  // Announced politely: it changes on its own, and never needs interrupting.
  return (
    <span aria-live="polite" className="contents">
      {label && <span className={`${PILL} ${tone}`}>{label}</span>}
    </span>
  )
}

export default SyncStatus
