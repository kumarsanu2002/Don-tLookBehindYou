import type {
  GameCallbacks,
  GameState,
  GameObject,
  LevelData,
  Rect,
  SaveData,
  Vec2,
} from '../types'
import { AudioManager } from './AudioManager'
import { Camera } from './Camera'
import { castRay, clamp, lineOfSight, pointInRect, rayRectHit, rectCenter, rectsOverlap } from './Collision'
import { Creature } from './Creature'
import { Input } from './Input'
import { Lighting, type LightSource, type VisionState } from './Lighting'
import { ParticleSystem } from './ParticleSystem'
import { Pathfinder } from './Pathfinding'
import { GRAZE_COST, Player } from './Player'
import { Renderer, type RenderState } from './Renderer'
import { SaveManager } from './SaveManager'
import { getLevel, TOTAL_LEVELS } from '../levels'
import { STORY_NOTES } from './Story'

const DEFAULT_VISION = { radius: 340, halfAngle: 0.65, intensity: 1 }
const PLAYER_RADIUS = 14
const ATTACK_RANGE = 72
const CHASE_DIST = 300
const INTERACT_RADIUS = 78
/** how much vision closes in while the creature is right on top of you */
const VISION_TUNNEL_MAX = 0.24

interface FacingDir {
  x: number
  y: number
}

const FACE: Record<string, FacingDir> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
}

export class Game {
  state: GameState = 'MENU'
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private worldCanvas: HTMLCanvasElement
  private worldCtx: CanvasRenderingContext2D
  private cbs: GameCallbacks
  private save: SaveData
  private audio = new AudioManager()
  private input!: Input
  private camera = new Camera()
  private lighting!: Lighting
  private renderer = new Renderer()
  private particles = new ParticleSystem()
  private pathfinder: Pathfinder | null = null
  private player!: Player
  private creature!: Creature

  private level: LevelData | null = null
  private levelIndex = 0
  private time = 0
  private rafId = 0
  private lastTs = 0
  private running = false
  private destroyed = false

  private introActive = true
  private keysInv = new Set<string>()
  private batteries = 0
  private activeCheckpoint: Vec2 | null = null
  private activeCheckpoints = new Set<string>()
  private checkpointFlash = 0
  private deathTimer = 0
  private deathReason = ''
  private deathFade = 0
  private deathOverlayShown = false
  private stareTimer = 0
  private winBeam = 0
  private interactTarget: GameObject | null = null
  private debugMode = false

  private dangerFactor = 0
  private creatureStepTimer = 0
  private creatureBurstTimer = 0
  private eventTimer = 6
  private flickerBoost = 0
  private creatureVisible = false
  private creatureMirrorIds: string[] = []
  private mirrorHintIds: string[] = []
  private creatureCloseHint = false
  private doorProgress: Record<string, number> = {}
  private doorWobble: Record<string, number> = {}
  private doorInit: Record<string, { locked: boolean }> = {}
  private laserBlocked: Record<string, boolean> = {}
  private spotlightStunned: Record<string, boolean> = {}
  private settings: SaveData['settings']

  // Blink Room: the screen flickers on an interval; during a blink the Watcher moves even while looked at
  private blinkTimer = 0
  private blinkActive = false
  private blinkFlicker = 0
  // Bell Tower: the Watcher is frozen except while the bell tolls
  private bellTimer = 0
  private bellRinging = false
  private bellRingT = 0
  private bellObjectId = ''
  // hold-to-interact (crank / valve)
  private holdProgress: Record<string, number> = {}
  private holdTargetId: string | null = null
  // lure noise sources broadcast to the creature each frame
  private noiseSources: { x: number; y: number; strength: number }[] = []
  // peripheral vision warning
  private peripheralActive = false
  private peripheralAngle = 0
  // reflected laser beams (Hall of Mirrors)
  private laserReflectedSegments: Record<string, { x0: number; y0: number; x1: number; y1: number }[]> = {}
  private radioTuneTimer = 0
  // hidden lore arc
  private storyReadSet = new Set<string>()

  // vision base (level defaults) + dynamic modifiers
  private visionBase = { radius: DEFAULT_VISION.radius, halfAngle: DEFAULT_VISION.halfAngle }

  // per-run achievement tracking
  private runNoGraze = true
  private runNoLook = true
  private runNoSense = true
  private runStartTime = 0
  private notesRead = new Set<string>()
  private notesTotal = 0

  // vocalization / scream loop timers
  private screamTimer = 12 + Math.random() * 10
  private growlTimer = 0

  constructor(canvas: HTMLCanvasElement, save: SaveData, cbs: GameCallbacks) {
    this.canvas = canvas
    this.cbs = cbs
    this.save = save
    this.settings = save.settings
    this.ctx = canvas.getContext('2d')!
    this.worldCanvas = document.createElement('canvas')
    this.worldCtx = this.worldCanvas.getContext('2d')!
    this.input = new Input(canvas)
    if (this.settings?.keybindings) this.input.setBindings(this.settings.keybindings)
    this.lighting = new Lighting(canvas.width || 960, canvas.height || 540, Math.random() * 1000)
    this.audio.setVolumes(save.soundVolume, save.musicVolume)
    this.resize()
    window.addEventListener('resize', this.resize)
    this.onWindowBlur = (): void => {
      // auto-pause when the window loses focus so the creature cannot hunt while idle
      if (this.state === 'PLAYING') this.setPaused(true)
    }
    window.addEventListener('blur', this.onWindowBlur)
  }

  private onWindowBlur: () => void = () => {}

  // ---------------------------------------------------------------
  // public API
  // ---------------------------------------------------------------

  newGame(): void {
    this.save.highestUnlockedLevel = 1
    this.save.currentLevel = 1
    this.save.completedLevels = []
    SaveManager.save(this.save)
    this.loadLevel(1)
  }

  continueGame(): void {
    const target = this.save.currentLevel || 1
    this.loadLevel(target)
  }

  startLevel(id: number): void {
    this.loadLevel(id)
  }

  loadLevel(id: number): void {
    const lvl = getLevel(id)
    if (!lvl) return
    this.audio.init()
    this.level = lvl
    this.levelIndex = lvl.id
    this.time = 0
    this.deathTimer = 0
    this.deathFade = 0
    this.deathOverlayShown = false
    this.deathReason = ''
    this.stareTimer = 0
    this.winBeam = 0
    this.doorProgress = {}
    this.doorWobble = {}
    this.laserBlocked = {}
    this.spotlightStunned = {}
    this.doorInit = {}
    this.blinkTimer = 0
    this.blinkActive = false
    this.blinkFlicker = 0
    this.bellTimer = 0
    this.bellRinging = false
    this.bellRingT = 0
    this.bellObjectId = ''
    this.holdProgress = {}
    this.holdTargetId = null
    this.laserReflectedSegments = {}
    this.radioTuneTimer = 0
    this.peripheralActive = false
    this.noiseSources = []
    this.storyReadSet = new Set(this.save.storyNotesRead ?? [])
    for (const o of lvl.objects) {
      if (o.type === 'door') this.doorInit[o.id] = { locked: o.locked }
    }
    this.keysInv = new Set()
    this.batteries = 0
    this.activeCheckpoint = null
    this.activeCheckpoints = new Set()
    this.checkpointFlash = 0
    this.creatureMirrorIds = []
    this.creatureVisible = false
    this.creatureCloseHint = false
    this.flickerBoost = 0
    this.introActive = true
    this.creatureBurstTimer = 0
    this.screamTimer = 10 + Math.random() * 14
    this.growlTimer = 0
    this.runNoGraze = true
    this.runNoLook = true
    this.runNoSense = true
    this.notesRead = new Set()
    this.notesTotal = lvl.objects.filter((o) => o.type === 'note').length
    this.runStartTime = this.time

    const vision = {
      radius: lvl.player?.visionRadius ?? DEFAULT_VISION.radius,
      halfAngle: lvl.player?.visionHalfAngle ?? DEFAULT_VISION.halfAngle,
      intensity: 1,
    }
    this.visionBase = { radius: vision.radius, halfAngle: vision.halfAngle }
    this.player = new Player(lvl.playerStart, {
      radius: PLAYER_RADIUS,
      speed: lvl.player?.speed ?? 170,
      visionRadius: vision.radius,
      visionHalfAngle: vision.halfAngle,
      visionIntensity: 1,
    }, () => this.playerSolids())
    this.player.setFace(lvl.playerFace ?? 0)
    this.creature = new Creature(lvl.creatureStart, lvl.creature)
    this.creature.setProwl(lvl.prowl ?? [])

    this.pathfinder = new Pathfinder(lvl.walls, lvl.width, lvl.height, 8)
    this.applyDynamicBlocks()

    // cache static lamp lighting once per level (perf: avoids per-frame gradients)
    const staticLamps: LightSource[] = []
    for (const o of lvl.objects) {
      if (o.type === 'lamp' && o.on) {
        staticLamps.push({
          x: o.x + o.w / 2,
          y: o.y + o.h / 2,
          radius: o.radius,
          color: 'rgba(200,190,150,1)',
          intensity: 1,
          flicker: o.flicker,
          flickerSpeed: 9 + (o.flicker * 30),
          phase: 0,
        })
      }
    }
    this.lighting.buildStaticLights(staticLamps, lvl.width, lvl.height)

    this.camera.setLevel(lvl.width, lvl.height)
    this.camera.resize(this.canvas.clientWidth || window.innerWidth, this.canvas.clientHeight || window.innerHeight)
    this.camera.snapTo(lvl.playerStart)

    this.setGameState('PLAYING')
    this.audio.setMusicDanger(0)
    this.audio.setHeartbeat(0)
    this.audio.updateBreath(0)
    this.cbs.onLevelIntro({
      id,
      name: lvl.name,
      subtitle: lvl.subtitle,
      briefing: lvl.briefing,
    })
    this.save.currentLevel = id
    SaveManager.save(this.save)
  }

