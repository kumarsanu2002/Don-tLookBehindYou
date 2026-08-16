import type { Vec2 } from '../types'
import { moveCircle } from './Collision'

export type MoveMode = 'crouch' | 'walk' | 'run'

export interface PlayerConfig {
  radius: number
  speed: number
  visionRadius: number
  visionHalfAngle: number
  visionIntensity: number
}

export const MAX_STAMINA = 100
export const MAX_COMPOSURE = 100
/** how much the creature takes per graze attack (2 grazes = death) */
export const GRAZE_COST = 50
/** seconds of continuous running before stamina starts draining */
export const RUN_GRACE_SECONDS = 3
/** stamina drain per second of running (full bar depletes in 3s) */
export const STAMINA_DRAIN_PER_SEC = MAX_STAMINA / 3

export class Player {
  pos: Vec2
  face = 0
  vx = 0
  vy = 0
  moving = false
  walking = 0
  stepTimer = 0
  bobTime = 0
  bobOffset = 0
  radius: number
  speed: number
  visionRadius: number
  visionHalfAngle: number
  visionIntensity: number

  stamina = MAX_STAMINA
  maxStamina = MAX_STAMINA
  exhausted = false
  /** seconds spent running continuously */
  runTime = 0
  /** set when stamina runs out mid-run (kills the player) */
  staminaDead = false
  /** current movement mode resolved from input + stamina this frame */
  mode: MoveMode = 'walk'
  crouching = false
  running = false
  /** noise emitted to the world, 0..1 (crouch ~0, walk ~0.35, run ~1) */
  noise = 0
  /** psychic health; the Watcher drains it when it grazes you */
  composure = MAX_COMPOSURE
  maxComposure = MAX_COMPOSURE
  /** visual/audio flash when the creature grazes you */
  grazeFlash = 0

  private solids: () => import('../types').Rect[]
  private stepInterval = 0.42

  constructor(start: Vec2, cfg: PlayerConfig, solids: () => import('../types').Rect[]) {
    this.pos = { ...start }
    this.radius = cfg.radius
    this.speed = cfg.speed
    this.visionRadius = cfg.visionRadius
    this.visionHalfAngle = cfg.visionHalfAngle
    this.visionIntensity = cfg.visionIntensity
    this.solids = solids
  }

  reset(start: Vec2): void {
    this.pos = { ...start }
    this.vx = 0
    this.vy = 0
    this.stepTimer = 0
    this.stamina = MAX_STAMINA
    this.exhausted = false
    this.runTime = 0
    this.staminaDead = false
    this.running = false
    this.crouching = false
    this.noise = 0
    this.grazeFlash = 0
  }

  /** restore composure (checkpoints / respawn) */
  restoreComposure(): void {
    this.composure = MAX_COMPOSURE
    this.grazeFlash = 0
  }

  setFace(angle: number): void {
    this.face = angle
  }

  /** resolve the actual move mode from held input + stamina + low composure */
  private resolveMode(wantRun: boolean, wantCrouch: boolean): MoveMode {
    if (wantCrouch) return 'crouch'
    if (wantRun && !this.exhausted && this.composure > 25) return 'run'
    return 'walk'
  }

  update(dt: number, moveX: number, moveY: number, wantRun: boolean, wantCrouch: boolean): { step: boolean } {
    const mode = this.resolveMode(wantRun, wantCrouch)
    this.mode = mode
    this.running = mode === 'run'
    this.crouching = mode === 'crouch'

    const speedMul = mode === 'crouch' ? 0.55 : mode === 'run' ? 1.7 : 1
    const speed = this.speed * speedMul
    const res = moveCircle(
      this.pos.x,
      this.pos.y,
      this.radius,
      moveX * speed * dt,
      moveY * speed * dt,
      { walls: [], solids: this.solids() },
    )
    this.vx = moveX * speed
    this.vy = moveY * speed
    this.pos.x = res.x
    this.pos.y = res.y

    this.moving = moveX !== 0 || moveY !== 0
    this.bobTime += dt * (this.moving ? speed / this.radius : 1) * 2.2
    this.bobOffset = this.moving ? Math.abs(Math.sin(this.bobTime)) * 2.4 : 0

    // stamina: drains while running, recovers otherwise
    if (this.running && this.moving) {
      this.runTime += dt
      // grace period: the first RUN_GRACE_SECONDS of continuous running are free
      if (this.runTime > RUN_GRACE_SECONDS) {
        this.stamina = Math.max(0, this.stamina - dt * STAMINA_DRAIN_PER_SEC)
        if (this.stamina <= 0) {
          this.exhausted = true
          this.staminaDead = true
        }
      }
    } else {
      this.runTime = 0
      const regen = this.moving ? 9 : 16
      this.stamina = Math.min(MAX_STAMINA, this.stamina + dt * regen)
      if (this.stamina > 30) this.exhausted = false
    }

    // noise emitted to the creature
    if (!this.moving) {
      this.noise = 0
    } else if (mode === 'crouch') {
      this.noise = 0.08
    } else if (mode === 'run') {
      this.noise = 1
    } else {
      this.noise = 0.35
    }

    // graze flash decay
    this.grazeFlash = Math.max(0, this.grazeFlash - dt * 1.6)

    let step = false
    if (this.moving) {
      const stepDist = speed * dt
      this.stepTimer -= stepDist
      if (this.stepTimer <= 0) {
        this.stepTimer = this.stepInterval
        step = true
      }
    } else {
      this.stepTimer = 0.1
    }
    return { step }
  }

  faceAngleTo(wx: number, wy: number): number {
    return Math.atan2(wy - this.pos.y, wx - this.pos.x)
  }

  visionState(): Vec2 {
    return { x: this.pos.x, y: this.pos.y }
  }
}
