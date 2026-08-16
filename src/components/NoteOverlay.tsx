import { useEffect } from 'react'

interface Props {
  text: string
  onClose: () => void
}

export function NoteOverlay({ text, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 10000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className="note-overlay" onClick={onClose}>
      <div className="note-card">
        <div className="note-eyebrow">A NOTE LEFT BEHIND</div>
        <p className="note-text">{text}</p>
        <div className="note-close">click to dismiss</div>
      </div>
    </div>
  )
}
