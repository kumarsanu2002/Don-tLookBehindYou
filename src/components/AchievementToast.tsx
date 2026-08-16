import { useEffect, useState } from 'react'

interface Toast {
  id: number
  name: string
  desc: string
}

interface Props {
  toast: Toast | null
}

export function AchievementToast({ toast }: Props) {
  const [visible, setVisible] = useState(false)
  const [current, setCurrent] = useState<Toast | null>(null)

  useEffect(() => {
    if (!toast) return
    setCurrent(toast)
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 4500)
    return () => clearTimeout(t)
  }, [toast])

  if (!current) return null

  return (
    <div className={`achievement-toast${visible ? ' is-visible' : ''}`}>
      <div className="toast-label">ACHIEVEMENT</div>
      <div className="toast-name">{current.name}</div>
      <div className="toast-desc">{current.desc}</div>
    </div>
  )
}
