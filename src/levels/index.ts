import type { LevelData } from '../types'
import level1 from './level1'
import level2 from './level2'
import level3 from './level3'
import level4 from './level4'
import level5 from './level5'
import level6 from './level6'
import level7 from './level7'
import level8 from './level8'
import level9 from './level9'
import level10 from './level10'
import level11 from './level11'
import level12 from './level12'
import level13 from './level13'

export const LEVELS: LevelData[] = [
  level1, level2, level3, level4, level5, level6, level7, level8,
  level9, level10, level11, level12, level13,
]

export const getLevel = (id: number): LevelData | null =>
  LEVELS.find((l) => l.id === id) ?? null

export const TOTAL_LEVELS = LEVELS.length
