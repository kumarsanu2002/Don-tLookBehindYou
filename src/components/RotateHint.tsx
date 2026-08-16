import { useEffect, useState } from 'react'
import { isTouchDevice } from '../device'

export function RotateHint() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const update = (): void => {
      setShow(isTouchDevice() && window.innerHeight > window.innerWidth)
    }
    update()
    mq.addEventListener?.('change', update)
    window.addEventListener('resize', update)
    return () => {
      mq.removeEventListener?.('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  if (!show) return null

  return (
    <div className="rotate-hint">
      <div className="rotate-phone" />
      <p className="rotate-title">ROTATE YOUR DEVICE</p>
      <p className="rotate-sub">This game plays best in landscape.</p>
    </div>
  )
}
