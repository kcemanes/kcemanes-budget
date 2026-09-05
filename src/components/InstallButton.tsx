import { useCanInstall } from '../hooks/usePwa'
import { promptInstall } from '../lib/pwa'

/**
 * Shown only while the browser has an install prompt to hand over — which
 * means Chromium, on a visit where the app is not already installed. Other
 * browsers install from their own menus and never light this up.
 */
function InstallButton() {
  const canInstall = useCanInstall()
  if (!canInstall) return null

  return (
    <button type="button" className="btn-quiet" onClick={() => void promptInstall()}>
      Install
    </button>
  )
}

export default InstallButton
