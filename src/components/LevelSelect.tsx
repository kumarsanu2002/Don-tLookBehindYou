import { LEVELS } from '../levels'

interface Props {
  highestUnlocked: number
  completedLevels: number[]
  onSelect: (id: number) => void
  onBack: () => void
}

export function LevelSelect({ highestUnlocked, completedLevels, onSelect, onBack }: Props) {
  return (
    <div className="overlay menu-overlay">
      <div className="menu-inner">
        <h2 className="panel-title">SELECT LEVEL</h2>
        <p className="tagline">Replay any level you have reached. Escaped levels are marked.</p>
        <div className="level-grid">
          {LEVELS.map((lvl) => {
            const unlocked = lvl.id <= highestUnlocked
            const cleared = completedLevels.includes(lvl.id)
            return (
              <button
                key={lvl.id}
                className={`level-card${unlocked ? '' : ' level-card-locked'}${cleared ? ' level-card-cleared' : ''}`}
                disabled={!unlocked}
                onClick={() => onSelect(lvl.id)}
              >
                <span className="level-card-num">{String(lvl.id).padStart(2, '0')}</span>
                <span className="level-card-name">{lvl.name}</span>
                <span className="level-card-status">{cleared ? 'ESCAPED' : unlocked ? 'REACHED' : 'LOCKED'}</span>
              </button>
            )
          })}
        </div>
        <div className="menu-buttons">
          <button className="btn" onClick={onBack}>
            BACK
          </button>
        </div>
      </div>
    </div>
  )
}
