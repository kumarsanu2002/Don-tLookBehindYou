import type { CreatureConfig, CreatureState, Vec2 } from '../types'
import { distSq } from './Collision'
import type { Pathfinder } from './Pathfinding'

export interface CreatureUpdateInfo {
  isVisible: boolean
  playerPos: Vec2
  /** how much noise the player is making 0..1 (run loud, crouch silent) */
  playerNoise: number
  time: number
  pathfinder: Pathfinder
  attackRange: number
  distanceToPlayer: number
  chaseDist: number
  forcedTarget: Vec2 | null
  activated: boolean
  /** waypoint route it patrols when it cannot sense the player */
  prowl: Vec2[]
  /** lure noise sources (radios, thrown decoys): { x, y, strength } */
  noiseSources: { x: number; y: number; strength: number }[]
  /** when true the creature is frozen in place (bell silent between tolls) */
  frozen: boolean
}

export class Creature {
  pos: Vec2
  prevPos: Vec2
  state: CreatureState = 'IDLE'
  stateTime = 0
  moveDelay = 0
  face = Math.PI
  speed: number
  chaseMul: number
  reactDelay: number
  twitch: number
  path: Vec2[] = []
  pathIdx = 0
  repathTimer = 0
  attackTimer = 0
  stunTimer = 0
  twitchTimer = 0
  twitchAmp = 0
  headTilt = 0
  walkPhase = 0
  bobOffset = 0
  /** set true by game when a kill should be processed */
  wantKill = false
  activationGrace = 1.2
  /** last position it heard/sensed the player at */
  lastKnownPos: Vec2 | null = null
  /** where the creature is currently headed (for debug) */
  targetPos: Vec2 | null = null
  prowl: Vec2[] = []
  private wanderTarget: Vec2 | null = null
  private wanderTimer = 0
  private prowlIdx = 0
  private prowlHold = 0

  constructor(start: Vec2, cfg: Partial<CreatureConfig> = {}) {
    this.pos = { ...start }
    this.prevPos = { ...start }
    this.speed = cfg.speed ?? 90
    this.chaseMul = cfg.chaseMul ?? 1.5
    this.reactDelay = cfg.reactDelay ?? 0.35
    this.twitch = cfg.twitch ?? 1
  }

  reset(start: Vec2): void {
    this.pos = { ...start }
    this.prevPos = { ...start }
    this.state = 'IDLE'
    this.stateTime = 0
    this.moveDelay = 0
    this.path = []
    this.pathIdx = 0
    this.attackTimer = 0
    this.stunTimer = 0
    this.wantKill = false
    this.wanderTarget = null
    this.lastKnownPos = null
    this.targetPos = null
    this.prowlIdx = 0
    this.prowlHold = 0
    this.activationGrace = 1.8
  }

  setProwl(points: Vec2[]): void {
    this.prowl = points
    this.prowlIdx = 0
    this.prowlHold = 0
  }

  stun(dur: number): void {
    this.stunTimer = Math.max(this.stunTimer, dur)
    this.state = 'STUNNED'
    this.path = []
  }

  get moving(): boolean {
    return this.state === 'HIDDEN' || this.state === 'CHASE' || this.state === 'SEARCH'
  }

