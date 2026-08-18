import { useEffect } from 'react'
import { isTouchDevice } from '../device'

type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null }
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }

function isFullscreen(): boolean {
  const doc = document as FullscreenDocument
  return !!document.fullscreenElement || !!doc.webkitFullscreenElement
}

function enterFullscreen(): void {
  if (isFullscreen()) return
  const el = document.documentElement as FullscreenElement
  const request = el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.()
  if (request && typeof (request as Promise<void>).catch === 'function') {
    ;(request as Promise<void>).catch(() => {})
  }
}

export function useMobileFullscreen(): void {
  useEffect(() => {
    if (!isTouchDevice()) return

    const attempt = (): void => {
      enterFullscreen()
    }

    attempt()

    const onGesture = (): void => {
      attempt()
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
