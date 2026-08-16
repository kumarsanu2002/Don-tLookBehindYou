import { buildLevel, type LevelBlueprint } from '../game/LevelManager'

const level6: LevelBlueprint = {
  id: 6,
  name: 'Mirror Room',
  subtitle: 'Do not trust the glass.',
  briefing: [
    'You can see it in the glass even when it is behind you.',
    'The mirror is a way to keep watching.',
    'Find the key. Cross the room.',
    'To pass the gate, watch it in the mirror. Then back away slowly.',
  ],
  map: [
    '########################################',
    '#..........#.............#.............#',
    '#.P........#.....K.......#.............#',
    '#..........#.............#.............#',
    '#..........#.............#............M#',
    '#..........#.............#.............#',
    '#..........#.............#.............#',
    '#........................D........D....#',
    '#..............##....W...#.............#',
    '#..............##........#............E#',
    '#........................#.............#',
    '#........................#.............#',
    '#........................#....C........#',
    '########################################',
  ],
  creature: { speed: 95, chaseMul: 1.5, reactDelay: 0.35 },
  ambient: { darkness: 0.93, tint: 'rgba(14,16,28,0.3)', flickerIntensity: 1.2, whisperChance: 0.35 },
  prowl: [
    { x: 4 * 48 + 24, y: 3 * 48 + 24 },
    { x: 14 * 48 + 24, y: 10 * 48 + 24 },
    { x: 22 * 48 + 24, y: 4 * 48 + 24 },
    { x: 32 * 48 + 24, y: 11 * 48 + 24 },
  ],
  extras: [
    {
      id: 'note_mirror',
      type: 'note',
      x: 12 * 48 + 12,
      y: 11 * 48 + 12,
      w: 24,
      h: 24,
      text: 'The glass shows it true. The glass shows you true. Do not watch it too long, or it will learn to watch you back.',
    },
  ],
  overrides: {
    keys: {
      K_17_2: { keyId: 'key_1' },
    },
    mirrors: {
      M_38_4: { faceDir: 'west', active: true },
    },
    doors: {
      D_25_7: {
        locked: true,
        keyId: 'key_1',
        opensWith: ['key'],
        sourceIds: [],
        holdTime: 9999,
        slideDir: 'down',
      },
      D_34_7: {
        locked: false,
        opensWith: ['mirror'],
        sourceIds: ['M_38_4'],
        mode: 'any',
        holdTime: 3,
        slideDir: 'down',
      },
    },
  },
}

export default buildLevel(level6)
