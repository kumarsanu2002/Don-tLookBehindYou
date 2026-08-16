import { buildLevel, type LevelBlueprint } from '../game/LevelManager'

const level1: LevelBlueprint = {
  id: 1,
  name: 'The Corridor',
  subtitle: 'Something is at the end of the hall.',
  briefing: [
    'Cold air. The lights are wrong.',
    'Move with WASD. Your eyes follow the mouse.',
    'Something is waiting at the end of the corridor.',
    'It only moves when you are not looking.',
  ],
  map: [
    '##############################################',
    '#......................................#.....#',
    '#.P....................................#.....#',
    '#.......##......##......##......##.....#.....#',
    '#.......##......##......##......##.....#.E...#',
    '#........................W.............D.....#',
    '#......................................#.....#',
    '#......................................#.....#',
    '#...........##......##......##......##.#.....#',
    '#...........##......##......##......##.#.....#',
    '#......................................#.....#',
    '#......................................#.....#',
    '##############################################',
  ],
  creature: { speed: 90, chaseMul: 1.5, reactDelay: 0.4 },
  ambient: { darkness: 0.9, flickerIntensity: 1, whisperChance: 0.2 },
  prowl: [
    { x: 10 * 48 + 24, y: 2 * 48 + 24 },
    { x: 24 * 48 + 24, y: 7 * 48 + 24 },
    { x: 39 * 48 + 24, y: 5 * 48 + 24 },
    { x: 30 * 48 + 24, y: 10 * 48 + 24 },
  ],
  extras: [
    {
      id: 'note_start',
      type: 'note',
      x: 10 * 48 + 12,
      y: 2 * 48 + 12,
      w: 24,
      h: 24,
      text: 'The first thing they teach you here: never look away. The second thing they teach you: you will.',
    },
    {
      id: 'note_hall',
      type: 'note',
      x: 22 * 48 + 12,
      y: 8 * 48 + 12,
      w: 24,
      h: 24,
      text: 'Some doors only open while it is close enough to take you. They built this place as a dare.',
    },
  ],
  overrides: {
    doors: {
      D_39_5: {
        locked: false,
        opensWith: [],
        sourceIds: [],
        holdTime: 4,
        slideDir: 'down',
        sensorRadius: 300,
      },
    },
  },
}

export default buildLevel(level1)
