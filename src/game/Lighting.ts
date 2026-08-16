import type { Rect } from '../types'
import { castRay } from './Collision'

export interface VisionState {
  x: number
  y: number
  angle: number
  radius: number
  halfAngle: number
  intensity: number
}

export interface LightSource {
  x: number
  y: number
  radius: number
  color: string
  intensity: number
  flicker: number
  flickerSpeed: number
  phase: number
}

export interface FogLayer {
  x: number
  y: number
  radius: number
  speed: number
  offset: number
  alpha: number
}

function makeFog(seed: number): FogLayer[] {
  const layers: FogLayer[] = []
  for (let i = 0; i < 6; i++) {
    layers.push({
      x: (seed * 137.5 + i * 241.7) % 2000,
      y: (seed * 311.9 + i * 173.3) % 1000,
      radius: 180 + ((i * 97) % 180),
      speed: 3 + ((i * 13) % 8),
      offset: Math.random() * Math.PI * 2,
      alpha: 0.05 + ((i % 3) * 0.02),
    })
  }
  return layers
}

export class Lighting {
  private fog: FogLayer[]
  /** pre-rendered darkness canvas */
  private lightCv: HTMLCanvasElement
  private lightCtx: CanvasRenderingContext2D
  /** cached static light map in world coordinates (lamps etc.), rebuilt per level */
  private staticCv: HTMLCanvasElement | null = null
  private staticW = 0
  private staticH = 0
  private visionCacheKey = ''
  private visionCachePts: { x: number; y: number }[] = []
  private visionCacheWalls: Rect[] = []

  constructor(width: number, height: number, seed: number) {
    this.lightCv = document.createElement('canvas')
    this.lightCv.width = width
    this.lightCv.height = height
    this.lightCtx = this.lightCv.getContext('2d', { willReadFrequently: false })!
    this.fog = makeFog(seed)
  }

  get canvas(): HTMLCanvasElement {
    return this.lightCv
  }

