export interface Vec2 {
  x: number
  y: number
}

export interface KeyBindings {
  up: string[]
  down: string[]
  left: string[]
  right: string[]
  run: string[]
  crouch: string[]
  interact: string[]
  pause: string[]
  debug: string[]
}

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  crouch: ['ControlLeft', 'ControlRight', 'KeyC'],
  interact: ['KeyE'],
  pause: ['Escape'],
  debug: ['F3'],
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type GameState =
  | 'MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'DEAD'
  | 'LEVEL_COMPLETE'
  | 'GAME_COMPLETE'

export type CreatureState =
  | 'IDLE'
  | 'VISIBLE'
  | 'HIDDEN'
  | 'CHASE'
  | 'SEARCH'
  | 'ATTACK'
  | 'STUNNED'

export type ObjectType =
  | 'door'
  | 'key'
  | 'switch'
  | 'pressurePlate'
  | 'generator'
  | 'battery'
  | 'mirror'
  | 'lever'
  | 'checkpoint'
  | 'exit'
  | 'laser'
  | 'spotlight'
  | 'note'
  | 'lamp'
  | 'crank'
  | 'radio'
  | 'decoy'
  | 'bell'

export interface BaseObject {
  id: string
  type: ObjectType
  x: number
  y: number
  w: number
  h: number
}

export interface DoorObject extends BaseObject {
  type: 'door'
  open: boolean
  locked: boolean
  keyId?: string
  /** list of trigger sources that open this door */
  opensWith: ('key' | 'switch' | 'plate' | 'lever' | 'generator' | 'laser' | 'mirror' | 'crank')[]
  /** ids of sources, matched to opensWith by index */
  sourceIds: string[]
  /** seconds the door stays open after trigger released */
  holdTime: number
  /** internal hold timer, 0 = closed */
  holdTimer: number
  /** how multiple sources combine: any source opens, or all must be active */
  mode: 'any' | 'all'
  /** direction the door slides when opening */
  slideDir: 'up' | 'down' | 'left' | 'right'
  /** if set, door opens while the creature is within this radius of the door center */
  sensorRadius?: number
}

export interface KeyObject extends BaseObject {
  type: 'key'
  keyId: string
  taken: boolean
}

export interface SwitchObject extends BaseObject {
  type: 'switch'
  active: boolean
  latch: boolean
  sourceId: string
}

export interface PressurePlateObject extends BaseObject {
  type: 'pressurePlate'
  active: boolean
  targetId: string
  /** who can activate this plate */
  requires: 'player' | 'creature' | 'any'
}

export interface GeneratorObject extends BaseObject {
  type: 'generator'
  powered: boolean
  batteryRequired: boolean
  targetId: string
}

export interface BatteryObject extends BaseObject {
  type: 'battery'
  taken: boolean
}

export interface MirrorObject extends BaseObject {
  type: 'mirror'
  /** face direction of the mirror: the side the reflection is viewed from */
  faceDir: 'north' | 'south' | 'east' | 'west'
  active: boolean
  /** whether this mirror redirects laser beams (diagonal 45° splitter) */
  reflectAxis?: 'slash' | 'backslash'
  /** if set, a reflected laser beam landing on this mirror opens its door */
  receiver?: boolean
  /** if set, interacting with the mirror rotates it (redirecting beams) */
  rotatable?: boolean
}

export interface LeverObject extends BaseObject {
  type: 'lever'
  active: boolean
  sourceId: string
}

export interface CheckpointObject extends BaseObject {
  type: 'checkpoint'
  active: boolean
}

export interface ExitObject extends BaseObject {
  type: 'exit'
  open: boolean
  targetId?: string
  /** if set, the exit only activates after staring at the creature within radius for the duration */
  requiresStare?: { radius: number; duration: number }
}

export interface LampObject extends BaseObject {
  type: 'lamp'
  flicker: number
  radius: number
  on: boolean
}

export interface LaserObject extends BaseObject {
  type: 'laser'
  axis: 'h' | 'v'
  fromId: string
  active: boolean
  /** whether the beam can be interrupted by the creature */
  interruptible: boolean
  blockedByCreature: boolean
  /** if set, the beam reflects off diagonal mirrors; a reflected beam stuns the creature */
  reflective?: boolean
  /** if set, true once a reflected beam reaches its receiver mirror (opens the exit) */
  completed?: boolean
}

