import { buildLevel, type LevelBlueprint } from '../game/LevelManager'

const level5: LevelBlueprint = {
  id: 5,
  name: 'Two Doors',
  subtitle: 'It cannot be in two places. But neither can you.',
  briefing: [
    'Two doors. Two plates. Both must be pressed.',
    'It waits behind the first door.',
    'Lure it onto the plate. Pass. Then lure it again.',
    'Precision. Not panic.',
  ],
  map: [
    '##########################',
    '#........................#',
    '#........................#',
    '#..P.....................#',
    '#........................#',
    '#........................#',
    '############D#############',
    '#...........X............#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#...................W....#',
    '#........................#',
    '#........................#',
    '#...........X............#',
    '#........................#',
    '############D#############',
    '#........................#',
    '#........................#',
    '#........................#',
    '#.E...............C......#',
    '#........................#',
    '##########################',
  ],
  creature: { speed: 100, chaseMul: 1.6, reactDelay: 0.35 },
  ambient: { darkness: 0.93, flickerIntensity: 1.3, whisperChance: 0.3 },
  prowl: [
    { x: 5 * 48 + 24, y: 4 * 48 + 24 },
    { x: 20 * 48 + 24, y: 12 * 48 + 24 },
    { x: 5 * 48 + 24, y: 19 * 48 + 24 },
    { x: 20 * 48 + 24, y: 3 * 48 + 24 },
  ],
  overrides: {
    plates: {
      X_12_7: { requires: 'creature', targetId: 'D_12_6' },
      X_12_15: { requires: 'creature', targetId: 'D_12_17' },
    },
    doors: {
      D_12_6: {
        locked: false,
        opensWith: ['plate'],
        sourceIds: ['X_12_7'],
        mode: 'any',
        holdTime: 9999,
        slideDir: 'down',
      },
      D_12_17: {
        locked: false,
        opensWith: ['plate'],
        sourceIds: ['X_12_15'],
        mode: 'any',
        holdTime: 4,
        slideDir: 'up',
      },
    },
  },
}

export default buildLevel(level5)
