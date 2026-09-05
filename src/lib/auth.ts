/**
 * Who is signed in, in a form that survives being offline.
 *
 * Supabase keeps the session in localStorage and refreshes the access token
 * over the network. That refresh cannot happen without a connection, so a
 * cold start in aeroplane mode can hand back no session at all — which, taken
 * at face value, would bounce the user to the login form and hide data that
 * is sitting in IndexedDB right there. So the account's id and email are
 * remembered separately, and treated as good enough to keep rendering while
 * the network is gone.
 *
 * It is only a display and scoping identity. It grants nothing: every read is
 * local, and every queued write still has to pass RLS with a real token
 * before it reaches Postgres.
 */
import { supabase } from './supabase'
import { clearLocalData } from './store'
import { resetSyncState } from './sync'

export type Account = { id: string; email: string }

const STORAGE_KEY = 'budget.account'

export function storedAccount(): Account | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as Account).id === 'string'
    ) {
      return parsed as Account
    }
  } catch {
    // Unreadable or not JSON: treat it as nobody, and let Supabase decide.
  }
  return null
}

export function storeAccount(account: Account) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(account))
  } catch {
    // Storage blocked. Sessions then last only as long as the tab, which is
    // the same deal the rest of the app's settings get.
  }
}

export function forgetAccount() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to undo.
  }
}

/**
 * Set for the duration of a deliberate sign-out.
 *
 * Supabase raises SIGNED_OUT both when the user asks and when a token refresh
 * finally gives up, and those need opposite handling: one should clear the
 * device, the other should leave it alone so an offline tab keeps working.
 */
let signingOut = false

export function isSigningOut() {
  return signingOut
}

/**
 * Ends the session and removes this account's data from the browser.
 *
 * Wiping is the point rather than a side effect — the local database is a
 * full copy of the account's history, and leaving it behind on a shared
 * computer would outlive the session that was supposed to protect it. Callers
 * are expected to have warned about anything still queued, since that is the
 * one thing a wipe destroys for good.
 */
export async function signOut() {
  signingOut = true
  try {
    const { error } = await supabase.auth.signOut()
    // A global sign-out revokes the refresh token server-side, which needs a
    // network. Offline, fall back to dropping the session locally.
    if (error) await supabase.auth.signOut({ scope: 'local' })
  } catch {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  } finally {
    forgetAccount()
    await clearLocalData()
    resetSyncState()
    signingOut = false
  }
}
