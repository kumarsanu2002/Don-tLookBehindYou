import { buildLevel, type LevelBlueprint } from '../game/LevelManager'

const level11: LevelBlueprint = {
  id: 11,
  name: 'Hall of Mirrors',
  subtitle: 'It casts no reflection. That is why the glass unnerves it.',
  briefing: [
    'A maze of glass. Every mirror shows the same lie.',
    'Some mirrors are false — hung where no reflection can ever fall. Do not trust them.',
    'A beam of light waits at the top. Turn the splitter so it threads the maze.',
    'When the beam reaches the receiver, the exit unseals.',
    'And do not forget: in the glass, it can see you when you cannot see it.',
  ],
  map: [
    '########################################',
    '#......................................#',
    '#.P....................................#',
    '#.......Z..............................#',
    '#.............N.....W..................#',
    '#.............................M........#',
    '#...........##............##...........#',
    '#...........##............##...........#',
    '#.................................##...#',
    '#.................................##...#',
    '#.......M.............M.........M......#',
    '#......................................#',
    '#...M...........##.....................#',
    '#...............##.....................#',
    '#.....##....................##.........#',
    '#.....##....................##....M....#',
    '#..................................#...#',
    '#.....................M............#...#',
    '#..................................D.E.#',
    '#..................................#...#',
    '#..................................#...#',
    '########################################',
  ],
  creature: { speed: 104, chaseMul: 1.55, reactDelay: 0.35 },
  ambient: { darkness: 0.93, tint: 'rgba(18,20,32,0.3)', flickerIntensity: 1.2, whisperChance: 0.3 },
  player: { speed: 166 },
  prowl: [
    { x: 20 * 48 + 24, y: 4 * 48 + 24 },
    { x: 30 * 48 + 24, y: 5 * 48 + 24 },
    { x: 22 * 48 + 24, y: 12 * 48 + 24 },
    { x: 12 * 48 + 24, y: 15 * 48 + 24 },
    { x: 20 * 48 + 24, y: 4 * 48 + 24 },
  ],
  overrides: {
    lasers: {
      Z_8_3: { axis: 'v', reflective: true, interruptible: false, active: true },
    },
    mirrors: {
      M_8_10: { faceDir: 'west', active: true, rotatable: true },
      M_22_10: { faceDir: 'south', active: true, reflectAxis: 'backslash' },
      M_22_17: { faceDir: 'north', active: true, receiver: true },
      M_32_10: { active: false, faceDir: 'west' },
      M_30_5: { faceDir: 'south', active: true },
      M_4_12: { faceDir: 'east', active: true },
      M_34_15: { faceDir: 'north', active: true },
    },
    notes: {
      N_14_4: {
        id: 'story_mirrors',
        storyIndex: 2,
        text: 'ENTRY 3 — It casts no reflection. That is why the glass unnerves it. We built the maze to keep it seen, and it learned to hide behind the false mirrors — the ones we hung where no reflection could ever fall. It waits behind them now. All of them.',
      },
    },
    doors: {
      D_35_18: {
        locked: false,
        opensWith: ['laser'],
        sourceIds: ['Z_8_3'],
        mode: 'any',
        holdTime: 9999,
        slideDir: 'up',
      },
    },
  },
}

export default buildLevel(level11)
