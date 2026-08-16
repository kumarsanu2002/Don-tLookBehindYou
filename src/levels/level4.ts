import { buildLevel, type LevelBlueprint } from '../game/LevelManager'

const level4: LevelBlueprint = {
  id: 4,
  name: 'The Dark Room',
  subtitle: 'The lights here were never real.',
  briefing: [
    'The room is darker than it should be.',
    'A battery. A generator. Both are far apart.',
    'Find the battery. Power the generator.',
    'The exit opens only when the machine breathes.',
  ],
  map: [
    '##########################################',
    '#....#..............................#....#',
    '#.PB.#..............................#.G..#',
    '#....#...........##.................#....#',
    '#....#...........##.................#....#',
    '#.C......##.........................#....#',
    '#........##..............................#',
    '#........................................#',
    '#........................##..............#',
    '#.....................W..##..............#',
    '#..................................##....#',
    '#..................................##....#',
    '#..........##.......................#....#',
    '#..........##.................##....#....#',
    '#.............................##....D..E.#',
    '#...................................#....#',
    '#...................................#....#',
    '##########################################',
  ],
  creature: { speed: 100, chaseMul: 1.6, reactDelay: 0.3 },
  ambient: { darkness: 0.95, tint: 'rgba(8,10,22,0.35)', flickerIntensity: 1.6, whisperChance: 0.35 },
  player: { visionRadius: 290, speed: 165 },
  prowl: [
    { x: 5 * 48 + 24, y: 3 * 48 + 24 },
    { x: 14 * 48 + 24, y: 11 * 48 + 24 },
    { x: 24 * 48 + 24, y: 4 * 48 + 24 },
    { x: 32 * 48 + 24, y: 12 * 48 + 24 },
  ],
  extras: [
    { id: 'lamp1', type: 'lamp', x: 12 * 48 + 12, y: 6 * 48 + 12, w: 24, h: 24, flicker: 0.35, radius: 280, on: true },
    { id: 'lamp2', type: 'lamp', x: 26 * 48 + 12, y: 14 * 48 + 12, w: 24, h: 24, flicker: 0.5, radius: 300, on: true },
    { id: 'lamp3', type: 'lamp', x: 8 * 48 + 12, y: 9 * 48 + 12, w: 24, h: 24, flicker: 0.3, radius: 240, on: true },
    { id: 'lamp4', type: 'lamp', x: 33 * 48 + 12, y: 6 * 48 + 12, w: 24, h: 24, flicker: 0.6, radius: 260, on: true },
    { id: 'lamp5', type: 'lamp', x: 17 * 48 + 12, y: 13 * 48 + 12, w: 24, h: 24, flicker: 0.4, radius: 250, on: true },
  ],
  overrides: {
    generators: {
      G_38_2: { batteryRequired: true, targetId: 'D_36_14' },
    },
    doors: {
      D_36_14: {
        locked: false,
        opensWith: ['generator'],
        sourceIds: ['G_38_2'],
        mode: 'any',
        holdTime: 9999,
        slideDir: 'up',
      },
    },
  },
}

export default buildLevel(level4)
