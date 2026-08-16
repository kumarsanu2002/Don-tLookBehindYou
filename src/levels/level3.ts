import { buildLevel, type LevelBlueprint } from '../game/LevelManager'

const level3: LevelBlueprint = {
  id: 3,
  name: 'The Pressure Plate',
  subtitle: 'Sometimes you need it to come to you.',
  briefing: [
    'Two plates. One door. You cannot hold them both.',
    'Stand on the plate and do not look.',
    'Let it walk to you. Let it cross the other plate.',
    'When the door opens, do not hesitate.',
  ],
  map: [
    '#################################',
    '#........#...........#..........#',
    '#........#...........#..........#',
    '#........#.....C.....#..........#',
    '#........#...........#..........#',
    '#..P.....#...........D..........#',
    '#....X...X...........#..........#',
    '#........#...........#.....E....#',
    '#........#......W....#..........#',
    '#........#...........#..........#',
    '#........#...........#..........#',
    '#........#...........#..........#',
    '#################################',
  ],
  creature: { speed: 88, chaseMul: 1.5, reactDelay: 0.4 },
  ambient: { darkness: 0.93, flickerIntensity: 1.4, whisperChance: 0.3 },
  prowl: [
    { x: 3 * 48 + 24, y: 4 * 48 + 24 },
    { x: 12 * 48 + 24, y: 10 * 48 + 24 },
    { x: 21 * 48 + 24, y: 3 * 48 + 24 },
    { x: 28 * 48 + 24, y: 7 * 48 + 24 },
  ],
  extras: [
    {
      id: 'note_plates',
      type: 'note',
      x: 2 * 48 + 12,
      y: 4 * 48 + 12,
      w: 24,
      h: 24,
      text: 'It steps where you look. It steps where you do not. One plate for you. One plate for it. Do not swap.',
    },
  ],
  overrides: {
    plates: {
      X_5_6: { requires: 'player', targetId: 'D_21_5' },
      X_9_6: { requires: 'creature', targetId: 'D_21_5' },
    },
    doors: {
      D_21_5: {
        locked: false,
        opensWith: ['plate'],
        sourceIds: ['X_5_6', 'X_9_6'],
        mode: 'all',
        holdTime: 6,
        slideDir: 'right',
      },
    },
  },
}

export default buildLevel(level3)
