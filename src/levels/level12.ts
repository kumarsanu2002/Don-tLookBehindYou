import { buildLevel, type LevelBlueprint } from '../game/LevelManager'

const level12: LevelBlueprint = {
  id: 12,
  name: 'The Bell Tower',
  subtitle: 'The bell is the only clock it obeys.',
  briefing: [
    'The tower bell tolls. It is the only sound it answers to.',
    'While the bell rings, it moves. When the bell is silent, it waits — frozen, no matter what it senses.',
    'Move while it is still. Freeze when the bell sounds.',
    'The key is at the top of the tower. The exit is at the bottom. Count the tolls.',
  ],
  map: [
    '####################################',
    '#..................................#',
    '#.P.....Q..........................#',
    '#..................................#',
    '#..................................#',
    '#..................................#',
    '#.............##............K......#',
    '#.............##...................#',
    '#.........W........................#',
    '#..................................#',
    '#.....N.......................##...#',
    '#.............................##...#',
    '#.......##..C...........##.........#',
    '#.......##..............##.........#',
    '#..................................#',
    '#..................................#',
    '#...##........##........#..........#',
    '#...##........##........#..........#',
    '#.......................D.E........#',
    '#.......................#..........#',
    '#.......................#..........#',
    '#..................................#',
    '#..................................#',
    '####################################',
  ],
  bell: { interval: 5, duration: 1.2 },
  creature: { speed: 110, chaseMul: 1.5, reactDelay: 0.25 },
  ambient: { darkness: 0.94, tint: 'rgba(14,14,22,0.3)', flickerIntensity: 1.2, whisperChance: 0.35 },
  player: { speed: 168 },
  prowl: [
    { x: 9 * 48 + 24, y: 8 * 48 + 24 },
    { x: 14 * 48 + 24, y: 7 * 48 + 24 },
    { x: 27 * 48 + 24, y: 9 * 48 + 24 },
    { x: 20 * 48 + 24, y: 14 * 48 + 24 },
    { x: 9 * 48 + 24, y: 8 * 48 + 24 },
  ],
  extras: [
    {
      id: 'lamp_tower_1',
      type: 'lamp',
      x: 14 * 48 + 12,
      y: 12 * 48 + 12,
      w: 24,
      h: 24,
      flicker: 0.35,
      radius: 260,
      on: true,
    },
  ],
  overrides: {
    keys: {
      K_28_6: { keyId: 'key_1' },
    },
    notes: {
      N_6_10: {
        id: 'story_bell',
        storyIndex: 3,
        text: 'ENTRY 4 — The bell is the only clock it obeys. When it tolls, it moves. When it is silent, it waits. The tower was supposed to be the lock. We did not understand until too late: the bell was never counting for us. It was counting for the last toll of all.',
      },
    },
    doors: {
      D_24_18: {
        locked: true,
        keyId: 'key_1',
        opensWith: ['key'],
        sourceIds: [],
        holdTime: 9999,
        slideDir: 'up',
      },
    },
  },
}

export default buildLevel(level12)