  /** Build a world-space light map for static sources (lamps). Called once per level. */
  buildStaticLights(lightSources: LightSource[], worldW: number, worldH: number): void {
    this.staticCv = document.createElement('canvas')
    this.staticCv.width = Math.max(1, worldW)
    this.staticCv.height = Math.max(1, worldH)
    this.staticW = worldW
    this.staticH = worldH
    const ctx = this.staticCv.getContext('2d')!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, worldW, worldH)
    for (const ls of lightSources) {
      if (ls.intensity <= 0) continue
      const r = ls.radius * ls.intensity
      if (r <= 0) continue
      const g = ctx.createRadialGradient(ls.x, ls.y, 2, ls.x, ls.y, r)
      const a = 0.9
      g.addColorStop(0, `rgba(0,0,0,${a.toFixed(3)})`)
      g.addColorStop(0.5, `rgba(0,0,0,${(a * 0.5).toFixed(3)})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(ls.x, ls.y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  clearStaticLights(): void {
    this.staticCv = null
  }

  /**
   * Compute the vision polygon by casting rays from the player position out to
   * the vision radius, stopping at walls. Returns ordered points.
   * Results are cached while the player and walls are effectively static.
   */
  computeVisionPolygon(vision: VisionState, walls: Rect[]): { x: number; y: number }[] {
    const key = `${vision.x.toFixed(2)}|${vision.y.toFixed(2)}|${vision.angle.toFixed(3)}`
    if (key === this.visionCacheKey && walls === this.visionCacheWalls && this.visionCachePts.length > 0) {
      return this.visionCachePts
    }
    const pts: { x: number; y: number }[] = []
    const steps = Math.max(8, Math.ceil(vision.halfAngle * 2 / 0.015))
    for (let i = 0; i <= steps; i++) {
      const a = vision.angle - vision.halfAngle + (vision.halfAngle * 2 * i) / steps
      const dx = Math.cos(a)
      const dy = Math.sin(a)
      const dist = castRay(vision.x, vision.y, dx, dy, walls, vision.radius)
      pts.push({ x: vision.x + dx * dist, y: vision.y + dy * dist })
    }
    this.visionCacheKey = key
    this.visionCacheWalls = walls
    this.visionCachePts = pts
    return pts
  }

  /**
   * Render the darkness/lighting overlay. Called each frame with the light
   * canvas matching the viewport.
   */
  render(
    cam: { x: number; y: number },
    viewW: number,
    viewH: number,
    vision: VisionState,
    lightSources: LightSource[],
    walls: Rect[],
    time: number,
    ambient: {
      darkness: number
      tint: string
      flickerIntensity: number
    },
  ): void {
    const ctx = this.lightCtx
    const halfW = viewW / 2
    const halfH = viewH / 2
    const camX = cam.x - halfW
    const camY = cam.y - halfH

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, this.lightCv.width, this.lightCv.height)

    // base darkness
    const flicker = 1 + (Math.sin(time * 1.7) * 0.015 + Math.sin(time * 7.3) * 0.01) * ambient.flickerIntensity
    const darkness = Math.min(0.97, ambient.darkness * flicker)
    ctx.fillStyle = `rgba(3,3,8,${darkness.toFixed(3)})`
    ctx.fillRect(0, 0, this.lightCv.width, this.lightCv.height)

    ctx.globalCompositeOperation = 'destination-out'

    // player ambient glow (soft visibility for navigation)
    const px = vision.x - camX
    const py = vision.y - camY
    const ambientR = vision.radius * 0.28
    let g = ctx.createRadialGradient(px, py, 4, px, py, ambientR)
    g.addColorStop(0, 'rgba(0,0,0,0.55)')
    g.addColorStop(0.6, 'rgba(0,0,0,0.22)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(px, py, ambientR, 0, Math.PI * 2)
    ctx.fill()

    // vision cone
    const poly = this.computeVisionPolygon(vision, walls)
    if (poly.length >= 3) {
      ctx.beginPath()
      ctx.moveTo(px, py)
      for (const p of poly) ctx.lineTo(p.x - camX, p.y - camY)
      ctx.closePath()
      g = ctx.createRadialGradient(px, py, 4, px, py, vision.radius)
      const core = Math.min(1, vision.intensity * 0.5 + 0.5)
      g.addColorStop(0, `rgba(0,0,0,${(0.97 * core).toFixed(3)})`)
      g.addColorStop(0.5, `rgba(0,0,0,${(0.9 * core).toFixed(3)})`)
      g.addColorStop(0.85, `rgba(0,0,0,${(0.6 * core).toFixed(3)})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fill()
    }

    // static light map (cached per level, drawn once as a blit)
    if (this.staticCv) {
      // subtle global flicker over the cached lamps
      const lf = 1 + (Math.sin(time * 4.3) * 0.04 + Math.sin(time * 11.7) * 0.02) * ambient.flickerIntensity
      ctx.globalAlpha = Math.max(0.6, Math.min(1.05, lf))
      const sx = Math.max(0, camX)
      const sy = Math.max(0, camY)
      const sw = Math.min(this.staticW - sx, viewW)
      const sh = Math.min(this.staticH - sy, viewH)
      if (sw > 0 && sh > 0) {
        ctx.drawImage(this.staticCv, sx, sy, sw, sh, sx - camX, sy - camY, sw, sh)
      }
      ctx.globalAlpha = 1
    }

    // dynamic light sources
    for (const ls of lightSources) {
      const lx = ls.x - camX
      const ly = ls.y - camY
      const flick = 1 + Math.sin(time * ls.flickerSpeed + ls.phase) * ls.flicker + Math.sin(time * ls.flickerSpeed * 3.1) * ls.flicker * 0.5
      const r = ls.radius * Math.max(0.35, flick) * ls.intensity
      if (r <= 0) continue
      g = ctx.createRadialGradient(lx, ly, 2, lx, ly, r)
      const a = 0.9 * Math.min(1, flick)
      g.addColorStop(0, `rgba(0,0,0,${a.toFixed(3)})`)
      g.addColorStop(0.5, `rgba(0,0,0,${(a * 0.5).toFixed(3)})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(lx, ly, r, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.globalCompositeOperation = 'source-over'

    // tint
    if (ambient.tint && ambient.tint !== 'transparent') {
      ctx.fillStyle = ambient.tint
      ctx.fillRect(0, 0, this.lightCv.width, this.lightCv.height)
    }

    // fog overlay
    const fogAlpha = 0.12
    for (const f of this.fog) {
      const fx = (((f.x + cam.x * 0.25 + time * f.speed + Math.sin(time * 0.2 + f.offset) * 30) % 2600) + 2600) % 2600 - 300
      const fy = (((f.y + cam.y * 0.2 + Math.cos(time * 0.13 + f.offset) * 24) % 1400) + 1400) % 1400 - 200
      const sx = fx - camX
      const sy = fy - camY
      g = ctx.createRadialGradient(sx, sy, 10, sx, sy, f.radius)
      g.addColorStop(0, `rgba(60,60,70,${(fogAlpha * f.alpha).toFixed(3)})`)
      g.addColorStop(1, 'rgba(60,60,70,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(sx, sy, f.radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /** draw vignette on the main ctx */
  drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, danger: number): void {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72)
    const edge = 0.55 + danger * 0.4
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(0.55, `rgba(0,0,0,${(danger * 0.25).toFixed(3)})`)
    g.addColorStop(1, `rgba(0,0,0,${edge.toFixed(3)})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
}
