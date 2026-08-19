import { useEffect, useState } from 'react'
import { enterFullscreen } from '../hooks/useMobileFullscreen'
import { isTouchDevice } from '../device'

export function FullscreenHint() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isTouchDevice()) return
    const update = (): void => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches
      const inFullscreen = !!document.fullscreenElement
      setVisible(!standalone && !inFullscreen)
    }
    update()
    document.addEventListener('fullscreenchange', update)
    window.addEventListener('resize', update)
    return () => {
      document.removeEventListener('fullscreenchange', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  if (!visible) return null

  return (
    <button
      className="fullscreen-hint"
      type="button"
      onClick={() => {
        enterFullscreen()
        setVisible(false)
      }}
    >
      <span className="fullscreen-hint-title">TAP FOR FULLSCREEN</span>
      <span className="fullscreen-hint-sub">iPhone? Add to Home Screen for true fullscreen</span>
    </button>
  )
}
