import type { SaveData } from '../types'
import { DEFAULT_KEY_BINDINGS } from '../types'

const SAVE_KEY = 'dlby_save_v1'
const SETTINGS_KEY = 'dlby_settings_v1'

const DEFAULT_SAVE: SaveData = {
  highestUnlockedLevel: 1,
  currentLevel: 1,
  completedLevels: [],
  soundVolume: 0.8,
  musicVolume: 0.6,
  achievements: [],
  storyNotesRead: [],
  secretEndingUnlocked: false,
  settings: {
    shake: true,
    particles: true,
    distortion: true,
    contrast: true,
    reducedFlicker: false,
    reduceMotion: false,
    colorblind: false,
    keybindings: { ...DEFAULT_KEY_BINDINGS },
  },
}

export class SaveManager {
  static load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return { ...DEFAULT_SAVE }
      const parsed = JSON.parse(raw)
      return this.merge(DEFAULT_SAVE, parsed)
    } catch {
      return { ...DEFAULT_SAVE }
    }
  }

  static save(data: SaveData): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    } catch {
      /* storage unavailable */
    }
  }

  static reset(): void {
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      /* noop */
    }
  }

  static merge(base: SaveData, partial: Partial<SaveData>): SaveData {
    const kb = { ...base.settings.keybindings, ...(partial.settings?.keybindings ?? {}) }
    return {
      ...base,
      ...partial,
      completedLevels: Array.isArray(partial.completedLevels)
        ? partial.completedLevels
        : base.completedLevels,
      achievements: Array.isArray(partial.achievements)
        ? partial.achievements
        : base.achievements,
      settings: { ...base.settings, ...(partial.settings ?? {}), keybindings: kb },
    }
  }

  static loadSettings(): SaveData['settings'] {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) {
        const kb = { ...DEFAULT_SAVE.settings.keybindings, ...(JSON.parse(raw).keybindings ?? {}) }
        return { ...DEFAULT_SAVE.settings, ...JSON.parse(raw), keybindings: kb }
      }
    } catch {
      /* noop */
    }
    return { ...DEFAULT_SAVE.settings }
  }

  static saveSettings(s: SaveData['settings']): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
    } catch {
      /* noop */
    }
  }
}