  startPlay(): void {
    this.introActive = false
  }

  resume(): void {
    if (this.state === 'PAUSED') this.setGameState('PLAYING')
  }

  setPaused(p: boolean): void {
    if (p && this.state === 'PLAYING') this.setGameState('PAUSED')
    else if (!p && this.state === 'PAUSED') this.setGameState('PLAYING')
  }

  restartLevel(): void {
    if (this.level) this.loadLevel(this.level.id)
  }

  respawn(): void {
    if (!this.level) return
    // reset to checkpoint
    const pos = this.activeCheckpoint ? { ...this.activeCheckpoint } : { ...this.level.playerStart }
    this.player.reset(pos)
    this.creature.reset({ ...this.level.creatureStart })
    this.keysInv = new Set()
    this.batteries = 0
    for (const o of this.level.objects) {
      if (o.type === 'door') {
        o.open = false
        o.holdTimer = 0
        if (this.doorInit[o.id]) o.locked = this.doorInit[o.id].locked
      } else if (o.type === 'key' || o.type === 'battery') {
        o.taken = false
      } else if (o.type === 'generator') {
        o.powered = false
      } else if (o.type === 'switch' || o.type === 'lever') {
        o.active = false
      } else if (o.type === 'pressurePlate') {
        o.active = false
      } else if (o.type === 'checkpoint') {
        o.active = this.activeCheckpoints.has(o.id)
      } else if (o.type === 'exit') {
        if (o.requiresStare) o.open = false
      }
    }
    this.doorProgress = {}
    this.doorWobble = {}
    this.holdProgress = {}
    this.holdTargetId = null
    this.laserReflectedSegments = {}
    this.blinkTimer = 0
    this.blinkActive = false
    this.blinkFlicker = 0
    this.bellTimer = 0
    this.bellRinging = false
    this.bellRingT = 0
    this.deathTimer = 0
    this.deathFade = 0
    this.deathOverlayShown = false
    this.deathReason = ''
    this.creatureVisible = false
    this.stareTimer = 0
    this.winBeam = 0
    this.player.restoreComposure()
    this.runNoGraze = true
    this.runNoSense = true
    this.runStartTime = this.time
    this.applyDynamicBlocks()
    this.camera.snapTo(pos)
    this.setGameState('PLAYING')
    this.audio.setMusicDanger(0)
    this.audio.setHeartbeat(0)
  }

  nextLevel(): void {
    if (!this.level) return
    const next = this.level.id + 1
    if (getLevel(next)) {
      this.save.currentLevel = next
      SaveManager.save(this.save)
      this.loadLevel(next)
    } else {
      this.setGameState('GAME_COMPLETE')
    }
  }

  quitToMenu(): void {
    this.save = SaveManager.load()
    this.setGameState('MENU')
  }

  toggleDebug(): void {
    this.debugMode = !this.debugMode
  }

  setVolumes(sound: number, music: number): void {
    this.save.soundVolume = sound
    this.save.musicVolume = music
    this.audio.setVolumes(sound, music)
    SaveManager.save(this.save)
  }

  setSettings(settings: SaveData['settings']): void {
    this.settings = settings
    this.save.settings = settings
    if (settings?.keybindings) this.input.setBindings(settings.keybindings)
    SaveManager.save(this.save)
  }

  getSave(): SaveData {
    return this.save
  }

  destroy(): void {
    this.destroyed = true
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('resize', this.resize)
    window.removeEventListener('blur', this.onWindowBlur)
    this.input.destroy()
  }

  // ---------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------

  private setGameState(s: GameState): void {
    if (this.state === s) return
    this.state = s
    this.cbs.onStateChange(s)
  }

  private get isTouchDevice(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
    return navigator.maxTouchPoints > 0 || (window.matchMedia?.('(pointer: coarse)').matches ?? false) || this.input.touch
  }

