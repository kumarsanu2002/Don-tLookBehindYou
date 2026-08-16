import { isTouchDevice } from '../device'
import { CraftedBy } from './CraftedBy'

interface Props {
  hasSave: boolean
  onPlay: () => void
  onContinue: () => void
  onLevels: () => void
  onSettings: () => void
  onHowTo: () => void
  onCredits: () => void
  onAchievements: () => void
}

export function MainMenu({ hasSave, onPlay, onContinue, onLevels, onSettings, onHowTo, onCredits, onAchievements }: Props) {
  return (
    <div className="overlay menu-overlay">
      <div className="menu-inner">
        <h1 className="title">
          DON'T LOOK
          <span className="title-sub">BEHIND YOU</span>
        </h1>
        <p className="tagline">It only moves when you aren't looking.</p>
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={onPlay}>
            PLAY
          </button>
          {hasSave && (
            <button className="btn" onClick={onContinue}>
              CONTINUE
            </button>
          )}
          <button className="btn" onClick={onLevels}>
            LEVELS
          </button>
          <button className="btn" onClick={onAchievements}>
            ACHIEVEMENTS
          </button>
          <button className="btn" onClick={onSettings}>
            SETTINGS
          </button>
          <button className="btn" onClick={onHowTo}>
            HOW TO PLAY
          </button>
          <button className="btn" onClick={onCredits}>
            CREDITS
          </button>
        </div>
        <p className="menu-hint">
          {isTouchDevice()
            ? 'Joystick to look &middot; W/A/S/D D-pad to move &middot; Tap to interact'
            : 'WASD / arrows to move &middot; mouse to look &middot; E to interact &middot; Shift to run &middot; Ctrl to crouch'}
        </p>
        <CraftedBy />
      </div>
    </div>
  )
}
