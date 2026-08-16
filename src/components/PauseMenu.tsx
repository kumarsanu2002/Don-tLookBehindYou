interface Props {
  onResume: () => void
  onRestart: () => void
  onSettings: () => void
  onQuit: () => void
}

export function PauseMenu({ onResume, onRestart, onSettings, onQuit }: Props) {
  return (
    <div className="overlay">
      <div className="panel">
        <h2 className="panel-title">PAUSED</h2>
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={onResume}>
            RESUME
          </button>
          <button className="btn" onClick={onRestart}>
            RESTART LEVEL
          </button>
          <button className="btn" onClick={onSettings}>
            SETTINGS
          </button>
          <button className="btn" onClick={onQuit}>
            QUIT TO MENU
          </button>
        </div>
      </div>
    </div>
  )
}
