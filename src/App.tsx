import Login from './components/Login'
import { useSession } from './hooks/useSession'
import { supabase } from './lib/supabase'
import './App.css'

function App() {
  const { session, loading } = useSession()

  if (loading) {
    return <div className="app-loading">Loading…</div>
  }

  if (!session) {
    return <Login />
  }

  return (
    <section className="app-signed-in">
      <h1>Signed in</h1>
      <p>{session.user.email}</p>
      <button type="button" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </section>
  )
}

export default App
