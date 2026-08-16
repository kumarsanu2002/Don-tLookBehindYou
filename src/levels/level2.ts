import { buildLevel, type LevelBlueprint } from '../game/LevelManager'

const level2: LevelBlueprint = {
  id: 2,
  name: 'The Locked Door',
  subtitle: 'Keys were never meant to be this close to it.',
  briefing: [
    'The door is locked. The key is somewhere ahead.',
    'Walk through the room. Do not run.',
    'If you keep watching it, it cannot move.',
    'But you cannot watch it and search at the same time.',
  ],
  map: [
    '############################################',
    '#...........#...........#..................#',
    '#.P.........#....K......#..................#',
    '#...........#...........#........#.........#',
    '#...........#...........#........#.........#',
    '#...........#...........#........#.........#',
    '#..............##.......#........#.........#',
    '#..............##.......D........#.........#',
    '#.......................#........#.........#',
    '#.......................#........#.........#',
    '#......W................#........#.........#',
    '#.......................#........#.........#',
    '#.......................#.....C..........E.#',
    '#.......................#..................#',
    '############################################',
  ],
  creature: { speed: 95, chaseMul: 1.55, reactDelay: 0.35 },
  ambient: { darkness: 0.92, flickerIntensity: 1.2, whisperChance: 0.25 },
  prowl: [
    { x: 4 * 48 + 24, y: 2 * 48 + 24 },
    { x: 14 * 48 + 24, y: 6 * 48 + 24 },
    { x: 24 * 48 + 24, y: 3 * 48 + 24 },
    { x: 30 * 48 + 24, y: 10 * 48 + 24 },
  ],
  extras: [
    {
      id: 'note_keys',
      type: 'note',
      x: 12 * 48 + 12,
      y: 3 * 48 + 12,
      w: 24,
      h: 24,
      text: 'The keys here are all the same. They open what they are placed beside. It is the only mercy left in this place.',
    },
    {
      id: 'note_deaths',
      type: 'note',
      x: 32 * 48 + 12,
      y: 11 * 48 + 12,
      w: 24,
      h: 24,
      text: 'I stopped counting the deaths. It does not seem to mind. It just waits a little closer each time.',
    },
  ],
  overrides: {
    keys: {
      K_17_2: { keyId: 'key_1' },
    },
    doors: {
      D_24_7: {
        locked: true,
        keyId: 'key_1',
        opensWith: ['key'],
        sourceIds: [],
        holdTime: 9999,
        slideDir: 'down',
      },
    },
  },
}

export default buildLevel(level2)
