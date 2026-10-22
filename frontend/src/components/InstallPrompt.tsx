import { Download, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    const installed = () => setInstallEvent(null)

    window.addEventListener('beforeinstallprompt', capturePrompt)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  if (!installEvent || dismissed || isStandalone()) return null

  const install = async () => {
    await installEvent.prompt()
    await installEvent.userChoice
    setInstallEvent(null)
  }

  return <aside className="install-prompt" aria-label="Install SiteTrack">
    <img src="/icon-192.png" alt="" width="48" height="48" />
    <div className="install-prompt__copy">
      <strong>Install SiteTrack</strong>
      <span>Add the app to your home screen for quicker access.</span>
    </div>
    <button className="button button--primary" type="button" onClick={install}>
      <Download aria-hidden="true" /> Install
    </button>
    <button className="icon-button" type="button" aria-label="Dismiss install prompt" onClick={() => setDismissed(true)}>
      <X aria-hidden="true" />
    </button>
  </aside>
}