  update(dt: number, info: CreatureUpdateInfo): void {
    this.prevPos.x = this.pos.x
    this.prevPos.y = this.pos.y
    this.stateTime += dt
    this.wantKill = false

    // stun overrides everything
    if (this.stunTimer > 0) {
      this.stunTimer -= dt
      this.state = 'STUNNED'
      if (this.stunTimer <= 0) {
        this.state = info.isVisible ? 'VISIBLE' : 'HIDDEN'
      }
      this.idleAnimate(dt)
      return
    }

    // the bell is silent: it is frozen, no matter what it can sense
    if (info.frozen) {
      if (this.state !== 'VISIBLE') {
        this.state = info.isVisible ? 'VISIBLE' : 'HIDDEN'
      }
      this.lastKnownPos = info.isVisible ? { ...info.playerPos } : this.lastKnownPos
      this.attackTimer = 0
      this.wantKill = false
      this.idleAnimate(dt)
      return
    }

    // idle before first activation
    if (this.state === 'IDLE') {
      this.activationGrace -= dt
      if (info.activated && this.activationGrace <= 0) {
        this.state = 'HIDDEN'
      } else {
        this.idleAnimate(dt)
        return
      }
    }

    if (info.isVisible) {
      // frozen while watched
      this.attackTimer = 0
      if (this.state !== 'VISIBLE') {
        this.state = 'VISIBLE'
        this.stateTime = 0
        this.moveDelay = 0
      }
      this.face = Math.atan2(info.playerPos.y - this.pos.y, info.playerPos.x - this.pos.x)
      this.lastKnownPos = { ...info.playerPos }
      this.idleAnimate(dt)
      return
    }

    // not visible: begin moving after a reaction delay
    if (this.state === 'VISIBLE') {
      this.state = 'HIDDEN'
      this.stateTime = 0
      this.moveDelay = this.reactDelay
      this.path = []
    }

    if (this.moveDelay > 0) {
      this.moveDelay -= dt
      this.idleAnimate(dt)
      return
    }

    // --- sensing: can it hear / sense the player or a lure? ---
    const senses = this.sensesPlayer(info)

    if (senses) {
      this.lastKnownPos = { ...info.playerPos }
    }

    // lures: the creature hunts noise first; radios & thrown decoys win over footsteps
    const lure = this.bestLure(info)

    let target: Vec2 | null = null
    let chasing = false
    if (lure && lure.target && lure.strength > 0) {
      target = lure.target
      chasing = true
    } else if (senses) {
      target = info.playerPos
      chasing = true
    } else if (this.lastKnownPos) {
      target = this.lastKnownPos
    }
    this.targetPos = target

    // state bookkeeping
    if (chasing) {
      if (this.state !== 'CHASE') {
        this.state = 'CHASE'
        this.stateTime = 0
      }
    } else if (target) {
      if (this.state !== 'SEARCH') {
        this.state = 'SEARCH'
        this.stateTime = 0
      }
    } else if (this.state !== 'HIDDEN') {
      this.state = 'HIDDEN'
    }

    if (target) {
      this.navigate(dt, target, info.pathfinder)
      if (target === this.lastKnownPos && target !== info.playerPos) {
        const d = Math.hypot(this.pos.x - target.x, this.pos.y - target.y)
        if (d < 44) {
          this.lastKnownPos = null
          this.targetPos = null
        }
      }
    } else {
      this.prowlOrWander(dt, info.pathfinder)
    }

    // attack check: only while actively sensing the player
    if (chasing && info.distanceToPlayer < info.attackRange) {
      this.attackTimer += dt
      const grace = 0.5
      if (this.attackTimer >= grace) {
        this.state = 'ATTACK'
        this.wantKill = true
      }
    } else {
      this.attackTimer = 0
    }
  }

  private sensesPlayer(info: CreatureUpdateInfo): boolean {
    // hard proximity: it feels you right next to it regardless of noise
    if (info.distanceToPlayer < 110) return true
    // audible footsteps: noise carries, but only so far
    // crouch is nearly silent; sprint can be heard across a room
    if (info.playerNoise > 0.15 && info.distanceToPlayer < 90 + info.playerNoise * 260) return true
    return false
  }

  /** pick the loudest lure noise source it can currently hear */
  private bestLure(info: CreatureUpdateInfo): { target: Vec2 | null; strength: number } {
    let best: { target: Vec2 | null; strength: number } = { target: null, strength: 0 }
    for (const ns of info.noiseSources) {
      const d = Math.hypot(ns.x - this.pos.x, ns.y - this.pos.y)
      const hearDist = 100 + ns.strength * 340
      if (d >= hearDist) continue
      const falloff = Math.max(0, 1 - d / hearDist)
      const w = ns.strength * falloff * falloff
      if (w > best.strength) best = { target: { x: ns.x, y: ns.y }, strength: w }
    }
    return best
  }

