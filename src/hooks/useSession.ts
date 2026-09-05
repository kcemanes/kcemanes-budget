import { useEffect, useState } from 'react'
import { forgetAccount, isSigningOut, storeAccount, storedAccount } from '../lib/auth'
import type { Account } from '../lib/auth'
import { supabase } from '../lib/supabase'

/**
 * The signed-in account, resolved so that being offline never looks like
 * being signed out.
 *
 * The remembered account is adopted synchronously, so a launch from the home
 * screen with no connection paints the dashboard from IndexedDB instead of a
 * spinner. Supabase then confirms or overrides it. The one case that is
 * deliberately ignored is losing a session while offline: a refresh that
 * could not reach the server says nothing about whether the account is still
 * good, so the app keeps going and queues writes. Once online, a genuinely
 * expired session does drop through to the login form — and the outbox
 * survives it, because only an explicit sign-out clears local data.
 */
export function useSession() {
  const [account, setAccount] = useState<Account | null>(storedAccount)
  // A remembered account is enough to render; only a cold, unknown start waits.
  const [loading, setLoading] = useState(() => storedAccount() === null)

  useEffect(() => {
    let cancelled = false

    const adopt = (id: string, email: string | undefined) => {
      const next = { id, email: email ?? '' }
      storeAccount(next)
      setAccount(next)
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return
        if (data.session) {
          adopt(data.session.user.id, data.session.user.email)
        } else if (!error && navigator.onLine) {
          // No session and nothing went wrong finding that out: the
          // remembered account really is stale, so drop it.
          //
          // An `error` here means the token could not be checked — the
          // refresh call failed. `navigator.onLine` alone would not catch
          // that: a captive portal or a dead uplink reports being online
          // while no request can complete. Keeping the account is the safer
          // reading, and a genuinely revoked session still lands on the login
          // form via the SIGNED_OUT event below.
          forgetAccount()
          setAccount(null)
        }
      })
      .catch(() => {
        // Offline. Whatever was remembered stands.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return

        if (session) {
          adopt(session.user.id, session.user.email)
        } else if (event === 'SIGNED_OUT' && (isSigningOut() || navigator.onLine)) {
          forgetAccount()
          setAccount(null)
        }

        setLoading(false)
      },
    )

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  return { account, loading }
}
