import { buildLevel, type LevelBlueprint } from '../game/LevelManager'

const level10: LevelBlueprint = {
  id: 10,
  name: 'The Listener',
  subtitle: 'It does not see you. It hears you.',
  briefing: [
    'The dark here is complete. Your eyes are useless.',
    'It hunts by sound. Crouch to move unheard. Sprint and it will come.',
    'Radios are scattered through the room. Switch one on and it will follow the song — for a while.',
    'Lure it away. Then move. One breath at a time.',
  ],
  map: [
    '########################################',
    '#......................................#',
    '#.P....................................#',
    '#...................W..................#',
    '#.....R................................#',
    '#................................R.....#',
    '#......................................#',
    '#......................................#',
    '#.......##............##......##.......#',
    '#.......##............##......##.......#',
    '#.................C.................N..#',
    '#......................................#',
    '#...........R..........................#',
    '#...........................R..........#',
    '#......................................#',
    '#......................................#',
    '#...........##..........##.............#',
    '#...........##..........##.............#',
    '#................................E.....#',
    '#......................................#',
    '#......................................#',
    '########################################',
  ],
  creature: { speed: 108, chaseMul: 1.55, reactDelay: 0.3 },
  ambient: { darkness: 0.985, fogDensity: 0.8, fogColor: 'rgba(5,6,12,0.5)', tint: 'rgba(4,6,14,0.4)', flickerIntensity: 1.2, whisperChance: 0.5 },
  player: { visionRadius: 210, visionHalfAngle: 0.95, speed: 165 },
  prowl: [
    { x: 20 * 48 + 24, y: 3 * 48 + 24 },
    { x: 33 * 48 + 24, y: 6 * 48 + 24 },
    { x: 12 * 48 + 24, y: 12 * 48 + 24 },
    { x: 28 * 48 + 24, y: 14 * 48 + 24 },
    { x: 6 * 48 + 24, y: 5 * 48 + 24 },
    { x: 20 * 48 + 24, y: 3 * 48 + 24 },
  ],
  extras: [
    {
      id: 'lamp_listener_1',
      type: 'lamp',
      x: 20 * 48 + 12,
      y: 10 * 48 + 12,
      w: 24,
      h: 24,
      flicker: 0.2,
      radius: 150,
      on: true,
    },
  ],
  overrides: {
    notes: {
      N_36_10: {
        id: 'story_listener',
        storyIndex: 1,
        text: 'ENTRY 2 — It does not see in the dark any better than we do. It listens. We learned to move unheard, one breath at a time. Then we found the music box in the stores, and it followed the song like a moth. We stopped laughing at the metaphor when the box went quiet.',
      },
    },
    radios: {
      R_6_4: { lure: 1.15, cooldown: 2 },
      R_33_5: { lure: 1.15, cooldown: 2 },
      R_12_12: { lure: 1.2, cooldown: 2.5 },
      R_28_13: { lure: 1.2, cooldown: 2.5 },
    },
  },
}

export default buildLevel(level10)
