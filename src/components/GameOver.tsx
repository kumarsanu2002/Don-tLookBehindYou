interface Props {
  reason: string
  hasCheckpoint: boolean
  onRespawn: () => void
  onRestartLevel: () => void
  onQuit: () => void
}

export function GameOver({ reason, hasCheckpoint, onRespawn, onRestartLevel, onQuit }: Props) {
  return (
    <div className="overlay death-overlay">
      <div className="death-inner">
        <h2 className="death-title">YOU LOOKED AWAY.</h2>
        {reason && <p className="death-reason">{reason}</p>}
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={onRespawn}>
            {hasCheckpoint ? 'RESPAWN AT CHECKPOINT' : 'TRY AGAIN'}
          </button>
          <button className="btn" onClick={onRestartLevel}>
            RESTART LEVEL
          </button>
          <button className="btn" onClick={onQuit}>
            QUIT TO MENU
          </button>
        </div>
        <p className="menu-hint">It was closer than you thought. It's always closer than you thought.</p>
      </div>
    </div>
  )
}
