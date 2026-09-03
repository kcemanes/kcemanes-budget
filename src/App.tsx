import Dashboard from './components/Dashboard'
import Login from './components/Login'
import { useSession } from './hooks/useSession'

function App() {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        Loading…
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return <Dashboard session={session} />
}

export default App
