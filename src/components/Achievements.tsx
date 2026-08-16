import { ACHIEVEMENTS } from '../game/Achievements'

interface Props {
  unlocked: string[]
  onBack: () => void
}

export function Achievements({ unlocked, onBack }: Props) {
  const unlockedSet = new Set(unlocked)
  const count = unlocked.length

  return (
    <div className="overlay">
      <div className="panel achievements-panel">
        <h2 className="panel-title">ACHIEVEMENTS</h2>
        <p className="achievements-count">
          {count} / {ACHIEVEMENTS.length} unlocked
        </p>
        <div className="achievements-list">
          {ACHIEVEMENTS.map((a) => {
            const isUnlocked = unlockedSet.has(a.id)
            return (
              <div key={a.id} className={`achievement-row${isUnlocked ? ' is-unlocked' : ' is-locked'}`}>
                <div className="achievement-name">
                  {isUnlocked || !a.hidden ? a.name : '???'}
                  {isUnlocked && <span className="achievement-check">&#10003;</span>}
                </div>
                <div className="achievement-desc">
                  {isUnlocked || !a.hidden ? a.desc : 'Keep playing. You will know it when you see it.'}
                </div>
              </div>
            )
          })}
        </div>
        <button className="btn btn-primary" onClick={onBack}>
          BACK
        </button>
      </div>
    </div>
  )
}
