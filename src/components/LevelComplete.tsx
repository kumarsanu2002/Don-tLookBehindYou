import { TOTAL_LEVELS, getLevel } from '../levels'

interface Props {
  levelId: number
  nextLevel: number | null
  onNext: () => void
  onMenu: () => void
}

export function LevelComplete({ levelId, nextLevel, onNext, onMenu }: Props) {
  const lvl = getLevel(levelId)
  return (
    <div className="overlay">
      <div className="panel complete-panel">
        <p className="complete-level">
          LEVEL {levelId} / {TOTAL_LEVELS}
        </p>
        <h2 className="panel-title">IT KNEW YOU WERE WATCHING.</h2>
        {lvl && <p className="complete-subtitle">{lvl.subtitle}</p>}
        {nextLevel && nextLevel <= TOTAL_LEVELS ? (
          <div className="menu-buttons">
            <button className="btn btn-primary" onClick={onNext}>
              CONTINUE TO LEVEL {nextLevel}
            </button>
            <button className="btn" onClick={onMenu}>
              MENU
            </button>
          </div>
        ) : (
          <div className="menu-buttons">
            <button className="btn btn-primary" onClick={onMenu}>
              BACK TO MENU
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
