import { useEffect } from 'react'
import { isTouchDevice } from '../device'

type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null }
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }
type LockableScreen = Screen & { orientation: ScreenOrientation & { lock?: (o: string) => Promise<void> } }

function isFullscreen(): boolean {
  const doc = document as FullscreenDocument
  return !!document.fullscreenElement || !!doc.webkitFullscreenElement
}

export async function enterFullscreen(): Promise<void> {
  if (isFullscreen()) return
  const el = document.documentElement as FullscreenElement
  const request = el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.()
  if (!request) return
  try {
    await (request as Promise<void>)
    try {
      await (screen as LockableScreen).orientation.lock?.('landscape')
    } catch {
      /* orientation lock not available (e.g. iOS Safari) */
    }
  } catch {
    /* fullscreen rejected: needs a user gesture or iframe permission */
  }
}

export function useMobileFullscreen(): void {
  useEffect(() => {
    if (!isTouchDevice()) return

    enterFullscreen()

    const onGesture = (): void => {
      enterFullscreen()
      document.removeEventListener('pointerdown', onGesture)
      document.removeEventListener('keydown', onGesture)
    }

    document.addEventListener('pointerdown', onGesture)
    document.addEventListener('keydown', onGesture)

    return () => {
      document.removeEventListener('pointerdown', onGesture)
      document.removeEventListener('keydown', onGesture)
    }
  }, [])
}
