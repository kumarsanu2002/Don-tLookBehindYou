import type {
  AmbientConfig,
  BatteryObject,
  BellObject,
  CheckpointObject,
  CreatureConfig,
  CrankObject,
  DecoyObject,
  DoorObject,
  ExitObject,
  GameObject,
  GeneratorObject,
  KeyObject,
  LampObject,
  LaserObject,
  LeverObject,
  LevelData,
  MirrorObject,
  NoteObject,
  PlayerConfig,
  PressurePlateObject,
  RadioObject,
  Rect,
  SpotlightObject,
  SwitchObject,
  Vec2,
  WallRect,
} from '../types'

const TILE = 48

export interface LevelBlueprint {
  id: number
  name: string
  subtitle: string
  briefing: string[]
  map: string[]
  creature?: Partial<CreatureConfig>
  ambient?: Partial<AmbientConfig>
  playerFace?: number
  player?: Partial<PlayerConfig>
  /** optional waypoint route the creature patrols while it cannot sense the player */
  prowl?: Vec2[]
  /** extra objects placed in absolute coordinates */
  extras?: GameObject[]
  /** extra walls in absolute coordinates */
  extraWalls?: Rect[]
  /** object property overrides, keyed by object id */
  overrides?: {
    doors?: Record<string, Partial<DoorObject>>
    keys?: Record<string, Partial<KeyObject>>
    plates?: Record<string, Partial<PressurePlateObject>>
    generators?: Record<string, Partial<GeneratorObject>>
    lasers?: Record<string, Partial<LaserObject>>
    mirrors?: Record<string, Partial<MirrorObject>>
    switches?: Record<string, Partial<SwitchObject>>
    levers?: Record<string, Partial<LeverObject>>
    notes?: Record<string, Partial<NoteObject>>
    spotlights?: Record<string, Partial<SpotlightObject>>
    exits?: Record<string, Partial<ExitObject>>
    batteries?: Record<string, Partial<BatteryObject>>
    lamps?: Record<string, Partial<LampObject>>
    cranks?: Record<string, Partial<CrankObject>>
    radios?: Record<string, Partial<RadioObject>>
    decoys?: Record<string, Partial<DecoyObject>>
    bells?: Record<string, Partial<BellObject>>
  }
  /** Blink Room config */
  blink?: { interval: number; duration: number }
  /** Bell Tower config */
  bell?: { interval: number; duration: number }
}

export interface ParsedLevel {
  width: number
  height: number
  playerStart: { x: number; y: number }
  creatureStart: { x: number; y: number }
  walls: WallRect[]
  objects: GameObject[]
}

const DEFAULT_CREATURE: CreatureConfig = {
  speed: 92,
  chaseMul: 1.55,
  twitch: 1,
  reactDelay: 0.35,
}

const DEFAULT_AMBIENT: AmbientConfig = {
  darkness: 0.93,
  fogDensity: 0.5,
  fogColor: 'rgba(40,40,50,0.25)',
  tint: 'transparent',
  flickerIntensity: 1,
  whisperChance: 0.15,
}

