import { useState, type KeyboardEvent } from 'react'
import type { KeyBindings, SaveData } from '../types'
import { DEFAULT_KEY_BINDINGS } from '../types'

interface Props {
  soundVolume: number
  musicVolume: number
  settings: SaveData['settings']
  onSound: (v: number) => void
  onMusic: (v: number) => void
  onSettings: (patch: Partial<SaveData['settings']>) => void
  onReset: () => void
  onBack: () => void
}

const ACTION_LABELS: Record<keyof KeyBindings, string> = {
  up: 'Move up',
  down: 'Move down',
  left: 'Move left',
  right: 'Move right',
  run: 'Run (hold)',
  crouch: 'Crouch (hold)',
  interact: 'Interact',
  pause: 'Pause',
  debug: 'Debug overlay',
}

function codeLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Arrow')) return 'Arrow ' + code.slice(5)
  switch (code) {
    case 'ShiftLeft':
      return 'Left Shift'
    case 'ShiftRight':
      return 'Right Shift'
    case 'ControlLeft':
      return 'Left Ctrl'
    case 'ControlRight':
      return 'Right Ctrl'
    case 'AltLeft':
      return 'Left Alt'
    case 'AltRight':
      return 'Right Alt'
    case 'Space':
      return 'Space'
    case 'Escape':
      return 'ESC'
    case 'Enter':
      return 'Enter'
    case 'Tab':
      return 'Tab'
    default:
      return code
  }
}

export function Settings({
  soundVolume,
  musicVolume,
  settings,
  onSound,
  onMusic,
  onSettings,
  onReset,
  onBack,
}: Props) {
  const [listening, setListening] = useState<keyof KeyBindings | null>(null)

  const bindings = settings.keybindings

  const handleKey = (action: keyof KeyBindings, e: KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.code === 'Escape') {
      setListening(null)
      return
    }
    const next = { ...bindings }
    const list = [...next[action]]
    if (!list.includes(e.code)) list.push(e.code)
    next[action] = list
    onSettings({ keybindings: next })
    setListening(null)
  }

  return (
    <div className="overlay">
      <div className="panel settings-panel">
        <h2 className="panel-title">SETTINGS</h2>
        <label className="slider-row">
          <span>Sound FX</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={soundVolume}
            onChange={(e) => onSound(parseFloat(e.target.value))}
          />
          <span className="pct">{Math.round(soundVolume * 100)}%</span>
        </label>
        <label className="slider-row">
          <span>Music</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={musicVolume}
            onChange={(e) => onMusic(parseFloat(e.target.value))}
          />
          <span className="pct">{Math.round(musicVolume * 100)}%</span>
        </label>
        <div className="checkbox-grid">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.shake}
              onChange={(e) => onSettings({ shake: e.target.checked })}
            />
            <span>Screen shake</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.particles}
              onChange={(e) => onSettings({ particles: e.target.checked })}
            />
            <span>Particles</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.distortion}
              onChange={(e) => onSettings({ distortion: e.target.checked })}
            />
            <span>Visual distortion</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.contrast}
              onChange={(e) => onSettings({ contrast: e.target.checked })}
            />
            <span>High contrast</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.reducedFlicker}
              onChange={(e) => onSettings({ reducedFlicker: e.target.checked })}
            />
            <span>Reduce flicker (accessibility)</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.reduceMotion}
              onChange={(e) => onSettings({ reduceMotion: e.target.checked })}
            />
            <span>Reduce motion (accessibility)</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.colorblind}
              onChange={(e) => onSettings({ colorblind: e.target.checked })}
            />
            <span>Colorblind shapes (accessibility)</span>
          </label>
        </div>

        <div className="bindings-header">
          <h3>CONTROLS</h3>
          <button
            className="btn btn-small"
            onClick={() => onSettings({ keybindings: { ...DEFAULT_KEY_BINDINGS } })}
          >
            RESET KEYS
          </button>
        </div>
        <div className="bindings-list">
          {(Object.keys(ACTION_LABELS) as (keyof KeyBindings)[]).map((action) => (
            <div key={action} className="binding-row">
              <span className="binding-label">{ACTION_LABELS[action]}</span>
              {listening === action ? (
                <button className="btn btn-small binding-listening" onKeyDown={(e) => handleKey(action, e)} autoFocus>
                  PRESS KEY (ESC to cancel)
                </button>
              ) : (
                <button className="btn btn-small" onClick={() => setListening(action)}>
                  {bindings[action].map(codeLabel).join(' / ') || 'UNBOUND'}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={onBack}>
            BACK
          </button>
          <button className="btn btn-danger" onClick={onReset}>
            RESET PROGRESS
          </button>
        </div>
      </div>
    </div>
  )
}
