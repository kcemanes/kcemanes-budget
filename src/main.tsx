import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker, watchInstallability } from './lib/pwa'

// Before the first render: the worker that makes a cold offline launch work,
// and the listener for an install offer the browser may fire immediately.
registerServiceWorker()
watchInstallability()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