  private resize = (): void => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.worldCanvas.width = this.canvas.width
    this.worldCanvas.height = this.canvas.height
    this.lighting = new Lighting(this.canvas.width, this.canvas.height, this.time + 1)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.worldCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.camera.resize(w, h)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTs = performance.now()
    this.rafId = requestAnimationFrame(this.loop)
  }

  private loop = (ts: number): void => {
    if (this.destroyed) return
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000)
    this.lastTs = ts
    this.fps = Math.round(1 / Math.max(0.001, dt))
    this.update(dt)
    this.render()
    this.rafId = requestAnimationFrame(this.loop)
  }

  private playerSolids(): Rect[] {
    const solids: Rect[] = []
    if (!this.level) return solids
    for (const w of this.level.walls) solids.push(w)
    for (const o of this.level.objects) {
      if (o.type === 'door' && !o.open) solids.push(o)
      else if (o.type === 'laser' && o.active && !o.blockedByCreature) {
        solids.push(this.laserRect(o))
      }
    }
    return solids
  }

  private laserRect(l: Rect & { axis: 'h' | 'v'; x: number; y: number; w: number; h: number }): Rect {
    const c = rectCenter(l)
    if (l.axis === 'h') return { x: c.x - 8, y: c.y - 14, w: 16, h: 28 }
    return { x: c.x - 14, y: c.y - 8, w: 28, h: 16 }
  }

  // ---------------------------------------------------------------
  // update
  // ---------------------------------------------------------------

  private update(dt: number): void {
    this.time += dt
    this.input.update()
    this.camera.update(dt, this.settings)

    if (this.state === 'DEAD') {
      this.updateDeath(dt)
      return
    }
    if (this.state === 'PAUSED') {
      if (this.input.pressedAction('pause')) this.resume()
      return
    }
    if (this.state !== 'PLAYING') return

    this.updateFacing()
    const stepped = this.updatePlayer(dt)
    if (stepped) {
      this.particles.footstep(this.player.pos.x, this.player.pos.y)
      const vol = this.player.crouching ? 0.15 : this.player.running ? 0.9 : 0.6
      this.audio.playerFootstep(vol)
    }
    if (this.player.staminaDead) {
      this.player.staminaDead = false
      this.die('You ran until your legs gave out in the dark.')
    }
    this.camera.follow({
      x: this.player.pos.x + Math.cos(this.player.face) * (this.isTouchDevice ? 40 : 110),
      y: this.player.pos.y + Math.sin(this.player.face) * (this.isTouchDevice ? 40 : 110),
    }, dt)
    // per-step camera bob (disabled by reduce-motion)
    if (!(this.settings?.reduceMotion ?? false)) {
      this.camera.bobX = this.player.bobOffset * 1.6 * Math.cos(this.player.bobTime * 2)
      this.camera.bobY = this.player.bobOffset * 1.2
    } else {
      this.camera.bobX = 0
      this.camera.bobY = 0
    }

    this.updateInteractables(dt)
    this.updateCranks(dt)
    this.updateBlink(dt)
    this.updateBell(dt)
    this.updateNoiseSources(dt)
    this.updateReflectiveLasers()
    this.updateCreature(dt)
    this.updateInteractablesState(dt)
    this.updateAudio(dt)
    this.updateVision(dt)
    this.updateEvents(dt)
    this.updateLevelLogic(dt)
    this.computePeripheral()

    // f3 debug handled elsewhere
    if (this.input.pressedAction('pause')) this.setPaused(true)
    if (this.input.pressedAction('debug')) this.toggleDebug()
  }

  private updateFacing(): void {
    if (this.input.touchLookActive) {
      this.player.setFace(this.input.touchLookAngle)
    } else if (this.input.touch) {
      // touch: keep the last facing while the look joystick is idle
    } else {
      const cx = this.canvas.width / 2
      const cy = this.canvas.height / 2
      const angle = Math.atan2(this.input.mouse.y - cy, this.input.mouse.x - cx)
      this.player.setFace(angle)
    }
  }

  private updatePlayer(dt: number): boolean {
    if (this.introActive) {
      const p = this.player
      p.update(dt, 0, 0, false, false)
      return false
    }
    const p = this.player
    const res = p.update(dt, this.input.move.x, this.input.move.y, this.input.run, this.input.crouch)
    return res.step
  }

  private updateInteractables(dt: number): void {
    if (!this.level) return
    this.interactTarget = null
    let bestDist = Infinity
    for (const o of this.level.objects) {
      const c = rectCenter(o)
      const d = Math.hypot(c.x - this.player.pos.x, c.y - this.player.pos.y)
      if (d < INTERACT_RADIUS && d < bestDist) {
        const interactable = this.isInteractable(o)
        if (interactable) {
          bestDist = d
          this.interactTarget = o
        }
      }
    }
    const interacted = this.input.pressedAction('interact') || this.input.interactTapped
    this.input.interactTapped = false
    if (this.interactTarget && interacted) {
      this.doInteract(this.interactTarget)
    }
    // checkpoint flash decay
    this.checkpointFlash = Math.max(0, this.checkpointFlash - dt)
  }

  private isInteractable(o: GameObject): boolean {
    switch (o.type) {
      case 'key':
        return !o.taken
      case 'battery':
        return !o.taken
      case 'door':
        return !o.open && (o.locked || o.opensWith.length === 0)
      case 'switch':
        return true
      case 'lever':
        return true
      case 'generator':
        return !o.powered
      case 'checkpoint':
        return !o.active
      case 'note':
        return true
      case 'exit':
        return !o.requiresStare
      case 'crank':
        return !o.active
      case 'radio':
        return true
      case 'decoy':
        return o.cooldownTimer <= 0
      case 'mirror':
        return o.rotatable === true
      default:
        return false
    }
  }

  private doInteract(o: GameObject): void {
    switch (o.type) {
      case 'key':
        o.taken = true
        this.keysInv.add(o.keyId)
        this.audio.keyPickup()
        this.particles.sparkle(rectCenter(o).x, rectCenter(o).y)
        break
      case 'battery':
        o.taken = true
        this.batteries++
        this.audio.batteryPickup()
        this.particles.spark(rectCenter(o).x, rectCenter(o).y)
        break
      case 'door':
        if (o.locked && o.keyId && this.keysInv.has(o.keyId)) {
          this.keysInv.delete(o.keyId)
          o.locked = false
          o.open = true
          this.audio.doorSqueak()
          this.audio.doorThud()
          this.applyDynamicBlocks()
          this.audio.keyPickup()
        } else if (o.opensWith.length === 0) {
          o.open = !o.open
          if (o.open) {
            this.audio.doorSqueak()
          } else {
            this.audio.doorThud()
          }
          this.applyDynamicBlocks()
        }
        break
      case 'switch':
        o.active = !o.active
        this.audio.switchClick()
        this.particles.lightFlicker(rectCenter(o).x, rectCenter(o).y)
        break
      case 'lever':
        o.active = !o.active
        this.audio.leverMove()
        break
      case 'generator':
        if (o.batteryRequired && this.batteries > 0) {
          this.batteries--
          o.powered = true
          this.audio.generatorStart()
          this.particles.lightFlicker(rectCenter(o).x, rectCenter(o).y)
          this.particles.spark(rectCenter(o).x, rectCenter(o).y)
          setTimeout(() => this.audio.generatorHum(rectCenter(o)), 800)
          this.applyDynamicBlocks()
        }
        break
      case 'checkpoint':
        o.active = true
        this.activeCheckpoints.add(o.id)
        this.activeCheckpoint = { x: o.x + o.w / 2, y: o.y + o.h / 2 }
        this.checkpointFlash = 1.2
        this.player.restoreComposure()
        this.audio.checkpoint()
        this.audio.restore()
        this.particles.lightFlicker(rectCenter(o).x, rectCenter(o).y)
        break
      case 'crank':
        // handled continuously by updateCranks (hold-to-interact)
        break
      case 'radio':
        o.on = !o.on
        this.audio.radioSwitchOn()
        if (o.on) {
          this.unlockAchievement('piper')
        }
        break
      case 'decoy':
        if (o.cooldownTimer > 0) break
        this.throwDecoy(o)
        break
      case 'mirror':
        if (o.rotatable) this.rotateMirror(o)
        break
      case 'note': {
        const text = o.text || 'Scratched into the wall: "DO NOT LOOK."'
        this.audio.whisper()
        this.cbs.onNote?.({ text })
        if (!this.notesRead.has(o.id)) {
          this.notesRead.add(o.id)
          if (this.notesTotal > 0 && this.notesRead.size >= this.notesTotal) {
            this.unlockAchievement('scribe')
          }
        }
        if (o.storyIndex !== undefined && !this.storyReadSet.has(o.id)) {
          this.storyReadSet.add(o.id)
          this.save.storyNotesRead = Array.from(this.storyReadSet)
          SaveManager.save(this.save)
          if (this.storyReadSet.size >= STORY_NOTES.length) {
            this.unlockAchievement('archivist')
          }
        }
        break
      }
      case 'exit': {
        if (!o.requiresStare) {
          this.completeLevel()
        }
        break
      }
      default:
        break
    }
  }

  // ---------------------------------------------------------------
  // new mechanics: cranks, blink, bell, lures, mirrors, peripheral
  // ---------------------------------------------------------------

  /** throw a noise decoy in the facing direction; it clatters and draws the Watcher */
  private throwDecoy(o: Extract<GameObject, { type: 'decoy' }>): void {
    if (!this.level) return
    const p = this.player.pos
    const dx = Math.cos(this.player.face)
    const dy = Math.sin(this.player.face)
    const wallDist = castRay(p.x, p.y, dx, dy, this.level.walls, 220)
    const land = Math.max(56, Math.min(200, wallDist - 18))
    const tx = clamp(p.x + dx * land, 24, this.level.width - 24)
    const ty = clamp(p.y + dy * land, 24, this.level.height - 24)
    o.thrown = true
    o.thrownPos = { x: tx, y: ty }
    o.x = tx - o.w / 2
    o.y = ty - o.h / 2
    o.clatterTimer = o.clatterTime
    o.cooldownTimer = o.cooldown
    this.audio.decoyClatter(o.thrownPos)
    this.particles.spark(tx, ty)
    this.unlockAchievement('piper')
  }

  /** rotate a beam-splitter mirror so it redirects the laser differently */
  private rotateMirror(m: Extract<GameObject, { type: 'mirror' }>): void {
    const order = ['backslash', 'slash', 'none'] as const
    const cur = m.reflectAxis ?? 'none'
    const idx = order.indexOf(cur as (typeof order)[number])
    const next = order[(idx + 1) % order.length]
    m.reflectAxis = next === 'none' ? undefined : next
    m.faceDir = next === 'backslash' ? 'south' : next === 'slash' ? 'east' : 'west'
    this.audio.leverMove()
    this.particles.lightFlicker(rectCenter(m).x, rectCenter(m).y)
  }

  /** is a world point currently inside the player's vision cone? */
  private pointInVision(px: number, py: number, angularMargin = 0.18): boolean {
    if (!this.level) return false
    const v = this.visionState()
    const p = this.player.pos
    const d = Math.hypot(px - p.x, py - p.y)
    if (d > v.radius) return false
    const dirTo = Math.atan2(py - p.y, px - p.x)
    let diff = Math.abs(dirTo - v.angle)
    while (diff > Math.PI) diff -= Math.PI * 2
    if (Math.abs(diff) > v.halfAngle + angularMargin) return false
    return lineOfSight(p.x, p.y, px, py, this.level.walls)
  }

  /** hold-to-interact: turning a valve takes ~3s and only while it stays in view */
  private updateCranks(dt: number): void {
    if (!this.level) return
    const target = this.interactTarget
    if (target && target.type === 'crank' && !target.active) {
      const c = rectCenter(target)
      const inView = this.pointInVision(c.x, c.y)
      if (this.input.interactHeld && inView) {
        const cur = this.holdProgress[target.id] ?? 0
        const next = Math.min(target.holdTime, cur + dt)
        this.holdProgress[target.id] = next
        this.holdTargetId = target.id
        if (Math.floor(cur * 4) !== Math.floor(next * 4)) this.audio.crankCreak(next / target.holdTime)
        if (next >= target.holdTime) {
          target.active = true
          this.audio.switchClick()
          this.particles.lightFlicker(c.x, c.y)
          this.particles.spark(c.x, c.y)
          this.applyDynamicBlocks()
          this.unlockAchievement('crank')
        }
      } else {
        const cur = this.holdProgress[target.id] ?? 0
        if (cur > 0) this.holdProgress[target.id] = Math.max(0, cur - dt * 1.6)
        if (cur <= 0 && this.holdTargetId === target.id) this.holdTargetId = null
      }
    } else if (this.holdTargetId) {
      const cur = this.holdProgress[this.holdTargetId] ?? 0
      if (cur > 0) this.holdProgress[this.holdTargetId] = Math.max(0, cur - dt * 1.6)
      if (cur <= 0) this.holdTargetId = null
    }
  }

  /** Blink Room: the eyes close on an interval; during the blink the Watcher moves even while looked at */
  private updateBlink(dt: number): void {
    if (!this.level?.blink) {
      this.blinkActive = false
      this.blinkFlicker = 0
      return
    }
    const cfg = this.level.blink
    if (this.blinkActive) {
      this.blinkFlicker = Math.max(0, 1 - this.blinkTimer / cfg.duration)
      this.blinkTimer += dt
      if (this.blinkTimer >= cfg.duration) {
        this.blinkActive = false
        this.blinkTimer = 0
      }
    } else {
      this.blinkTimer += dt
      if (this.blinkTimer >= cfg.interval - cfg.duration) {
        this.blinkActive = true
        this.blinkTimer = 0
        this.blinkFlicker = 1
        this.audio.blinkWhoosh()
      }
    }
  }

  /** Bell Tower: the Watcher is frozen except while the bell tolls */
  private updateBell(dt: number): void {
    if (!this.level?.bell) {
      this.bellRinging = false
      return
    }
    const cfg = this.level.bell
    if (this.bellRinging) {
      this.bellRingT += dt
      if (this.bellRingT >= cfg.duration) {
        this.bellRinging = false
        this.bellRingT = 0
        const b = this.level.objects.find((o) => o.id === this.bellObjectId)
        if (b && b.type === 'bell') b.ringing = false
      }
    } else {
      this.bellTimer += dt
      if (this.bellTimer >= cfg.interval) {
        this.bellTimer = 0
        this.bellRinging = true
        this.bellRingT = 0
        const bells = this.level.objects.filter((o) => o.type === 'bell')
        const b = bells[0]
        if (b) {
          this.bellObjectId = b.id
          if (b.type === 'bell') b.ringing = true
          this.audio.bellToll(rectCenter(b))
          this.camera.shake(4, 0.6)
        }
      }
    }
  }

  /** gather lure noise sources (radios, thrown decoys) each frame for the creature */
  private updateNoiseSources(dt: number): void {
    if (!this.level) return
    const srcs: { x: number; y: number; strength: number }[] = []
    for (const o of this.level.objects) {
      if (o.type === 'radio' && o.on) {
        const c = rectCenter(o)
        srcs.push({ x: c.x, y: c.y, strength: o.lure })
      } else if (o.type === 'decoy' && o.thrown && o.clatterTimer > 0) {
        o.clatterTimer = Math.max(0, o.clatterTimer - dt)
        if (o.clatterTimer > 0) srcs.push({ x: o.thrownPos.x, y: o.thrownPos.y, strength: 1.3 })
      }
    }
    this.noiseSources = srcs

    // radio plays its music-box loop while switched on
    this.radioTuneTimer -= dt
    const radioOn = this.level.objects.find((o) => o.type === 'radio' && o.on)
    if (radioOn && this.radioTuneTimer <= 0) {
      this.radioTuneTimer = 3.2
      this.audio.radioTune(rectCenter(radioOn))
    }
    // decoys recover so they can be thrown again
    for (const o of this.level.objects) {
      if (o.type === 'decoy' && o.cooldownTimer > 0) o.cooldownTimer = Math.max(0, o.cooldownTimer - dt)
    }
  }

  /** trace reflected laser beams (Hall of Mirrors): beams bounce off beam-splitter mirrors */
  private updateReflectiveLasers(): void {
    if (!this.level) return
    this.laserReflectedSegments = {}
    const mirrors = this.level.objects.filter((o): o is Extract<GameObject, { type: 'mirror' }> => o.type === 'mirror' && o.active)
    const walls = this.level.walls
    for (const o of this.level.objects) {
      if (o.type !== 'laser' || !o.active || !o.reflective) continue
      const segs: { x0: number; y0: number; x1: number; y1: number }[] = []
      let dir: Vec2 = o.axis === 'h' ? { x: 1, y: 0 } : { x: 0, y: 1 }
      let pos: Vec2 = rectCenter(o)
      let completed = false
      let lastId: string | null = null
      for (let i = 0; i < 8; i++) {
        let nearestT = Infinity
        let hitMirror: Extract<GameObject, { type: 'mirror' }> | null = null
        for (const m of mirrors) {
          if (m.id === lastId) continue
          const t = rayRectHit(pos.x, pos.y, dir.x, dir.y, m)
          if (t < nearestT) {
            nearestT = t
            hitMirror = m
          }
        }
        const wallT = castRay(pos.x, pos.y, dir.x, dir.y, walls)
        const boundT = this.beamBounds(pos, dir)
        const endT = Math.min(wallT, boundT)
        if (hitMirror && nearestT < endT) {
          const hx = pos.x + dir.x * nearestT
          const hy = pos.y + dir.y * nearestT
          segs.push({ x0: pos.x, y0: pos.y, x1: hx, y1: hy })
          if (hitMirror.receiver) {
            completed = true
            break
          }
          if (!hitMirror.reflectAxis) break
          if (hitMirror.reflectAxis === 'backslash') dir = { x: dir.y, y: dir.x }
          else dir = { x: -dir.y, y: -dir.x }
          pos = { x: hx + dir.x * 2, y: hy + dir.y * 2 }
          lastId = hitMirror.id
        } else {
          const hx = pos.x + dir.x * endT
          const hy = pos.y + dir.y * endT
          segs.push({ x0: pos.x, y0: pos.y, x1: hx, y1: hy })
          break
        }
      }
      this.laserReflectedSegments[o.id] = segs
      o.completed = completed
    }
  }

  private beamBounds(pos: Vec2, dir: Vec2): number {
    const lvl = this.level
    if (!lvl) return 0
    let t = Infinity
    if (dir.x > 0) t = Math.min(t, (lvl.width - pos.x) / dir.x)
    else if (dir.x < 0) t = Math.min(t, (0 - pos.x) / dir.x)
    if (dir.y > 0) t = Math.min(t, (lvl.height - pos.y) / dir.y)
    else if (dir.y < 0) t = Math.min(t, (0 - pos.y) / dir.y)
    return Number.isFinite(t) ? t : 0
  }

  private pointNearSegment(p: Vec2, s: { x0: number; y0: number; x1: number; y1: number }): boolean {
    const dx = s.x1 - s.x0
    const dy = s.y1 - s.y0
    const len2 = dx * dx + dy * dy || 1
    let t = ((p.x - s.x0) * dx + (p.y - s.y0) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const cx = s.x0 + dx * t
    const cy = s.y0 + dy * t
    return Math.hypot(p.x - cx, p.y - cy) < 26
  }

  /** peripheral vision warning: a subtle glow when the Watcher is just outside the cone */
  private computePeripheral(): void {
    this.peripheralActive = false
    if (!this.level) return
    if (this.creatureVisible || this.creatureMirrorIds.length > 0) return
    const v = this.visionState()
    const p = this.player.pos
    const c = this.creature.pos
    const d = Math.hypot(c.x - p.x, c.y - p.y)
    if (d > v.radius * 1.2 || d < v.radius * 0.35) return
    if (!lineOfSight(p.x, p.y, c.x, c.y, this.level.walls)) return
    const dirToC = Math.atan2(c.y - p.y, c.x - p.x)
    let diff = Math.abs(dirToC - v.angle)
    while (diff > Math.PI) diff -= Math.PI * 2
    const aDiff = Math.abs(diff)
    if (aDiff <= v.halfAngle) {
      // within the cone's angle but just past its reach
      if (d > v.radius && d < v.radius * 1.2) {
        this.peripheralActive = true
        this.peripheralAngle = dirToC
      }
    } else if (aDiff < v.halfAngle + 0.55) {
      this.peripheralActive = true
      this.peripheralAngle = dirToC
    }
  }

  // ---------------------------------------------------------------
  // vision
  // ---------------------------------------------------------------

  private visionState(): VisionState {
    return {
      x: this.player.pos.x,
      y: this.player.pos.y,
      angle: this.player.face,
      radius: this.player.visionRadius,
      halfAngle: this.player.visionHalfAngle,
      intensity: this.player.visionIntensity,
    }
  }

  private isCreatureVisible(force = false): boolean {
    if (force) return true
    if (!this.level) return false
    const v = this.visionState()
    const p = this.player.pos
    const c = this.creature.pos
    const d = Math.hypot(c.x - p.x, c.y - p.y)
    if (d > v.radius * 0.96) return false
    const dirToC = Math.atan2(c.y - p.y, c.x - p.x)
    let diff = Math.abs(dirToC - v.angle)
    while (diff > Math.PI) diff -= Math.PI * 2
    if (Math.abs(diff) > v.halfAngle) return false
    if (!lineOfSight(p.x, p.y, c.x, c.y, this.level.walls)) return false
    return true
  }

  private creatureVisibleInMirror(): string[] {
    if (!this.level) return []
    const ids: string[] = []
    const p = this.player.pos
    const c = this.creature.pos
    const v = this.visionState()
    for (const m of this.level.objects) {
      if (m.type !== 'mirror' || !m.active) continue
      const mc = rectCenter(m)
      const dirToM = Math.atan2(mc.y - p.y, mc.x - p.x)
      let diff = Math.abs(dirToM - v.angle)
      while (diff > Math.PI) diff -= Math.PI * 2
      if (Math.abs(diff) > v.halfAngle + 0.35) continue
      if (Math.hypot(mc.x - p.x, mc.y - p.y) > v.radius * 1.2) continue
      if (!lineOfSight(p.x, p.y, mc.x, mc.y, this.level.walls)) continue
      const normal = FACE[m.faceDir]
      const toC = { x: c.x - mc.x, y: c.y - mc.y }
      const dot = toC.x * normal.x + toC.y * normal.y
      if (dot < 10) continue // creature must be in front of the mirror
      const angle = Math.acos(clamp((toC.x * normal.x + toC.y * normal.y) / Math.max(1, Math.hypot(toC.x, toC.y)), -1, 1))
      if (angle > Math.PI / 2 + 0.5) continue
      ids.push(m.id)
    }
    return ids
  }

  /** mirrors the player can currently see (discoverability hint for the reflection mechanic) */
  private mirrorsInView(): string[] {
    if (!this.level) return []
    const ids: string[] = []
    const p = this.player.pos
    const v = this.visionState()
    for (const m of this.level.objects) {
      if (m.type !== 'mirror' || !m.active) continue
      const mc = rectCenter(m)
      const dirToM = Math.atan2(mc.y - p.y, mc.x - p.x)
      let diff = Math.abs(dirToM - v.angle)
      while (diff > Math.PI) diff -= Math.PI * 2
      if (Math.abs(diff) > v.halfAngle + 0.35) continue
      if (Math.hypot(mc.x - p.x, mc.y - p.y) > v.radius * 1.15) continue
      if (!lineOfSight(p.x, p.y, mc.x, mc.y, this.level.walls)) continue
      ids.push(m.id)
    }
    return ids
  }

  // ---------------------------------------------------------------
  // creature
  // ---------------------------------------------------------------

  private updateCreature(dt: number): void {
    if (!this.level) return
    // spotlight stun
    this.spotlightStunned = {}
    for (const sp of this.level.objects) {
      if (sp.type !== 'spotlight' || !sp.active) continue
      const inBeam = this.spotlightCovers(sp, this.creature.pos)
      this.spotlightStunned[sp.id] = inBeam
      if (inBeam) this.creature.stun(0.25)
    }
    // reflected laser beams stun exactly like spotlights
    for (const [id, segs] of Object.entries(this.laserReflectedSegments)) {
      const inBeam = segs.some((s) => this.pointNearSegment(this.creature.pos, s))
      if (inBeam) {
        this.spotlightStunned[id] = true
        this.creature.stun(0.25)
      }
    }

    this.creatureVisible = this.isCreatureVisible()
    this.creatureMirrorIds = this.creatureVisibleInMirror()
    this.mirrorHintIds = this.mirrorsInView()
    let visible = this.creatureVisible || this.creatureMirrorIds.length > 0

    // Blink Room: during a blink your eyes are closed — it can move even while "looked at"
    if (this.level.blink && this.blinkActive) visible = false
    // Bell Tower: the bell is the only clock it obeys
    const frozen = this.level.bell ? !this.bellRinging : false
    if (this.level.bell && this.bellRinging) visible = false

    const d = Math.hypot(this.creature.pos.x - this.player.pos.x, this.creature.pos.y - this.player.pos.y)

    // burst speed when it leaves the player's sight (spooky closing in)
    if (visible && this.creature.state === 'VISIBLE') {
      this.creatureBurstTimer = 0
    }

    if (visible) this.runNoLook = false

    const info = {
      isVisible: visible,
      playerPos: { ...this.player.pos },
      playerNoise: this.player.noise,
      time: this.time,
      pathfinder: this.pathfinder!,
      attackRange: ATTACK_RANGE,
      distanceToPlayer: d,
      chaseDist: CHASE_DIST,
      forcedTarget: null,
      activated: !this.introActive,
      prowl: this.creature.prowl,
      noiseSources: this.noiseSources,
      frozen,
    }
    this.creature.update(dt, info)

    if (this.creature.state === 'CHASE' || this.creature.state === 'ATTACK') this.runNoSense = false

    // burst speed while it just left vision
    if (!visible) {
      this.creatureBurstTimer += dt
    }

    // footsteps for creature (only when moving & not visible)
    if (this.creature.moving && !visible) {
      this.creatureStepTimer -= dt
      if (this.creatureStepTimer <= 0) {
        this.creatureStepTimer = 0.55
        this.audio.creatureFootstep({ ...this.creature.pos }, 1)
        this.particles.creatureStep(this.creature.pos.x, this.creature.pos.y)
      }
    }

    // close hint when very near but unseen
    this.creatureCloseHint = !visible && d < 260

    // creature vocalizations: growl while you are watching it
    if (visible) {
      this.growlTimer -= dt
      if (this.growlTimer <= 0) {
        this.growlTimer = 2.5 + Math.random() * 3.5
        this.audio.creatureGrowl()
      }
    }

    // graze (composure hit) vs kill
    if (this.creature.wantKill) {
      if (this.player.composure > GRAZE_COST) {
        this.graze()
      } else {
        this.die('It reached you when you were not looking.')
      }
    }
  }

  private spotlightCovers(sp: Rect & { faceDir: 'north' | 'south' | 'east' | 'west'; x: number; y: number }, pos: Vec2): boolean {
    const c = rectCenter(sp)
    const dir = FACE[sp.faceDir]
    const len = 240
    const dx = pos.x - c.x
    const dy = pos.y - c.y
    const along = dx * dir.x + dy * dir.y
    if (along < 0 || along > len) return false
    const perp = Math.abs(dx * -dir.y + dy * dir.x)
    return perp < 34
  }

  // ---------------------------------------------------------------
  // door / plate / laser / generator logic
  // ---------------------------------------------------------------

  private sourceActive(sourceId: string): boolean {
    if (!this.level) return false
    const o = this.level.objects.find((x) => x.id === sourceId)
    if (!o) return false
    if (o.type === 'switch' || o.type === 'lever') return o.active
    if (o.type === 'generator') return o.powered
    if (o.type === 'pressurePlate') return o.active
    if (o.type === 'laser') return o.blockedByCreature || (o.reflective === true && o.completed === true)
    if (o.type === 'crank') return o.active
    return false
  }

  private updateInteractablesState(dt: number): void {
    if (!this.level) return
    const p = this.player.pos
    const cr = this.creature.pos
    const playerRect = { x: p.x - 12, y: p.y - 12, w: 24, h: 24 }
    const creatureRect = { x: cr.x - 16, y: cr.y - 16, w: 32, h: 32 }

    // plates
    for (const o of this.level.objects) {
      if (o.type !== 'pressurePlate') continue
      const who = o.requires
      const onPlayer = who !== 'creature' && rectsOverlap(o, playerRect)
      const onCreature = who !== 'player' && rectsOverlap(o, creatureRect)
      o.active = onPlayer || onCreature
      // stepping on a plate clatters: it is loud, and it is meant to lure the creature
      if (onPlayer) this.player.noise = Math.max(this.player.noise, 0.7)
    }

    // lasers
    this.laserBlocked = {}
    for (const o of this.level.objects) {
      if (o.type !== 'laser' || !o.active || !o.interruptible) continue
      const blocked = this.laserCovers(o, cr)
      o.blockedByCreature = blocked
      this.laserBlocked[o.id] = blocked
    }

    // doors
    let blocksDirty = false
    for (const o of this.level.objects) {
      if (o.type !== 'door') continue
      const before = o.open
      this.updateDoor(o, dt)
      if (before !== o.open) blocksDirty = true
    }
    if (blocksDirty) this.applyDynamicBlocks()
  }

  private laserCovers(l: Rect & { axis: 'h' | 'v'; x: number; y: number; w: number; h: number }, pos: Vec2): boolean {
    const c = rectCenter(l)
    if (l.axis === 'h') {
      if (Math.abs(pos.y - c.y) < 26 && pos.x >= c.x - 20) return true
    } else {
      if (Math.abs(pos.x - c.x) < 26 && pos.y >= c.y - 20) return true
    }
    return false
  }

  private updateDoor(o: Extract<GameObject, { type: 'door' }>, dt: number): void {
    let srcActive = false
    if (o.sensorRadius !== undefined) {
      const c = rectCenter(o)
      const d = Math.hypot(this.creature.pos.x - c.x, this.creature.pos.y - c.y)
      srcActive = d < o.sensorRadius
    }
    if (!srcActive) {
      const all = o.mode === 'all'
      let satisfied = true
      let any = false
      for (const sid of o.sourceIds) {
        const s = this.sourceActive(sid)
        if (s) any = true
        else satisfied = false
      }
      srcActive = all ? (o.sourceIds.length > 0 && satisfied) : any
      // key / mirror special sources
      for (const wt of o.opensWith) {
        if (wt === 'key' && o.keyId && this.keysInv.has(o.keyId)) srcActive = true
        if (wt === 'mirror' && this.creatureMirrorIds.length > 0) srcActive = true
      }
    }

    if (srcActive) {
      if (!o.open) {
        o.open = true
        if (o.opensWith.length > 0) this.audio.doorSqueak()
        this.particles.hiss(o.x, o.y, o.w, o.h)
      }
      o.holdTimer = 0
    } else {
      if (o.open) {
        o.holdTimer += dt
        if (o.holdTimer >= o.holdTime) {
          o.open = false
          this.audio.doorThud()
          if (o.opensWith.includes('plate')) this.doorWobble[o.id] = 1
        }
      }
    }
    if ((this.doorWobble[o.id] ?? 0) > 0) {
      this.doorWobble[o.id] = Math.max(0, this.doorWobble[o.id] - dt * 2)
    }
    const target = o.open ? 1 : 0
    const cur = this.doorProgress[o.id] ?? target
    this.doorProgress[o.id] = clamp(cur + (target - cur) * Math.min(1, dt * 4), 0, 1)
  }

  private applyDynamicBlocks(): void {
    if (!this.pathfinder || !this.level) return
    const blocks: Rect[] = []
    for (const o of this.level.objects) {
      if (o.type === 'door' && !o.open) blocks.push(o)
    }
    this.pathfinder.setExtraBlocks(blocks)
  }

  // ---------------------------------------------------------------
  // level logic: exit, win, checkpoint
  // ---------------------------------------------------------------

  private updateLevelLogic(dt: number): void {
    if (!this.level) return
    for (const o of this.level.objects) {
      if (o.type !== 'exit') continue
      const c = rectCenter(o)
      if (pointInRect(this.player.pos.x, this.player.pos.y, o)) {
        if (o.requiresStare) {
          const d = Math.hypot(this.creature.pos.x - c.x, this.creature.pos.y - c.y)
          const staring = this.creatureVisible || this.creatureMirrorIds.length > 0
          if (d < o.requiresStare.radius && staring) {
            this.stareTimer += dt
            o.open = true
          } else {
            this.stareTimer = 0
            o.open = false
          }
          this.winBeam = clamp(this.stareTimer / o.requiresStare.duration, 0, 1)
          if (this.stareTimer >= o.requiresStare.duration) {
            this.completeLevel()
          }
        } else {
          this.completeLevel()
        }
        return
      }
    }
  }

  private completeLevel(): void {
    if (!this.level || this.state !== 'PLAYING') return
    const id = this.level.id
    const total = TOTAL_LEVELS
    this.save.completedLevels = Array.from(new Set([...this.save.completedLevels, id]))
    this.save.highestUnlockedLevel = Math.max(this.save.highestUnlockedLevel, Math.min(total, id + 1))
    this.save.currentLevel = Math.max(this.save.currentLevel, Math.min(total, id + 1))
    SaveManager.save(this.save)
    // achievements
    if (this.runNoGraze) this.unlockAchievement('survivor')
    if (this.runNoLook) this.unlockAchievement('no_look')
    if (this.runNoSense) this.unlockAchievement('shadow')
    if (this.time - this.runStartTime < 60) this.unlockAchievement('speedster')
    if (id >= total) this.unlockAchievement('walker')
    this.audio.complete()
    if (id >= total) {
      // secret ending: read every hidden note before finishing the Labyrinth
      let secret = false
      if (this.storyReadSet.size >= STORY_NOTES.length && !this.save.secretEndingUnlocked) {
        this.save.secretEndingUnlocked = true
        secret = true
        SaveManager.save(this.save)
        this.unlockAchievement('releaser')
        this.audio.secretRelease()
      }
      this.setGameState('GAME_COMPLETE')
      this.cbs.onGameComplete(secret)
    } else {
      this.setGameState('LEVEL_COMPLETE')
      this.cbs.onLevelComplete({ levelId: id, nextLevel: id + 1 })
    }
  }

  // ---------------------------------------------------------------
  // death
  // ---------------------------------------------------------------

  private die(reason: string): void {
    if (this.state !== 'PLAYING') return
    this.deathReason = reason
    this.deathTimer = 0
    this.deathFade = 0
    this.creatureVisible = true
    this.audio.stingDeath()
    this.audio.setMusicDanger(0)
    this.audio.setHeartbeat(0)
    this.setGameState('DEAD')
  }

  /** the creature got a hold of you but your composure holds: a near-miss */
  private graze(): void {
    if (this.state !== 'PLAYING') return
    const p = this.player
    p.composure = Math.max(0, p.composure - GRAZE_COST)
    p.grazeFlash = 1
    this.runNoGraze = false
    this.camera.shake(10, 0.45)
    this.audio.graze()
    this.audio.setMusicDanger(1)
    this.creature.stun(1.1)
    const dx = this.creature.pos.x - p.pos.x
    const dy = this.creature.pos.y - p.pos.y
    const dist = Math.hypot(dx, dy) || 1
    this.creature.pos.x += (dx / dist) * 48
    this.creature.pos.y += (dy / dist) * 48
    this.particles.creatureStep(this.creature.pos.x, this.creature.pos.y)
    this.particles.spark(p.pos.x, p.pos.y)
    this.unlockAchievement('first_blood')
  }

  private unlockAchievement(id: string): void {
    if (!this.save.achievements.includes(id)) {
      this.save.achievements = [...this.save.achievements, id]
      SaveManager.save(this.save)
      this.cbs.onAchievement?.(id)
    }
  }

  private updateDeath(dt: number): void {
    this.deathTimer += dt
    this.deathFade = clamp(this.deathTimer / 1.4, 0, 1)
    if (this.deathTimer >= 1.6 && !this.deathOverlayShown) {
      this.deathOverlayShown = true
      this.cbs.onDeath({
        checkpoint: this.activeCheckpoint ? { ...this.activeCheckpoint } : { ...this.level!.playerStart },
        hasCheckpoint: this.activeCheckpoint !== null,
        reason: this.deathReason,
      })
    }
  }

  // ---------------------------------------------------------------
  // audio: danger layers
  // ---------------------------------------------------------------

  private updateAudio(dt: number): void {
    if (!this.level) return
    const d = Math.hypot(this.creature.pos.x - this.player.pos.x, this.creature.pos.y - this.player.pos.y)
    let factor = 0
    if (d < 150) factor = 1
    else if (d < 300) factor = (300 - d) / 150
    else if (d < 520) factor = ((520 - d) / 220) * 0.55
    this.dangerFactor = factor

    this.audio.setListener({ ...this.player.pos })
    this.audio.setMusicDanger(factor)
    // breathing swells when the creature is right next to you but unseen
    // and when your composure is shattered
    const compFactor = 1 - this.player.composure / this.player.maxComposure
    this.audio.updateBreath(Math.min(1, factor + (this.creatureCloseHint ? 0.25 : 0) + compFactor * 0.3))
    const heartBpm = factor > 0.85 ? 132 : factor > 0.6 ? 96 : compFactor > 0.7 ? 120 : 0
    this.audio.setHeartbeat(heartBpm)
    this.audio.updateHeartbeat(dt)
    this.audio.setCreatureVisible(this.creatureVisible || this.creatureMirrorIds.length > 0 ? 1 : 0)
    void d
  }

  /** tunnel vision: the vision cone closes in under pressure and low composure */
  private updateVision(_dt: number): void {
    const base = this.visionBase
    const compFactor = 1 - this.player.composure / this.player.maxComposure
    const tunnel = this.dangerFactor * VISION_TUNNEL_MAX + compFactor * 0.1
    this.player.visionHalfAngle = base.halfAngle * (1 - tunnel)
    this.player.visionRadius = base.radius * (1 - compFactor * 0.12)
  }

  // ---------------------------------------------------------------
  // random ambient events
  // ---------------------------------------------------------------

  private updateEvents(dt: number): void {
    if (this.introActive) return
    this.eventTimer -= dt
    this.flickerBoost = Math.max(0, this.flickerBoost - dt * 2)
    if (this.eventTimer <= 0) {
      this.eventTimer = 5 + Math.random() * 6
      this.triggerRandomEvent()
    }
    // distant scream loop: the Watcher is always somewhere in the building
    this.screamTimer -= dt
    if (this.screamTimer <= 0) {
      this.screamTimer = 26 + Math.random() * 24
      const a = Math.random() * Math.PI * 2
      const dist = 420 + Math.random() * 380
      const p = this.player.pos
      this.audio.scream({ x: p.x + Math.cos(a) * dist, y: p.y + Math.sin(a) * dist })
    }
  }

  private triggerRandomEvent(): void {
    const roll = Math.random()
    const p = this.player.pos
    if (roll < 0.3) {
      // light flicker
      this.flickerBoost = 1.6
      this.audio.lightFlicker()
      if (this.level) this.particles.lightFlicker(p.x + (Math.random() - 0.5) * 400, p.y + (Math.random() - 0.5) * 300)
    } else if (roll < 0.5) {
      // distant knock
      const a = Math.random() * Math.PI * 2
      const d = 300 + Math.random() * 300
      const pos = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }
      this.audio.knock(pos)
    } else if (roll < 0.65) {
      // whisper
      this.audio.whisper()
    } else if (roll < 0.8) {
      // object fall
      const a = Math.random() * Math.PI * 2
      const d = 150 + Math.random() * 250
      const pos = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }
      this.particles.objectFall(pos.x, pos.y)
      this.audio.doorThud()
    } else if (roll < 0.92) {
      // shadow streak
      const a = Math.random() * Math.PI * 2
      const d = 120 + Math.random() * 220
      const pos = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }
      this.particles.shadowStreak(pos.x, pos.y, a)
    } else {
      // electrical buzz
      const pos = { x: p.x + (Math.random() - 0.5) * 600, y: p.y + (Math.random() - 0.5) * 400 }
      this.audio.buzz(pos)
    }
  }

  // ---------------------------------------------------------------
  // render
  // ---------------------------------------------------------------

  private render(): void {
    if (!this.level) return
    const ctx = this.ctx
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = this.canvas.width / dpr
    const h = this.canvas.height / dpr
    const cam = this.camera
    const halfW = w / 2
    const halfH = h / 2

    const vision = this.visionState()
    const rs: RenderState = {
      time: this.time,
      level: this.level,
      player: this.player,
      creature: this.creature,
      particles: this.particles,
      creatureVisible: this.creatureVisible || this.state === 'DEAD',
      creatureMirrorIds: this.creatureMirrorIds,
      mirrorHintIds: this.mirrorHintIds,
      creatureCloseHint: this.creatureCloseHint,
      doorsOpenProgress: this.doorProgress,
      doorWobble: this.doorWobble,
      debug: this.debugMode,
      danger: this.dangerFactor,
      checkpointFlash: this.checkpointFlash,
      laserBlocked: this.laserBlocked,
      spotlightStunned: this.spotlightStunned,
      winBeam: this.winBeam,
      vision,
      reducedFlicker: this.settings?.reducedFlicker ?? false,
      reducedMotion: this.settings?.reduceMotion ?? false,
      colorblind: this.settings?.colorblind ?? false,
      playerMode: this.player.mode,
      stamina: this.player.stamina,
      maxStamina: this.player.maxStamina,
      composure: this.player.composure,
      maxComposure: this.player.maxComposure,
      grazeFlash: this.player.grazeFlash,
      deathProgress: this.state === 'DEAD' ? this.deathFade : 0,
      blinkActive: this.blinkActive,
      blinkFlicker: this.blinkFlicker,
      peripheralActive: this.peripheralActive,
      peripheralAngle: this.peripheralAngle,
      laserReflectedSegments: this.laserReflectedSegments,
      holdProgress: this.holdProgress,
    }

    // world
    this.worldCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.renderer.render(this.worldCtx, { x: cam.x, y: cam.y }, halfW, halfH, rs)

    // lighting
    const lightSources = this.collectLightSources()
    this.lighting.render(
      { x: cam.x + cam.shakeX + cam.bobX, y: cam.y + cam.shakeY + cam.bobY },
      w, h,
      vision,
      lightSources,
      this.level.walls,
      this.time,
      {
        darkness: this.level.ambient?.darkness ?? 0.93,
        tint: this.level.ambient?.tint ?? 'transparent',
        flickerIntensity: (this.level.ambient?.flickerIntensity ?? 1) * (1 + this.flickerBoost) * (this.settings?.reducedFlicker ? 0.15 : 1),
      },
    )

    // compose
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.save()
    ctx.translate(cam.shakeX + cam.bobX, cam.shakeY + cam.bobY)
    ctx.drawImage(this.worldCanvas, 0, 0, w * dpr, h * dpr, 0, 0, w, h)
    ctx.drawImage(this.lighting.canvas, 0, 0, w * dpr, h * dpr, 0, 0, w, h)
    ctx.restore()

    // fog + vignette
    this.lighting.drawVignette(ctx, w, h, this.dangerFactor)

    // Blink Room: your eyes close for a frame — a bright flash, then darkness
    if (this.blinkActive && this.blinkFlicker > 0.01) {
      const a = this.blinkFlicker
      ctx.fillStyle = `rgba(250,250,252,${(a * 0.55).toFixed(3)})`
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = `rgba(0,0,0,${(a * 0.35).toFixed(3)})`
      ctx.fillRect(0, 0, w, h)
    }

    // peripheral warning: the Watcher is just outside your vision cone
    if (this.state === 'PLAYING' && !this.introActive && this.peripheralActive) {
      this.drawPeripheralGlow(ctx, w, h)
    }

    // low-composure / graze blood vignette
    if (this.state === 'PLAYING') {
      const compFactor = 1 - this.player.composure / this.player.maxComposure
      const blood = Math.max(this.player.grazeFlash, compFactor)
      if (blood > 0.01) this.drawBloodVignette(ctx, w, h, blood)
    }

    // low-composure static (visual breakdown)
    if (this.state === 'PLAYING' && !this.introActive && (this.settings?.distortion ?? true)) {
      const compFactor = 1 - this.player.composure / this.player.maxComposure
      if (compFactor > 0.55) this.drawStatic(ctx, w, h, (compFactor - 0.55) / 0.45)
    }

    // exit beacon: a column of light visible through the dark
    if (this.level) {
      for (const o of this.level.objects) {
        if (o.type !== 'exit') continue
        const c = rectCenter(o)
        const sx = c.x - cam.x + halfW
        const sy = c.y - cam.y + halfH
        this.renderer.drawExitBeacon(ctx, sx, sy, this.time, this.winBeam)
      }
    }

    // death: seized face + heavy fade
    if (this.state === 'DEAD') {
      this.renderer.drawDeathFace(ctx, w, h, this.deathFade, this.time, this.levelIndex)
      ctx.fillStyle = `rgba(8,0,0,${(this.deathFade * 0.6).toFixed(3)})`
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = `rgba(0,0,0,${(this.deathFade * 0.9).toFixed(3)})`
      ctx.fillRect(0, 0, w, h)
    }

    // HUD (stamina / composure) while playing
    if (this.state === 'PLAYING' && !this.introActive) {
      this.drawHud(ctx, w, h)
    }

    // interact prompt
    if (this.state === 'PLAYING' && !this.introActive && this.interactTarget) {
      this.drawInteractPrompt(ctx, cam, halfW, halfH)
    }

    // aim / facing indicator (desktop only; touch uses the virtual look area)
    if (this.state === 'PLAYING' && !this.introActive && !this.input.touch) {
      this.drawCrosshair(ctx, halfW, halfH)
    }

    // touch joystick + action buttons
    if (this.input.touch) this.drawTouchUI(ctx, w, h)

    // debug overlay
    if (this.debugMode && this.state === 'PLAYING') this.drawDebug(ctx)

    // glitch filter
    this.applyGlitch()
  }

  private collectLightSources(): LightSource[] {
    if (!this.level) return []
    const srcs: LightSource[] = []
    const time = this.time
    for (const o of this.level.objects) {
      if (o.type === 'lamp') {
        // lamps are baked into the cached static light map in loadLevel
        continue
      } else if (o.type === 'spotlight' && o.active) {
        const c = rectCenter(o)
        const dir = FACE[o.faceDir]
        srcs.push({
          x: c.x + dir.x * 130,
          y: c.y + dir.y * 130,
          radius: 260,
          color: 'rgba(230,225,210,1)',
          intensity: 0.9,
          flicker: 0.08,
          flickerSpeed: 5,
          phase: time,
        })
      } else if (o.type === 'generator' && o.powered) {
        const c = rectCenter(o)
        srcs.push({
          x: c.x,
          y: c.y,
          radius: 200,
          color: 'rgba(120,200,150,1)',
          intensity: 0.7,
          flicker: 0.12,
          flickerSpeed: 8,
          phase: time,
        })
      } else if (o.type === 'exit') {
        const c = rectCenter(o)
        srcs.push({
          x: c.x,
          y: c.y,
          radius: 210,
          color: 'rgba(255,214,160,1)',
          intensity: 0.6,
          flicker: 0.1,
          flickerSpeed: 5,
          phase: time,
        })
      }
    }
    return srcs
  }

  private drawInteractPrompt(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, halfW: number, halfH: number): void {
    if (!this.interactTarget) return
    const c = rectCenter(this.interactTarget)
    const sx = c.x - cam.x + halfW
    const sy = c.y - cam.y + halfH - 26
    const label = this.interactLabel(this.interactTarget)
    ctx.font = '14px monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    const tw = ctx.measureText(label).width
    ctx.fillRect(sx - tw / 2 - 8, sy - 14, tw + 16, 22)
    ctx.strokeStyle = 'rgba(200,200,220,0.5)'
    ctx.strokeRect(sx - tw / 2 - 8, sy - 14, tw + 16, 22)
    ctx.fillStyle = '#d8d4c8'
    ctx.fillText(label, sx, sy + 2)
    ctx.textAlign = 'left'
  }

  private interactLabel(o: GameObject): string {
    const key = this.isTouchDevice ? '[TAP]' : '[E]'
    switch (o.type) {
      case 'key':
        return `${key} Take key`
      case 'battery':
        return `${key} Take battery`
      case 'door':
        if (o.locked && o.keyId && !this.keysInv.has(o.keyId)) return 'Locked'
        return `${key} Open door`
      case 'switch':
        return `${key} Switch`
      case 'lever':
        return `${key} Lever`
      case 'generator':
        if (o.batteryRequired && this.batteries === 0) return 'Needs battery'
        return `${key} Start generator`
      case 'checkpoint':
        return `${key} Rest`
      case 'note':
        return `${key} Read`
      case 'exit':
        return `${key} Exit`
      case 'crank':
        if (o.active) return 'Turned'
        return `${this.isTouchDevice ? '[HOLD]' : '[HOLD E]'} Turn valve`
      case 'radio':
        return `${key} ${o.on ? 'Silence' : 'Switch on'}`
      case 'decoy':
        if (o.cooldownTimer > 0) return 'Cooling'
        return `${key} Throw`
      case 'mirror':
        if (o.rotatable) return `${key} Rotate mirror`
        return `${key} Interact`
      default:
        return `${key} Interact`
    }
  }

  /** subtle edge glow on the side the Watcher is creeping in from */
  private drawPeripheralGlow(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const v = this.visionState()
    const screenAngle = this.peripheralAngle - v.angle
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 2.6)
    const cx = w / 2 + Math.cos(screenAngle) * (Math.min(w, h) * 0.42)
    const cy = h / 2 + Math.sin(screenAngle) * (Math.min(w, h) * 0.42)
    const r = Math.min(w, h) * 0.5
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, r)
    const a = 0.12 + pulse * 0.1
    g.addColorStop(0, `rgba(120,40,30,${(a * 0.35).toFixed(3)})`)
    g.addColorStop(1, 'rgba(120,40,30,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawBloodVignette(ctx: CanvasRenderingContext2D, w: number, h: number, blood: number): void {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.72)
    g.addColorStop(0, 'rgba(120,10,8,0)')
    g.addColorStop(0.72, `rgba(120,10,8,${(blood * 0.16).toFixed(3)})`)
    g.addColorStop(1, `rgba(150,16,12,${(blood * 0.5).toFixed(3)})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }

  private drawStatic(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number): void {
    ctx.save()
    for (let i = 0; i < Math.floor(16 * intensity); i++) {
      const y = Math.random() * h
      const x = Math.random() * w * 0.6
      const len = 20 + Math.random() * 90
      ctx.fillStyle = `rgba(180,180,190,${(Math.random() * 0.12 * intensity).toFixed(3)})`
      ctx.fillRect(x, y, len, 1)
    }
    ctx.restore()
  }

  private drawHud(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
    const touch = this.isTouchDevice
    const barW = touch ? 120 : 176
    const barH = touch ? 9 : 15
    const x = touch ? w - barW - 20 : 22
    const yComp = touch ? 16 : _h - 92
    const yStam = touch ? 52 : _h - 46
    const yNoise = touch ? 88 : _h - 138
    const stamRatio = this.player.stamina / this.player.maxStamina
    const compRatio = this.player.composure / this.player.maxComposure
    const exhausted = this.player.exhausted
    const compLow = compRatio <= 0.5

    this.drawStatBar(
      ctx, x, yComp, barW, barH, compRatio,
      compLow ? '#f2695a' : '#d9dee8',
      'COMPOSURE', compLow ? 'UNRAVELLING' : '', compRatio <= 0.3, touch,
    )
    this.drawStatBar(
      ctx, x, yStam, barW, barH, stamRatio,
      exhausted ? '#e8634f' : '#4fd8e8',
      'STAMINA', exhausted ? 'SPENT' : '', exhausted || stamRatio <= 0.3, touch,
    )

    // noise meter: crouch ~0.08 / walk ~0.35 / sprint 1.0
    const noiseRatio = clamp(this.player.noise, 0, 1)
    const noisy = this.player.noise > 0.15
    this.drawStatBar(
      ctx, x, yNoise, barW, barH, noiseRatio,
      noisy ? '#e0b04f' : '#9aa6b8',
      'NOISE', noisy ? (this.player.crouching ? 'LOUD' : this.player.running ? 'SHOUT' : 'HEARD') : 'SILENT',
      noisy, touch,
    )

    const mode = this.player.mode
    if (mode === 'crouch' || mode === 'run') {
      ctx.save()
      ctx.font = touch ? '8px monospace' : '9px monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = 'rgba(200,210,220,0.65)'
      ctx.fillText(mode === 'crouch' ? 'SNEAKING' : 'RUNNING', x + 2, yComp - 5)
      ctx.restore()
    }
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
  }

  private hexA(hex: string, a: number): string {
    const num = parseInt(hex.slice(1), 16)
    const r = (num >> 16) & 0xff
    const g = (num >> 8) & 0xff
    const b = num & 0xff
    return `rgba(${r},${g},${b},${a.toFixed(3)})`
  }

  private shadeColor(hex: string, amt: number): string {
    const num = parseInt(hex.slice(1), 16)
    const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amt))
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt))
    const b = Math.max(0, Math.min(255, (num & 0xff) + amt))
    return `rgb(${r},${g},${b})`
  }

  private drawLightningIcon(ctx: CanvasRenderingContext2D, x: number, y: number, hex: string): void {
    ctx.save()
    ctx.fillStyle = this.hexA(hex, 0.95)
    ctx.beginPath()
    ctx.moveTo(x + 3, y - 8)
    ctx.lineTo(x - 2, y + 1)
    ctx.lineTo(x + 1, y + 1)
    ctx.lineTo(x - 1, y + 8)
    ctx.lineTo(x + 6, y - 1)
    ctx.lineTo(x + 2, y - 1)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  private drawHeartIcon(ctx: CanvasRenderingContext2D, x: number, y: number, hex: string): void {
    ctx.save()
    ctx.fillStyle = this.hexA(hex, 0.95)
    ctx.beginPath()
    ctx.moveTo(x, y + 7)
    ctx.bezierCurveTo(x - 10, y, x - 5, y - 9, x, y - 3)
    ctx.bezierCurveTo(x + 5, y - 9, x + 10, y, x, y + 7)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  private drawStatBar(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    ratio: number, hex: string, label: string, status: string, low: boolean, compact: boolean,
  ): void {
    ctx.save()

    const padX = compact ? 5 : 7
    const panelW = w + padX * 2
    const panelH = h + (compact ? 22 : 30)
    const trackX = x + (compact ? 20 : 27)
    const trackY = y + (compact ? 11 : 14)
    const trackW = w - (compact ? 20 : 27)
    const iconX = x + (compact ? 7 : 9)
    const iconY = y + panelH / 2 - 1

    // outer panel
    this.roundRect(ctx, x, y, panelW, panelH, compact ? 4 : 6)
    ctx.fillStyle = 'rgba(5,6,9,0.78)'
    ctx.fill()
    ctx.strokeStyle = low ? 'rgba(240,110,90,0.55)' : 'rgba(190,200,215,0.3)'
    ctx.lineWidth = 1.2
    ctx.stroke()

    // corner accents
    ctx.strokeStyle = low ? 'rgba(240,110,90,0.4)' : 'rgba(200,210,225,0.22)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + 2, y + 8)
    ctx.lineTo(x + 2, y + 2)
    ctx.lineTo(x + 8, y + 2)
    ctx.moveTo(x + panelW - 2, y + panelH - 8)
    ctx.lineTo(x + panelW - 2, y + panelH - 2)
    ctx.lineTo(x + panelW - 8, y + panelH - 2)
    ctx.stroke()

    // icon
    if (label === 'STAMINA') this.drawLightningIcon(ctx, iconX, iconY, hex)
    else this.drawHeartIcon(ctx, iconX, iconY, hex)

    // track
    this.roundRect(ctx, trackX, trackY, trackW, h, compact ? 3 : 4)
    ctx.fillStyle = 'rgba(2,3,5,0.7)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.stroke()

    // gradient fill
    const fillW = Math.max(0, Math.min(trackW, trackW * ratio))
    if (fillW > 0.5) {
      const grad = ctx.createLinearGradient(trackX, trackY, trackX, trackY + h)
      grad.addColorStop(0, this.hexA(hex, 0.95))
      grad.addColorStop(1, this.shadeColor(hex, -38))
      this.roundRect(ctx, trackX, trackY, fillW, h, compact ? 3 : 4)
      ctx.fillStyle = grad
      ctx.fill()
    }

    // segment notches
    ctx.strokeStyle = 'rgba(4,5,8,0.55)'
    ctx.lineWidth = 1
    const segs = compact ? 6 : 8
    for (let i = 1; i < segs; i++) {
      const sx = trackX + (trackW / segs) * i
      ctx.beginPath()
      ctx.moveTo(sx, trackY + 1)
      ctx.lineTo(sx, trackY + h - 1)
      ctx.stroke()
    }

    // low-state pulse glow
    if (low && ratio < 0.35) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 9)
      ctx.strokeStyle = `rgba(240,110,90,${(0.2 + 0.35 * pulse).toFixed(3)})`
      ctx.lineWidth = 2
      this.roundRect(ctx, trackX - 1.5, trackY - 1.5, trackW + 3, h + 3, compact ? 4 : 5)
      ctx.stroke()
    }

    // labels
    ctx.font = compact ? '8px monospace' : '9px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = 'rgba(215,222,232,0.9)'
    ctx.fillText(label, x + padX, y + panelH - 3)
    if (status) {
      const tw = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(240,120,105,0.95)'
      ctx.fillText(status, x + padX + tw + (compact ? 6 : 10), y + panelH - 3)
    }
    ctx.restore()
  }

  private drawTouchUI(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const s = this.input.getTouchScale(w, h)
    const joyX = 70 * s
    const joyY = h - 136 * s
    const joyR = 46 * s
    const knobR = 20 * s

    ctx.strokeStyle = 'rgba(200,200,220,0.25)'
    ctx.fillStyle = 'rgba(200,200,220,0.12)'
    if (this.input.joystickActive) {
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(this.input.joystickCenter.x, this.input.joystickCenter.y, joyR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(this.input.joystickCenter.x + this.input.joystickOffset.x, this.input.joystickCenter.y + this.input.joystickOffset.y, knobR, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(joyX, joyY, joyR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = 'rgba(200,200,220,0.08)'
      ctx.beginPath()
      ctx.arc(joyX, joyY, knobR, 0, Math.PI * 2)
      ctx.fill()
    }

    // movement D-pad (bottom right) — labelled W/A/S/D like desktop keys
    this.drawPadButton(ctx, this.input.getDpadUpCenter(w, h), 'W', this.input.pad.up, s)
    this.drawPadButton(ctx, this.input.getDpadDownCenter(w, h), 'S', this.input.pad.down, s)
    this.drawPadButton(ctx, this.input.getDpadLeftCenter(w, h), 'A', this.input.pad.left, s)
    this.drawPadButton(ctx, this.input.getDpadRightCenter(w, h), 'D', this.input.pad.right, s)
  }

  private drawPadButton(ctx: CanvasRenderingContext2D, center: Vec2, key: string, pressed: boolean, s: number): void {
    const { x, y } = center
    ctx.save()
    const r = 24 * s
    ctx.fillStyle = pressed ? 'rgba(150,180,200,0.3)' : 'rgba(10,12,16,0.6)'
    ctx.strokeStyle = pressed ? 'rgba(210,230,245,0.8)' : 'rgba(200,200,220,0.35)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = pressed ? 'rgba(230,240,250,0.95)' : 'rgba(205,205,220,0.7)'
    ctx.font = `${Math.round(14 * s)}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(key, x, y + 1)
    ctx.restore()
  }

  private drawCrosshair(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const r = 7
    const gap = 3
    ctx.strokeStyle = 'rgba(220,225,235,0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx - r, cy)
    ctx.lineTo(cx - gap, cy)
    ctx.moveTo(cx + gap, cy)
    ctx.lineTo(cx + r, cy)
    ctx.moveTo(cx, cy - r)
    ctx.lineTo(cx, cy - gap)
    ctx.moveTo(cx, cy + gap)
    ctx.lineTo(cx, cy + r)
    ctx.stroke()
    ctx.fillStyle = 'rgba(220,225,235,0.5)'
    ctx.beginPath()
    ctx.arc(cx, cy, 1.2, 0, Math.PI * 2)
    ctx.fill()
  }

  private applyGlitch(): void {
    if (!this.canvas.style) return
    const d = this.dangerFactor
    let f = `brightness(${1 - d * 0.05}) contrast(${1 + d * 0.06}) saturate(${1 - d * 0.1})`
    if (this.state === 'DEAD') {
      f = 'brightness(0.6) saturate(0.4) hue-rotate(310deg)'
    }
    this.canvas.style.filter = f
  }

  private drawDebug(ctx: CanvasRenderingContext2D): void {
    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(0,255,120,0.9)'
    ctx.textAlign = 'left'
    const lines = [
      `FPS: ${this.fps}`,
      `Player: ${this.player.pos.x.toFixed(0)}, ${this.player.pos.y.toFixed(0)}`,
      `Creature: ${this.creature.pos.x.toFixed(0)}, ${this.creature.pos.y.toFixed(0)}`,
      `State: ${this.creature.state}`,
      `Dist: ${Math.hypot(this.creature.pos.x - this.player.pos.x, this.creature.pos.y - this.player.pos.y).toFixed(0)}`,
      `Level: ${this.levelIndex}`,
    ]
    lines.forEach((l, i) => ctx.fillText(l, 10, 20 + i * 16))
    ctx.textAlign = 'left'
  }

  private fps = 0
}
