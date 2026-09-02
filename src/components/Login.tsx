import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import './Login.css'

type Mode = 'signin' | 'signup'

function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)

    const { data, error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
    } else if (mode === 'signup' && !data.session) {
      setNotice('Check your inbox to confirm your email address.')
    }

    setBusy(false)
  }

  function switchMode() {
    setMode((mode) => (mode === 'signin' ? 'signup' : 'signin'))
    setError(null)
    setNotice(null)
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
        <p className="login-sub">
          {mode === 'signin'
            ? 'Welcome back to your budget.'
            : 'Start tracking your budget.'}
        </p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete={
            mode === 'signin' ? 'current-password' : 'new-password'
          }
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        {error && (
          <p className="login-msg error" role="alert">
            {error}
          </p>
        )}
        {notice && <p className="login-msg notice">{notice}</p>}

        <button type="submit" className="login-submit" disabled={busy}>
          {busy
            ? 'Working…'
            : mode === 'signin'
              ? 'Sign in'
              : 'Sign up'}
        </button>

        <p className="login-switch">
          {mode === 'signin' ? "Don't have an account?" : 'Already have one?'}{' '}
          <button type="button" onClick={switchMode}>
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </form>
    </div>
  )
}

export default Login