export interface SpotlightObject extends BaseObject {
  type: 'spotlight'
  faceDir: 'north' | 'south' | 'east' | 'west'
  active: boolean
}

export interface NoteObject extends BaseObject {
  type: 'note'
  text: string
  /** 0-based index in the hidden lore arc; notes with a storyIndex are part of the secret story */
  storyIndex?: number
}

/** a valve / crank that must be held (~3s) while kept in view */
export interface CrankObject extends BaseObject {
  type: 'crank'
  active: boolean
  sourceId: string
  /** seconds of continuous, watched holding required */
  holdTime: number
}

/** a music box / radio that lures the Watcher away when switched on */
export interface RadioObject extends BaseObject {
  type: 'radio'
  on: boolean
  /** how loud its lure is (noise strength it emits) */
  lure: number
  cooldown: number
}

/** a throwable noise decoy: interact to hurl it; it clatters and draws the Watcher */
export interface DecoyObject extends BaseObject {
  type: 'decoy'
  thrown: boolean
  thrownPos: { x: number; y: number }
  /** seconds the clatter lingers */
  clatterTime: number
  clatterTimer: number
  /** seconds before it can be thrown again */
  cooldown: number
  cooldownTimer: number
}

/** the bell: the Watcher only moves while it tolls */
export interface BellObject extends BaseObject {
  type: 'bell'
  interval: number
  duration: number
  ringing: boolean
}

export type GameObject =
  | DoorObject
  | KeyObject
  | SwitchObject
  | PressurePlateObject
  | GeneratorObject
  | BatteryObject
  | MirrorObject
  | LeverObject
  | CheckpointObject
  | ExitObject
  | LaserObject
  | SpotlightObject
  | NoteObject
  | LampObject
  | CrankObject
  | RadioObject
  | DecoyObject
  | BellObject

export interface WallRect extends Rect {
  id: string
}

export interface CreatureConfig {
  /** base move speed when hidden, px/s */
  speed: number
  /** speed multiplier when chasing */
  chaseMul: number
  /** idle twitch intensity */
  twitch: number
  /** seconds it waits after losing sight before moving */
  reactDelay: number
}

export interface PlayerConfig {
  visionRadius: number
  visionHalfAngle: number
  speed: number
}

export interface AmbientConfig {
  darkness: number
  fogDensity: number
  fogColor: string
  tint: string
  flickerIntensity: number
  whisperChance: number
}

export interface LevelData {
  id: number
  name: string
  subtitle: string
  width: number
  height: number
  playerStart: Vec2
  playerFace: number
  creatureStart: Vec2
  walls: WallRect[]
  objects: GameObject[]
  creature?: Partial<CreatureConfig>
  ambient?: Partial<AmbientConfig>
  player?: Partial<PlayerConfig>
  briefing: string[]
  /** optional waypoint route the creature patrols while it cannot sense the player */
  prowl?: Vec2[]
  /** tiles used to build the level (internal) */
  map: string[]
  /** Blink Room: the screen blinks on this interval; during a blink the Watcher can move even while looked at */
  blink?: { interval: number; duration: number }
  /** Bell Tower: the Watcher is frozen except while the bell tolls on this interval */
  bell?: { interval: number; duration: number }
}

export interface SaveData {
  highestUnlockedLevel: number
  currentLevel: number
  completedLevels: number[]
  soundVolume: number
  musicVolume: number
  achievements: string[]
  /** ids of the lore-arc notes read (secret story thread) */
  storyNotesRead: string[]
  /** true once the secret ending has been unlocked */
  secretEndingUnlocked: boolean
  settings: {
    shake: boolean
    particles: boolean
    distortion: boolean
    contrast: boolean
    reducedFlicker: boolean
    reduceMotion: boolean
    colorblind: boolean
    keybindings: KeyBindings
  }
}

export interface DangerLevel {
  level: 'safe' | 'uncomfortable' | 'danger' | 'critical'
  factor: number
}

export interface GameCallbacks {
  onStateChange: (state: GameState) => void
  onLevelIntro: (data: { id: number; name: string; subtitle: string; briefing: string[] }) => void
  onDeath: (data: { checkpoint: Vec2; hasCheckpoint: boolean; reason: string }) => void
  onLevelComplete: (data: { levelId: number; nextLevel: number | null }) => void
  onGameComplete: (secret?: boolean) => void
  onSaveRequest?: () => void
  onInteractHint?: (text: string) => void
  onNote?: (data: { text: string }) => void
  onAchievement?: (id: string) => void
}