  private navigate(dt: number, target: Vec2, pathfinder: Pathfinder): void {
    const distToTargetSq = distSq(this.pos.x, this.pos.y, target.x, target.y)
    if (distToTargetSq < 40 * 40) {
      this.path = []
      this.pathIdx = 0
      // arrived: idle in place, SEARCH-ish
      this.state = 'SEARCH'
      this.idleAnimate(dt)
      return
    }

    this.repathTimer -= dt
    if (this.path.length === 0 || this.repathTimer <= 0) {
      this.path = pathfinder.findPath(this.pos, target)
      this.pathIdx = 0
      this.repathTimer = 0.35
    }

    if (this.path.length === 0) {
      // no path: wander slowly
      this.wander(dt, target)
      return
    }

    let waypoint: Vec2 | null = this.path[this.pathIdx]
    while (waypoint && distSq(this.pos.x, this.pos.y, waypoint.x, waypoint.y) < 12 * 12) {
      this.pathIdx++
      if (this.pathIdx >= this.path.length) {
        this.path = []
        this.pathIdx = 0
        waypoint = null
        break
      }
      waypoint = this.path[this.pathIdx]
    }

    if (waypoint) {
      const spd = this.state === 'CHASE' ? this.speed * this.chaseMul : this.speed
      const dx = waypoint.x - this.pos.x
      const dy = waypoint.y - this.pos.y
      const d = Math.hypot(dx, dy) || 1
      const nx = dx / d
      const ny = dy / d
      // smooth steering
      const steer = Math.min(1, dt * 6)
      this.pos.x += nx * spd * dt
      this.pos.y += ny * spd * dt
      this.face = Math.atan2(ny, nx)
      this.walkPhase += dt * spd / 30
      this.bobOffset = Math.abs(Math.sin(this.walkPhase)) * 2.6
      void steer
    } else {
      this.idleAnimate(dt)
    }
  }

  /** patrol the level's waypoint route when the player can't be sensed */
  private prowlOrWander(dt: number, pathfinder: Pathfinder): void {
    if (this.prowl.length === 0) {
      this.wander(dt, this.pos)
      return
    }
    const wp = this.prowl[this.prowlIdx % this.prowl.length]
    const d = Math.hypot(this.pos.x - wp.x, this.pos.y - wp.y)
    if (d < 30) {
      this.prowlHold += dt
      this.idleAnimate(dt)
      if (this.prowlHold > 1.1) {
        this.prowlHold = 0
        this.prowlIdx++
        this.path = []
      }
      return
    }
    this.navigate(dt, wp, pathfinder)
  }

  private wander(dt: number, target: Vec2): void {
    this.wanderTimer -= dt
    if (!this.wanderTarget || this.wanderTimer <= 0) {
      this.wanderTarget = {
        x: this.pos.x + (Math.random() - 0.5) * 300,
        y: this.pos.y + (Math.random() - 0.5) * 300,
      }
      this.wanderTimer = 1.5
    }
    const dx = this.wanderTarget.x - this.pos.x
    const dy = this.wanderTarget.y - this.pos.y
    const d = Math.hypot(dx, dy)
    if (d > 20) {
      const spd = this.speed * 0.6
      this.pos.x += (dx / d) * spd * dt
      this.pos.y += (dy / d) * spd * dt
      this.face = Math.atan2(dy, dx)
      this.walkPhase += dt * spd / 30
      this.bobOffset = Math.abs(Math.sin(this.walkPhase)) * 2
    } else {
      // drift back toward target generally
      this.pos.x += (target.x > this.pos.x ? 1 : -1) * this.speed * 0.3 * dt
      this.pos.y += (target.y > this.pos.y ? 1 : -1) * this.speed * 0.3 * dt
    }
  }

  private idleAnimate(dt: number): void {
    this.twitchTimer -= dt
    if (this.twitchTimer <= 0) {
      this.twitchTimer = 0.8 + Math.random() * 2.4
      this.twitchAmp = (Math.random() * 2 - 1) * 3 * this.twitch
      this.headTilt = (Math.random() * 2 - 1) * 0.5 * this.twitch
    }
    this.bobOffset = 0
    void dt
  }

  /** smooth visual position for interpolation (unused for now) */
  visualX(): number {
    return this.pos.x
  }
  visualY(): number {
    return this.pos.y
  }
}