export function parseBlueprint(bp: LevelBlueprint): ParsedLevel {
  const rows = bp.map
  const cols = rows.reduce((max, r) => Math.max(max, r.length), 0)
  const width = cols * TILE
  const height = rows.length * TILE
  const walls: WallRect[] = []
  const objects: GameObject[] = []
  let playerStart = { x: TILE * 2, y: TILE * 2 }
  let creatureStart = { x: width - TILE * 2, y: TILE * 2 }

  const addRect = (x: number, y: number, w: number, h: number): Rect => ({
    x: x * TILE,
    y: y * TILE,
    w: w * TILE,
    h: h * TILE,
  })

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]
      const px = c * TILE
      const py = r * TILE
      const id = `${ch}_${c}_${r}`
      switch (ch) {
        case '#': {
          walls.push({ ...addRect(c, r, 1, 1), id })
          break
        }
        case 'P':
          playerStart = { x: px + TILE / 2, y: py + TILE / 2 }
          break
        case 'W':
          creatureStart = { x: px + TILE / 2, y: py + TILE / 2 }
          break
        case 'D':
          objects.push({
            id,
            type: 'door',
            ...addRect(c, r, 1, 1),
            open: false,
            locked: false,
            opensWith: [],
            sourceIds: [],
            holdTime: 9999,
            holdTimer: 0,
            mode: 'any',
            slideDir: 'down',
          } as DoorObject)
          break
        case 'K':
          objects.push({
            id,
            type: 'key',
            ...addRect(c, r, 1, 1),
            keyId: 'key_1',
            taken: false,
          } as KeyObject)
          break
        case 'S':
          objects.push({
            id,
            type: 'switch',
            ...addRect(c, r, 1, 1),
            active: false,
            latch: true,
            sourceId: id,
          } as SwitchObject)
          break
        case 'X':
          objects.push({
            id,
            type: 'pressurePlate',
            ...addRect(c, r, 1, 1),
            active: false,
            targetId: '',
            requires: 'any',
          } as PressurePlateObject)
          break
        case 'G':
          objects.push({
            id,
            type: 'generator',
            ...addRect(c, r, 1, 1),
            powered: false,
            batteryRequired: true,
            targetId: '',
          } as GeneratorObject)
          break
        case 'B':
          objects.push({
            id,
            type: 'battery',
            ...addRect(c, r, 1, 1),
            taken: false,
          } as BatteryObject)
          break
        case 'M':
          objects.push({
            id,
            type: 'mirror',
            ...addRect(c, r, 1, 1),
            faceDir: 'south',
            active: true,
          } as MirrorObject)
          break
        case 'L':
          objects.push({
            id,
            type: 'lever',
            ...addRect(c, r, 1, 1),
            active: false,
            sourceId: id,
          } as LeverObject)
          break
        case 'C':
          objects.push({
            id,
            type: 'checkpoint',
            ...addRect(c, r, 1, 1),
            active: false,
          } as CheckpointObject)
          break
        case 'E':
          objects.push({
            id,
            type: 'exit',
            ...addRect(c, r, 1, 1),
            open: true,
          } as ExitObject)
          break
        case 'Z':
          objects.push({
            id,
            type: 'laser',
            ...addRect(c, r, 1, 1),
            axis: 'v',
            fromId: '',
            active: true,
            interruptible: true,
            blockedByCreature: false,
          } as LaserObject)
          break
        case 'T':
          objects.push({
            id,
            type: 'spotlight',
            ...addRect(c, r, 1, 1),
            faceDir: 'south',
            active: true,
          } as SpotlightObject)
          break
        case 'N':
          objects.push({
            id,
            type: 'note',
            ...addRect(c, r, 1, 1),
            text: '',
          } as NoteObject)
          break
        case 'F':
          objects.push({
            id,
            type: 'lamp',
            ...addRect(c, r, 1, 1),
            flicker: 0.3,
            radius: 260,
            on: true,
          } as LampObject)
          break
        case 'V':
          objects.push({
            id,
            type: 'crank',
            ...addRect(c, r, 1, 1),
            active: false,
            sourceId: id,
            holdTime: 3,
          } as CrankObject)
          break
        case 'R':
          objects.push({
            id,
            type: 'radio',
            ...addRect(c, r, 1, 1),
            on: false,
            lure: 1,
            cooldown: 0,
          } as RadioObject)
          break
        case 'Y':
          objects.push({
            id,
            type: 'decoy',
            ...addRect(c, r, 1, 1),
            thrown: false,
            thrownPos: { x: 0, y: 0 },
            clatterTime: 3.5,
            clatterTimer: 0,
            cooldown: 6,
            cooldownTimer: 0,
          } as DecoyObject)
          break
        case 'Q':
          objects.push({
            id,
            type: 'bell',
            ...addRect(c, r, 1, 1),
            interval: 5,
            duration: 1.2,
            ringing: false,
          } as BellObject)
          break
        default:
          break
      }
    }
  }

  if (bp.extras) objects.push(...bp.extras)
  const extraWalls: WallRect[] = (bp.extraWalls ?? []).map((r, i) => ({ ...r, id: `extra_${i}` }))

  return {
    width,
    height,
    playerStart,
    creatureStart,
    walls: walls.concat(extraWalls),
    objects,
  }
}

export function buildLevel(bp: LevelBlueprint): LevelData {
  const parsed = parseBlueprint(bp)
  const applyOverrides = <T extends GameObject>(obj: T, ov?: Record<string, Partial<T>>): T => {
    if (!ov) return obj
    const o = ov[obj.id]
    return o ? { ...obj, ...o } : obj
  }
  const objects = parsed.objects.map((o) => {
    switch (o.type) {
      case 'door':
        return applyOverrides(o, bp.overrides?.doors)
      case 'key':
        return applyOverrides(o, bp.overrides?.keys)
      case 'pressurePlate':
        return applyOverrides(o, bp.overrides?.plates)
      case 'generator':
        return applyOverrides(o, bp.overrides?.generators)
      case 'laser':
        return applyOverrides(o, bp.overrides?.lasers)
      case 'mirror':
        return applyOverrides(o, bp.overrides?.mirrors)
      case 'switch':
        return applyOverrides(o, bp.overrides?.switches)
      case 'lever':
        return applyOverrides(o, bp.overrides?.levers)
      case 'note':
        return applyOverrides(o, bp.overrides?.notes)
      case 'spotlight':
        return applyOverrides(o, bp.overrides?.spotlights)
      case 'exit':
        return applyOverrides(o, bp.overrides?.exits)
      case 'battery':
        return applyOverrides(o, bp.overrides?.batteries)
      case 'lamp':
        return applyOverrides(o, bp.overrides?.lamps)
      case 'crank':
        return applyOverrides(o, bp.overrides?.cranks)
      case 'radio':
        return applyOverrides(o, bp.overrides?.radios)
      case 'decoy':
        return applyOverrides(o, bp.overrides?.decoys)
      case 'bell':
        return applyOverrides(o, bp.overrides?.bells)
      default:
        return o
    }
  })
  return {
    id: bp.id,
    name: bp.name,
    subtitle: bp.subtitle,
    width: parsed.width,
    height: parsed.height,
    playerStart: parsed.playerStart,
    playerFace: bp.playerFace ?? 0,
    creatureStart: parsed.creatureStart,
    walls: parsed.walls,
    objects,
    creature: { ...DEFAULT_CREATURE, ...bp.creature },
    ambient: { ...DEFAULT_AMBIENT, ...bp.ambient },
    player: bp.player,
    prowl: bp.prowl,
    briefing: bp.briefing,
    map: bp.map,
    blink: bp.blink,
    bell: bp.bell,
  }
}

export const TILE_SIZE = TILE
