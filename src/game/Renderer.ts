import type { GameObject, LevelData, Rect } from '../types'
import { Creature } from './Creature'
import { ParticleSystem } from './ParticleSystem'
import { Player } from './Player'
import type { VisionState } from './Lighting'
import { rectCenter } from './Collision'

export interface RenderState {
  time: number
  level: LevelData
  player: Player
  creature: Creature
  particles: ParticleSystem
  creatureVisible: boolean
  creatureMirrorIds: string[]
  mirrorHintIds: string[]
  creatureCloseHint: boolean
  doorsOpenProgress: Record<string, number>
  doorWobble: Record<string, number>
  debug: boolean
  danger: number
  checkpointFlash: number
  laserBlocked: Record<string, boolean>
  spotlightStunned: Record<string, boolean>
  winBeam: number
  vision: VisionState
  reducedFlicker: boolean
  reducedMotion: boolean
  colorblind: boolean
  playerMode: 'crouch' | 'walk' | 'run'
  stamina: number
  maxStamina: number
  composure: number
  maxComposure: number
  grazeFlash: number
  deathProgress: number
  blinkActive: boolean
  blinkFlicker: number
  peripheralActive: boolean
  peripheralAngle: number
  laserReflectedSegments: Record<string, { x0: number; y0: number; x1: number; y1: number }[]>
  holdProgress: Record<string, number>
}

export class Renderer {
  private crackSeed = 1234567
  /** cached static floor layer (per-level), avoids per-tile shadow work every frame */
  private floorCache: HTMLCanvasElement | null = null
  private floorCacheLevel = -1

  private hash(x: number, y: number): number {
    let h = (x * 374761393 + y * 668265263 + this.crackSeed) | 0
    h = (h ^ (h >> 13)) * 1274126177
    return ((h ^ (h >> 16)) >>> 0) / 4294967295
  }

  render(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, halfW: number, halfH: number, s: RenderState): void {
    const lvl = s.level
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.translate(-cam.x + halfW, -cam.y + halfH)

    this.drawFloor(ctx, lvl, cam, halfW, halfH)
    this.drawDepthSorted(ctx, lvl, s)
    this.drawLasers(ctx, lvl, s)
    this.drawMirrorReflections(ctx, lvl, s)
    this.drawSpotlightBeams(ctx, lvl)
    s.particles.render(ctx, { x: cam.x - halfW, y: cam.y - halfH })
  }

  private drawFloor(ctx: CanvasRenderingContext2D, lvl: LevelData, cam: { x: number; y: number }, halfW: number, halfH: number): void {
    const cache = this.ensureFloorCache(lvl)
    const sx = cam.x - halfW
    const sy = cam.y - halfH
    ctx.drawImage(cache, sx, sy, halfW * 2, halfH * 2, sx, sy, halfW * 2, halfH * 2)
  }

  private ensureFloorCache(lvl: LevelData): HTMLCanvasElement {
    if (this.floorCache && this.floorCacheLevel === lvl.id) return this.floorCache
    const cv = document.createElement('canvas')
    cv.width = Math.max(1, Math.ceil(lvl.width))
    cv.height = Math.max(1, Math.ceil(lvl.height))
    const c = cv.getContext('2d')!
    this.renderFloorStatic(c, lvl)
    this.floorCache = cv
    this.floorCacheLevel = lvl.id
    return cv
  }

  private renderFloorStatic(ctx: CanvasRenderingContext2D, lvl: LevelData): void {
    const cols = Math.ceil(lvl.width / 48)
    const rows = Math.ceil(lvl.height / 48)

    // base floor
    ctx.fillStyle = '#0b0a0e'
    ctx.fillRect(0, 0, lvl.width, lvl.height)

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const px = tx * 48
        const py = ty * 48
        const h = this.hash(tx, ty)
        if (h < 0.35) {
          const shade = 0.045 + h * 0.05
          ctx.fillStyle = `rgba(255,255,255,${shade.toFixed(3)})`
          ctx.fillRect(px + 2, py + 2, 44, 44)
        }
        // grime
        if (h > 0.93) {
          ctx.fillStyle = 'rgba(0,0,0,0.35)'
          const ox = (h * 37) % 24
          const oy = (h * 53) % 24
          ctx.fillRect(px + ox, py + oy, 14, 10)
        }
        // floor crack
        if (h > 0.72 && h < 0.76) {
          ctx.strokeStyle = 'rgba(0,0,0,0.5)'
          ctx.beginPath()
          ctx.moveTo(px, py + 24)
          ctx.lineTo(px + 14, py + 18 + ((h * 17) % 6))
          ctx.lineTo(px + 34, py + 26)
          ctx.lineTo(px + 48, py + 20)
          ctx.stroke()
        }
      }
    }

    // wall contact shadows: ambient occlusion halo + cast drop shadow
    for (const w of lvl.walls) {
      ctx.fillStyle = 'rgba(0,0,0,0.16)'
      ctx.fillRect(w.x - 4, w.y - 4, w.w + 8, w.h + 8)
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(w.x + 3, w.y + 4, w.w + 1, w.h + 1)
    }
  }

  /**
   * Draw walls, objects, creature and player sorted by screen depth so that
   * anything standing "behind" a wall is occluded by its raised front face.
   */
  private drawDepthSorted(ctx: CanvasRenderingContext2D, lvl: LevelData, s: RenderState): void {
    const items: { d: number; kind: number; ref: Rect | GameObject | Creature | Player }[] = []
    for (const w of lvl.walls) items.push({ d: w.y + w.h, kind: 0, ref: w })
    for (const o of lvl.objects) items.push({ d: o.y + o.h, kind: 1, ref: o })
    items.push({ d: s.creature.pos.y + 18, kind: 2, ref: s.creature })
    items.push({ d: s.player.pos.y + 14, kind: 3, ref: s.player })

    items.sort((a, b) => a.d - b.d)

    for (const it of items) {
      if (it.kind === 0) this.drawWall(ctx, it.ref as Rect, s)
      else if (it.kind === 1) this.drawOneObject(ctx, it.ref as GameObject, s)
      else if (it.kind === 2) this.drawCreature(ctx, s)
      else this.drawPlayer(ctx, s.player)
    }
  }

  /** Wall rendered as a low 3D block: raised top face + extruded front face. */
  private drawWall(ctx: CanvasRenderingContext2D, w: Rect, s: RenderState): void {
    const px = w.x
    const py = w.y
    const pw = w.w
    const ph = w.h
    const ext = 10
    const t = this.hash(px, py)
    const dist = Math.hypot(s.player.pos.x - (px + pw / 2), s.player.pos.y - (py + ph / 2))
    const fog = Math.min(0.5, Math.max(0, (dist - 300) / 900)) * 0.55

    // extruded front face (south face of the block)
    const fg = ctx.createLinearGradient(0, py + ph, 0, py + ph + ext)
    fg.addColorStop(0, '#0d0c12')
    fg.addColorStop(1, '#040308')
    ctx.fillStyle = fg
    ctx.fillRect(px, py + ph, pw, ext)
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    for (let bx = px + 12; bx < px + pw - 4; bx += 24) ctx.fillRect(bx, py + ph, 2, ext)

    // raised top face
    const v = 20 + t * 6
    ctx.fillStyle = `rgb(${Math.round(v)},${Math.round(v - 1)},${Math.round(v + 4)})`
    ctx.fillRect(px, py, pw, ph)

    // brick courses with staggered vertical mortar
    const brickH = 12
    for (let by = py; by < py + ph; by += brickH) {
      const row = Math.floor(by / brickH)
      const stagger = row % 2 === 0 ? 0 : 8
      ctx.fillStyle = 'rgba(255,255,255,0.10)'
      ctx.fillRect(px, by, pw, 1)
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(px, by + brickH - 1, pw, 1)
      ctx.fillStyle = 'rgba(0,0,0,0.26)'
      for (let bx = px + 12 + stagger; bx < px + pw - 4; bx += 24) {
        ctx.fillRect(bx, by + 1, 2, brickH - 2)
      }
    }

    // top edge catches light, bottom edge of the face falls into shadow
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    ctx.fillRect(px, py, pw, 2)
    ctx.fillStyle = 'rgba(0,0,0,0.38)'
    ctx.fillRect(px, py + ph - 2, pw, 2)

    // distance fog: far walls sink into the dark
    if (fog > 0.01) {
      ctx.fillStyle = `rgba(0,0,0,${fog.toFixed(3)})`
      ctx.fillRect(px, py, pw, ph + ext)
    }
  }

  private drawOneObject(ctx: CanvasRenderingContext2D, o: GameObject, s: RenderState): void {
    switch (o.type) {
      case 'door':
        this.drawDoor(ctx, o, s)
        break
      case 'key':
        if (!o.taken) this.drawKey(ctx, o, s)
        break
      case 'switch':
        this.drawSwitch(ctx, o, s)
        break
      case 'pressurePlate':
        this.drawPlate(ctx, o, s)
        break
      case 'generator':
        this.drawGenerator(ctx, o)
        break
      case 'battery':
        if (!o.taken) this.drawBattery(ctx, o)
        break
      case 'mirror':
        this.drawMirror(ctx, o, s)
        break
      case 'lever':
        this.drawLever(ctx, o, s)
        break
      case 'checkpoint':
        this.drawCheckpoint(ctx, o, s.checkpointFlash, s.time)
        break
      case 'exit':
        this.drawExit(ctx, o, s)
        break
      case 'spotlight':
        this.drawSpotlightFixture(ctx, o)
        break
      case 'note':
        this.drawNote(ctx, o)
        break
      case 'lamp':
        this.drawLamp(ctx, o)
        break
      case 'crank':
        this.drawCrank(ctx, o, s)
        break
      case 'radio':
        this.drawRadio(ctx, o, s)
        break
      case 'decoy':
        this.drawDecoy(ctx, o, s)
        break
      case 'bell':
        this.drawBell(ctx, o, s)
        break
      default:
        break
    }
  }

  private drawDoor(ctx: CanvasRenderingContext2D, d: Extract<GameObject, { type: 'door' }>, s: RenderState): void {
    const prog = s.doorsOpenProgress[d.id] ?? 0
    const c = rectCenter(d)
    const w = d.w
    const h = d.h
    // frame
    ctx.fillStyle = '#1b1a22'
    ctx.fillRect(d.x - 2, d.y - 2, w + 4, h + 4)
    // panel
    const slide = prog * (d.slideDir === 'up' || d.slideDir === 'left' ? 1 : -1)
    let px = d.x
    let py = d.y
    let pw = w
    let ph = h
    if (d.slideDir === 'up') py = d.y - h * slide
    else if (d.slideDir === 'down') py = d.y + h * slide
    else if (d.slideDir === 'left') px = d.x - w * slide
    else px = d.x + w * slide

    ctx.fillStyle = 'rgba(60,58,72,0.95)'
    ctx.fillRect(px, py, pw, ph)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(px + 2, py + 2, Math.max(1, pw - 4), Math.max(1, ph - 4))
    // grinding wobble: a plate door shudders as it times out
    const wobble = s.doorWobble[d.id] ?? 0
    if (wobble > 0.01) {
      const jx = Math.sin(s.time * 46) * wobble * 3
      const jy = Math.sin(s.time * 57 + 1.3) * wobble * 2
      if (d.slideDir === 'up' || d.slideDir === 'down') px += jx
      else py += jy
      ctx.fillStyle = 'rgba(60,58,72,0.95)'
      ctx.fillRect(px, py, pw, ph)
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(px + 2, py + 2, Math.max(1, pw - 4), Math.max(1, ph - 4))
    }
    // rivets
    ctx.fillStyle = 'rgba(180,180,200,0.25)'
    for (const [rx, ry] of [[px + 6, py + 6], [px + pw - 10, py + 6], [px + 6, py + ph - 10], [px + pw - 10, py + ph - 10]]) {
      ctx.fillRect(rx, ry, 4, 4)
    }
    // status lamp on the frame: green when open, red when closed
    const lx = d.x + 5
    const ly = d.y + 5
    const lampOn = prog > 0.5
    const lampColor = lampOn ? '120,220,150' : '220,70,60'
    const pulse = 0.6 + Math.sin(s.time * 4) * 0.3 * (s.reducedFlicker ? 0.3 : 1)
    const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 10)
    lg.addColorStop(0, `rgba(${lampColor},${(0.2 + pulse * 0.2).toFixed(3)})`)
    lg.addColorStop(1, `rgba(${lampColor},0)`)
    ctx.fillStyle = lg
    ctx.beginPath()
    ctx.arc(lx, ly, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#14131a'
    ctx.beginPath()
    ctx.arc(lx, ly, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `rgba(${lampColor},${(0.85 + pulse * 0.15).toFixed(3)})`
    ctx.beginPath()
    ctx.arc(lx, ly, 2, 0, Math.PI * 2)
    ctx.fill()
    // lock plate
    if (!d.open) {
      ctx.fillStyle = 'rgba(150,120,80,0.5)'
      ctx.fillRect(c.x - 5, c.y - 8, 10, 16)
      ctx.fillStyle = 'rgba(30,26,22,0.9)'
      ctx.fillRect(c.x - 2, c.y - 4, 4, 6)
    }
  }

  private drawGroundShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, alpha = 0.5): void {
    ctx.fillStyle = `rgba(0,0,0,${alpha})`
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawKey(ctx: CanvasRenderingContext2D, k: Rect, s: RenderState): void {
    const c = rectCenter(k)
    const bob = 2 + Math.sin(s.time * 2) * 1
    // faint glint + orbiting trail when the player is near, for discoverability
    const near = Math.hypot(s.player.pos.x - c.x, s.player.pos.y - c.y)
    if (near < 200) {
      const rf = s.reducedFlicker ? 0.3 : 1
      const pulse = 0.5 + Math.sin(s.time * 3) * 0.3 * rf
      const g = ctx.createRadialGradient(c.x, c.y + bob, 1, c.x, c.y + bob, 14 + pulse * 6)
      g.addColorStop(0, `rgba(230,214,150,${(0.08 + pulse * 0.1).toFixed(3)})`)
      g.addColorStop(1, 'rgba(230,214,150,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(c.x, c.y + bob, 14 + pulse * 6, 0, Math.PI * 2)
      ctx.fill()
      for (let i = 0; i < 3; i++) {
        const aa = s.time * 2.2 + (i * Math.PI * 2) / 3
        const gx = c.x + Math.cos(aa) * 10
        const gy = c.y + bob + Math.sin(aa) * 5
        ctx.fillStyle = `rgba(240,225,170,${(0.2 + pulse * 0.25).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(gx, gy, 1 + pulse * 1.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    this.drawGroundShadow(ctx, c.x, c.y + 7, 7, 2.5)
    ctx.save()
    ctx.translate(c.x, c.y + bob)
    ctx.rotate(Math.PI / 4)
    ctx.fillStyle = 'rgba(214,196,120,0.95)'
    ctx.beginPath()
    ctx.arc(0, 0, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(2, -1.5, 12, 3)
    ctx.fillStyle = 'rgba(255,240,180,0.4)'
    ctx.beginPath()
    ctx.arc(-1, -1, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  private drawSwitch(ctx: CanvasRenderingContext2D, sw: Rect & { active: boolean }, s: RenderState): void {
    const c = rectCenter(sw)
    this.drawGroundShadow(ctx, c.x, sw.y + sw.h - 2, sw.w / 2 + 2, 3.5)
    ctx.fillStyle = '#202030'
    ctx.fillRect(sw.x, sw.y, sw.w, sw.h)
    ctx.fillStyle = sw.active ? 'rgba(90,180,120,0.8)' : 'rgba(140,60,50,0.8)'
    if (s.colorblind) {
      // shape-coded: triangle = on, circle = off
      if (sw.active) {
        ctx.beginPath()
        ctx.moveTo(c.x, c.y - 6)
        ctx.lineTo(c.x - 6, c.y + 5)
        ctx.lineTo(c.x + 6, c.y + 5)
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.arc(c.x, c.y, 5.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.strokeStyle = 'rgba(235,235,235,0.85)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.lineWidth = 1
    } else {
      ctx.beginPath()
      ctx.arc(c.x, c.y, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillRect(c.x - 1.5, sw.active ? c.y - 10 : c.y + 2, 3, 10)
  }

  private drawLasers(ctx: CanvasRenderingContext2D, lvl: LevelData, s: RenderState): void {
    for (const l of lvl.objects) {
      if (l.type !== 'laser' || !l.active) continue
      const c = rectCenter(l)
      const blocked = s.laserBlocked[l.id] ?? false
      const safe = blocked || (l.reflective === true && l.completed === true) // when the beam is "working" the door is open
      // emitter
      ctx.fillStyle = safe ? 'rgba(120,220,150,0.9)' : 'rgba(220,60,60,0.95)'
      ctx.fillRect(c.x - 6, c.y - 6, 12, 12)
      ctx.fillStyle = safe ? 'rgba(180,255,200,0.6)' : 'rgba(255,180,180,0.6)'
      ctx.beginPath()
      ctx.arc(c.x, c.y, 3, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = safe ? 'rgba(140,255,170,0.5)' : 'rgba(255,70,60,0.65)'
      ctx.lineWidth = 3
      ctx.beginPath()

      const segs = s.laserReflectedSegments[l.id]
      if (l.reflective && segs && segs.length > 0) {
        // draw each traced segment of the redirected beam
        for (const seg of segs) {
          ctx.moveTo(seg.x0, seg.y0)
          ctx.lineTo(seg.x1, seg.y1)
        }
      } else {
        // straight beam, cut off at the creature when blocked
        const cr = s.creature
        const end = l.axis === 'h' ? lvl.width : lvl.height
        let stopDist = end
        if (blocked) {
          stopDist = l.axis === 'h' ? cr.pos.x - 10 : cr.pos.y - 10
        }
        if (l.axis === 'h') {
          ctx.moveTo(c.x, c.y)
          ctx.lineTo(Math.max(c.x, stopDist), c.y)
        } else {
          ctx.moveTo(c.x, c.y)
          ctx.lineTo(c.x, Math.max(c.y, stopDist))
        }
      }
      ctx.stroke()
      ctx.lineWidth = 1
      // flicker glow
      if (Math.random() < 0.08) {
        ctx.fillStyle = safe ? 'rgba(150,255,180,0.5)' : 'rgba(255,120,100,0.5)'
        ctx.beginPath()
        ctx.arc(c.x, c.y, 8 + Math.random() * 6, 0, Math.PI * 2)
        ctx.fill()
      }
      // "OPEN" pulse when the beam is working
      if (safe && s.doorsOpenProgress) {
        const rf = s.reducedFlicker ? 0.3 : 1
        const pulse = 0.55 + Math.sin(s.time * 5) * 0.25 * rf
        ctx.fillStyle = `rgba(140,255,170,${pulse * 0.4})`
        ctx.beginPath()
        ctx.arc(c.x, c.y, 14 + Math.sin(s.time * 5) * 3 * rf, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  private drawPlate(ctx: CanvasRenderingContext2D, p: Rect & { active: boolean }, s: RenderState): void {
    const c = rectCenter(p)
    const r = Math.min(p.w, p.h) * 0.42
    ctx.fillStyle = '#141318'
    ctx.beginPath()
    ctx.arc(c.x, c.y, r + 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = p.active ? 'rgba(120,190,140,0.85)' : 'rgba(80,78,92,0.85)'
    ctx.beginPath()
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
    ctx.fill()
    if (p.active) {
      ctx.fillStyle = 'rgba(200,255,220,0.5)'
      if (s.colorblind) {
        // diamond = pressed
        ctx.beginPath()
        ctx.moveTo(c.x, c.y - r * 0.5)
        ctx.lineTo(c.x + r * 0.5, c.y)
        ctx.lineTo(c.x, c.y + r * 0.5)
        ctx.lineTo(c.x - r * 0.5, c.y)
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.arc(c.x, c.y, r * 0.4, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (s.colorblind) {
      ctx.strokeStyle = 'rgba(235,235,235,0.6)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(c.x, c.y, r * 0.35, 0, Math.PI * 2)
      ctx.stroke()
      ctx.lineWidth = 1
    }
  }

  private drawGenerator(ctx: CanvasRenderingContext2D, g: Rect & { powered: boolean }): void {
    const c = rectCenter(g)
    this.drawGroundShadow(ctx, c.x, g.y + g.h - 3, g.w / 2 + 2, 4)
    ctx.fillStyle = '#1c1b24'
    ctx.fillRect(g.x, g.y + 4, g.w - 8, g.h - 8)
    ctx.fillStyle = g.powered ? 'rgba(90,200,140,0.9)' : 'rgba(120,70,50,0.8)'
    ctx.beginPath()
    ctx.arc(c.x, c.y - 4, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    for (let i = 0; i < 3; i++) ctx.fillRect(g.x + 6, g.y + 8 + i * 6, 6, 3)
  }

  private drawBattery(ctx: CanvasRenderingContext2D, b: Rect): void {
    const c = rectCenter(b)
    this.drawGroundShadow(ctx, c.x, c.y + 11, 8, 3)
    ctx.fillStyle = 'rgba(70,90,80,0.95)'
    ctx.fillRect(c.x - 8, c.y - 10, 16, 20)
    ctx.fillStyle = 'rgba(140,200,160,0.7)'
    ctx.fillRect(c.x - 4, c.y - 8, 8, 6)
    ctx.fillStyle = 'rgba(30,30,34,1)'
    ctx.fillRect(c.x - 4, c.y - 13, 8, 4)
  }

  private drawMirror(ctx: CanvasRenderingContext2D, m: Extract<GameObject, { type: 'mirror' }>, s: RenderState): void {
    const c = rectCenter(m)
    const hinted = s.mirrorHintIds.includes(m.id)
    ctx.fillStyle = '#14131a'
    ctx.fillRect(m.x, m.y, m.w, m.h)
    ctx.save()
    ctx.beginPath()
    ctx.rect(m.x + 2, m.y + 2, m.w - 4, m.h - 4)
    ctx.clip()
    const g = ctx.createLinearGradient(c.x, m.y, c.x, m.y + m.h)
    g.addColorStop(0, 'rgba(120,140,180,0.22)')
    g.addColorStop(0.5, 'rgba(40,50,80,0.14)')
    g.addColorStop(1, 'rgba(10,14,30,0.3)')
    ctx.fillStyle = g
    ctx.fillRect(m.x, m.y, m.w, m.h)
    // glass sheen
    ctx.strokeStyle = 'rgba(180,200,230,0.25)'
    ctx.beginPath()
    ctx.moveTo(m.x + 4, m.y + m.h - 4)
    ctx.lineTo(m.x + m.w - 8, m.y + 6)
    ctx.stroke()
    // discoverability glint while the player looks at the mirror
    if (hinted) {
      const t = s.time
      const rf = s.reducedFlicker ? 0.3 : 1
      const pulse = 0.5 + Math.sin(t * 2.4) * 0.3 * rf
      const gx = m.x + m.w / 2 + Math.sin(t * 1.3) * 4 * rf
      const gy = m.y + m.h / 2 - 6 + Math.cos(t * 1.7) * 3
      const star = ctx.createRadialGradient(gx, gy, 0, gx, gy, 10 + pulse * 4)
      star.addColorStop(0, `rgba(220,230,255,${0.25 + pulse * 0.2})`)
      star.addColorStop(1, 'rgba(220,230,255,0)')
      ctx.fillStyle = star
      ctx.beginPath()
      ctx.arc(gx, gy, 10 + pulse * 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    ctx.strokeStyle = hinted ? 'rgba(200,215,245,0.55)' : 'rgba(160,170,200,0.4)'
    ctx.strokeRect(m.x + 2, m.y + 2, m.w - 4, m.h - 4)
    // beam-splitter mirrors (Hall of Mirrors): a diagonal splitter that redirects lasers
    if (m.reflectAxis === 'backslash' || m.reflectAxis === 'slash') {
      ctx.save()
      ctx.strokeStyle = 'rgba(220,150,80,0.9)'
      ctx.lineWidth = 3
      ctx.beginPath()
      if (m.reflectAxis === 'backslash') {
        ctx.moveTo(m.x + 6, m.y + m.h - 6)
        ctx.lineTo(m.x + m.w - 6, m.y + 6)
      } else {
        ctx.moveTo(m.x + 6, m.y + 6)
        ctx.lineTo(m.x + m.w - 6, m.y + m.h - 6)
      }
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,220,160,0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      if (m.reflectAxis === 'backslash') {
        ctx.moveTo(m.x + 9, m.y + m.h - 9)
        ctx.lineTo(m.x + m.w - 9, m.y + 9)
      } else {
        ctx.moveTo(m.x + 9, m.y + 9)
        ctx.lineTo(m.x + m.w - 9, m.y + m.h - 9)
      }
      ctx.stroke()
      ctx.restore()
    } else if (m.rotatable) {
      // rotatable but currently flat: hint that it can be turned
      ctx.save()
      ctx.strokeStyle = 'rgba(220,150,80,0.4)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.arc(c.x, c.y, 12, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    // receiver target: where the redirected beam must land
    if (m.receiver) {
      const rf = s.reducedFlicker ? 0.3 : 1
      const pulse = 0.55 + Math.sin(s.time * 2) * 0.2 * rf
      ctx.strokeStyle = `rgba(140,220,170,${(0.4 + pulse * 0.2).toFixed(3)})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(c.x, c.y, 7 + pulse * 3, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = `rgba(140,220,170,${(0.3 * pulse).toFixed(3)})`
      ctx.beginPath()
      ctx.arc(c.x, c.y, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 1
    }
  }

  private drawLever(ctx: CanvasRenderingContext2D, l: Rect & { active: boolean }, s: RenderState): void {
    const c = rectCenter(l)
    this.drawGroundShadow(ctx, c.x, l.y + l.h - 2, l.w / 2 + 2, 3.5)
    ctx.fillStyle = '#202030'
    ctx.fillRect(l.x, l.y, l.w, l.h)
    if (s.colorblind) {
      // bar turns into a raised/lowered block: filled = raised, hollow = lowered
      ctx.strokeStyle = 'rgba(235,235,235,0.8)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(c.x - 5, l.active ? c.y - 9 : c.y + 2, 10, 7)
      ctx.lineWidth = 1
      if (l.active) {
        ctx.fillStyle = 'rgba(160,160,180,0.7)'
        ctx.fillRect(c.x - 5, c.y - 9, 10, 7)
      }
    } else {
      ctx.fillStyle = 'rgba(160,160,180,0.7)'
      ctx.beginPath()
      ctx.moveTo(c.x, c.y)
      ctx.lineTo(c.x + (l.active ? 8 : -8), c.y - 10)
      ctx.lineTo(c.x + (l.active ? 6 : -6), c.y + 2)
      ctx.closePath()
      ctx.fill()
    }
  }

  private drawCheckpoint(ctx: CanvasRenderingContext2D, c: Rect & { active: boolean }, flash: number, time: number): void {
    const cx = c.x + c.w / 2
    const cy = c.y + c.h / 2
    const on = c.active || flash > 0
    ctx.fillStyle = '#181720'
    ctx.beginPath()
    ctx.arc(cx, cy, 16, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = on ? 'rgba(140,180,255,0.85)' : 'rgba(60,70,110,0.5)'
    ctx.beginPath()
    ctx.arc(cx, cy, 8, 0, Math.PI * 2)
    ctx.fill()
    if (on) {
      ctx.strokeStyle = 'rgba(140,180,255,0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, cy, 10 + Math.sin(time * 3 + flash) * 2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.lineWidth = 1
    }
  }

  private drawExit(ctx: CanvasRenderingContext2D, e: Rect & { open: boolean; requiresStare?: { radius: number; duration: number } }, s: RenderState): void {
    const c = rectCenter(e)
    if (e.requiresStare) {
      // circle of light
      const r = e.requiresStare.radius * 0.35
      const rf = s.reducedFlicker ? 0.3 : 1
      const pulse = 0.85 + Math.sin(s.time * 1.2) * 0.12 * rf + s.winBeam * 0.15
      ctx.strokeStyle = `rgba(210,200,180,${0.35 + s.winBeam * 0.4})`
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(c.x, c.y, r * pulse, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = `rgba(255,240,210,${0.06 + s.winBeam * 0.2})`
      ctx.beginPath()
      ctx.arc(c.x, c.y, r * pulse, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(180,190,220,0.4)'
      ctx.beginPath()
      ctx.arc(c.x, c.y, 10, 0, Math.PI * 2)
      ctx.stroke()
      return
    }
    // doorway
    ctx.fillStyle = '#221f2a'
    ctx.fillRect(e.x - 3, e.y - 3, e.w + 6, e.h + 6)
    const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 30)
    g.addColorStop(0, 'rgba(255,235,200,0.85)')
    g.addColorStop(1, 'rgba(200,160,120,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(c.x, c.y, 30, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(90,70,50,0.9)'
    ctx.fillRect(e.x + e.w / 2 - 4, e.y + 2, 8, e.h - 4)
  }

  /**
   * Screen-space exit beacon: a tall pulsing column of light drawn over the
   * darkness so the exit reads clearly from across the level.
   */
  drawExitBeacon(ctx: CanvasRenderingContext2D, sx: number, sy: number, time: number, winBeam: number): void {
    const pulse = 0.82 + Math.sin(time * 1.6) * 0.14
    const boost = winBeam * 0.5
    const h = 300
    const w = 64

    // outer glow column
    const g = ctx.createLinearGradient(0, sy - h, 0, sy)
    g.addColorStop(0, 'rgba(255,220,170,0)')
    g.addColorStop(0.6, `rgba(255,214,158,${0.10 * pulse + boost})`)
    g.addColorStop(1, `rgba(255,224,170,${0.22 * pulse + boost})`)
    ctx.fillStyle = g
    ctx.fillRect(sx - w / 2, sy - h, w, h)

    // bright core column
    const cg = ctx.createLinearGradient(0, sy - h, 0, sy)
    cg.addColorStop(0, 'rgba(255,240,210,0)')
    cg.addColorStop(0.7, `rgba(255,235,200,${0.16 * pulse + boost})`)
    cg.addColorStop(1, `rgba(255,240,215,${0.5 * pulse + boost * 1.4})`)
    ctx.fillStyle = cg
    ctx.fillRect(sx - 10, sy - h, 20, h)

    // rising embers
    for (let i = 0; i < 7; i++) {
      const seed = this.hash(i * 31 + Math.floor(time * 3), 7)
      const t = (time * 0.35 + seed) % 1
      const ex = sx + (seed - 0.5) * 40
      const ey = sy - t * h
      const a = (1 - t) * 0.35 * pulse
      ctx.fillStyle = `rgba(255,225,180,${a.toFixed(3)})`
      ctx.fillRect(ex, ey, 3, 3)
    }

    // base halo on the floor
    const halo = ctx.createRadialGradient(sx, sy, 4, sx, sy, 46 + winBeam * 30)
    halo.addColorStop(0, `rgba(255,230,190,${0.4 * pulse + boost * 1.2})`)
    halo.addColorStop(1, 'rgba(255,230,190,0)')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(sx, sy, 46 + winBeam * 30, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawSpotlightFixture(ctx: CanvasRenderingContext2D, s: Rect & { faceDir: string; active: boolean }): void {
    const c = rectCenter(s)
    ctx.fillStyle = '#2a2830'
    ctx.fillRect(c.x - 8, c.y - 4, 16, 10)
    ctx.fillStyle = 'rgba(220,220,230,0.8)'
    ctx.beginPath()
    ctx.arc(c.x, c.y - 4, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawNote(ctx: CanvasRenderingContext2D, n: Rect): void {
    const c = rectCenter(n)
    this.drawGroundShadow(ctx, c.x, c.y + 8, 9, 2.5)
    ctx.fillStyle = 'rgba(120,110,90,0.9)'
    ctx.fillRect(c.x - 8, c.y - 6, 16, 12)
    ctx.fillStyle = 'rgba(200,190,160,0.7)'
    for (let i = 0; i < 3; i++) ctx.fillRect(c.x - 6, c.y - 3 + i * 3, 10, 1.5)
  }

  private drawLamp(ctx: CanvasRenderingContext2D, l: Rect & { on: boolean; flicker: number }): void {
    if (!l.on) return
    const c = rectCenter(l)
    ctx.fillStyle = 'rgba(60,58,66,1)'
    ctx.fillRect(c.x - 4, c.y - 8, 8, 10)
    ctx.fillStyle = 'rgba(200,180,120,0.9)'
    ctx.fillRect(c.x - 3, c.y - 5, 6, 5)
  }

  /** hold-to-interact valve: a wheel that visibly turns as you hold it */
  private drawCrank(ctx: CanvasRenderingContext2D, cr: Extract<GameObject, { type: 'crank' }>, s: RenderState): void {
    const c = rectCenter(cr)
    const prog = s.holdProgress[cr.id] ?? 0
    const turned = cr.active
    const angle = turned ? Math.PI * 2 : prog * Math.PI * 2
    // mount
    this.drawGroundShadow(ctx, c.x, cr.y + cr.h - 2, cr.w / 2 + 3, 3.5)
    ctx.fillStyle = '#201f28'
    ctx.fillRect(cr.x, cr.y, cr.w, cr.h)
    ctx.fillStyle = '#2c2b36'
    ctx.beginPath()
    ctx.arc(c.x, c.y, 14, 0, Math.PI * 2)
    ctx.fill()
    // wheel
    ctx.strokeStyle = turned ? 'rgba(150,190,160,0.85)' : 'rgba(170,170,190,0.7)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(c.x, c.y, 11, 0, Math.PI * 2)
    ctx.stroke()
    // spokes rotate with progress
    ctx.lineWidth = 2
    for (let i = 0; i < 4; i++) {
      const a = angle + (i * Math.PI) / 2
      ctx.beginPath()
      ctx.moveTo(c.x + Math.cos(a) * 3, c.y + Math.sin(a) * 3)
      ctx.lineTo(c.x + Math.cos(a) * 10, c.y + Math.sin(a) * 10)
      ctx.stroke()
    }
    ctx.fillStyle = turned ? 'rgba(140,200,160,0.9)' : 'rgba(200,200,215,0.85)'
    ctx.beginPath()
    ctx.arc(c.x, c.y, 3, 0, Math.PI * 2)
    ctx.fill()
    // hold ring
    if (!turned && prog > 0.01) {
      ctx.strokeStyle = 'rgba(220,225,240,0.9)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(c.x, c.y, 18, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2)
      ctx.stroke()
      ctx.lineWidth = 1
    }
  }

  /** a music box / radio: when switched on it plays a lure and hums with light */
  private drawRadio(ctx: CanvasRenderingContext2D, r: Rect & { on: boolean }, s: RenderState): void {
    const c = rectCenter(r)
    this.drawGroundShadow(ctx, c.x, r.y + r.h - 1, r.w / 2 + 2, 3)
    ctx.fillStyle = '#241f1c'
    this.roundRectRect(ctx, r.x, r.y, r.w, r.h, 3)
    ctx.fill()
    ctx.strokeStyle = r.on ? 'rgba(255,200,120,0.7)' : 'rgba(140,130,110,0.5)'
    ctx.lineWidth = 1.2
    this.roundRectRect(ctx, r.x, r.y, r.w, r.h, 3)
    ctx.stroke()
    // speaker grille
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    for (let i = 0; i < 4; i++) ctx.fillRect(r.x + 6, r.y + 6 + i * 6, r.w - 12, 2)
    // dial
    ctx.fillStyle = r.on ? 'rgba(255,180,90,0.95)' : 'rgba(60,55,48,0.9)'
    ctx.beginPath()
    ctx.arc(c.x, r.y + r.h - 6, 2.5, 0, Math.PI * 2)
    ctx.fill()
    if (r.on) {
      const pulse = 0.5 + 0.5 * Math.sin(s.time * 3)
      const rf = s.reducedFlicker ? 0.3 : 1
      const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 22 + pulse * 6)
      g.addColorStop(0, `rgba(255,200,120,${(0.16 * rf).toFixed(3)})`)
      g.addColorStop(1, 'rgba(255,200,120,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(c.x, c.y, 22 + pulse * 6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private roundRectRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
  }

  /** a noise decoy: sits on the ground, clatters loudly when thrown */
  private drawDecoy(ctx: CanvasRenderingContext2D, d: Rect & { thrown: boolean; thrownPos: { x: number; y: number }; clatterTimer: number }, s: RenderState): void {
    const c = rectCenter(d)
    const active = d.thrown && d.clatterTimer > 0
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.beginPath()
    ctx.ellipse(c.x, c.y + 5, 7, 3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = active ? 'rgba(170,150,120,0.95)' : 'rgba(120,110,95,0.9)'
    ctx.beginPath()
    ctx.ellipse(c.x, c.y, 6, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(c.x - 5, c.y - 2)
    ctx.lineTo(c.x + 5, c.y + 2)
    ctx.moveTo(c.x - 4, c.y + 3)
    ctx.lineTo(c.x + 4, c.y - 1)
    ctx.stroke()
    if (active) {
      const pulse = 0.5 + 0.5 * Math.sin(s.time * 8)
      ctx.fillStyle = `rgba(255,220,160,${(0.12 + pulse * 0.1).toFixed(3)})`
      ctx.beginPath()
      ctx.arc(c.x, c.y, 8 + pulse * 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /** the tower bell: sways and flashes while tolling */
  private drawBell(ctx: CanvasRenderingContext2D, b: Rect & { ringing: boolean }, s: RenderState): void {
    const c = rectCenter(b)
    const sway = b.ringing ? Math.sin(s.time * 22) * 0.35 : 0
    ctx.save()
    ctx.translate(c.x, c.y)
    ctx.rotate(sway)
    ctx.fillStyle = '#2a2a33'
    ctx.fillRect(-2, -12, 4, 5)
    ctx.fillStyle = b.ringing ? 'rgba(180,180,190,0.9)' : 'rgba(90,90,100,0.85)'
    ctx.beginPath()
    ctx.moveTo(-9, -7)
    ctx.quadraticCurveTo(-11, 6, 0, 8)
    ctx.quadraticCurveTo(11, 6, 9, -7)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(-6, -6)
    ctx.quadraticCurveTo(-8, 4, 0, 6)
    ctx.quadraticCurveTo(8, 4, 6, -6)
    ctx.stroke()
    ctx.fillStyle = 'rgba(0,0,0,0.8)'
    ctx.beginPath()
    ctx.ellipse(0, 4, 5, 2.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    if (b.ringing) {
      const pulse = 0.5 + 0.5 * Math.sin(s.time * 22)
      const g = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, 26)
      g.addColorStop(0, `rgba(220,220,230,${(0.08 + pulse * 0.1).toFixed(3)})`)
      g.addColorStop(1, 'rgba(220,220,230,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(c.x, c.y, 26, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawMirrorReflections(ctx: CanvasRenderingContext2D, lvl: LevelData, s: RenderState): void {
    if (!s.creatureVisible && s.creatureMirrorIds.length === 0) return
    for (const m of lvl.objects) {
      if (m.type !== 'mirror') continue
      if (!s.creatureMirrorIds.includes(m.id) && !s.creatureVisible) continue
      // draw ghost silhouette in mirror
      const mc = rectCenter(m)
      ctx.save()
      ctx.beginPath()
      ctx.rect(m.x + 2, m.y + 2, m.w - 4, m.h - 4)
      ctx.clip()
      ctx.globalAlpha = 0.55
      const scale = Math.min(m.w, m.h) / 120
      ctx.translate(mc.x + (m.faceDir === 'east' ? -4 : m.faceDir === 'west' ? 4 : 0), mc.y)
      ctx.scale(m.faceDir === 'west' ? -1 : 1, 1)
      ctx.scale(scale, scale)
      this.drawCreatureBody(ctx, s, 0, -20)
      ctx.restore()
      ctx.globalAlpha = 1
    }
  }

  private drawCreature(ctx: CanvasRenderingContext2D, s: RenderState): void {
    const cr = s.creature
    if (s.creatureVisible) {
      const dist = Math.hypot(cr.pos.x - s.player.pos.x, cr.pos.y - s.player.pos.y)
      const fade = Math.min(1, dist / 140)
      ctx.save()
      ctx.globalAlpha = fade
      ctx.translate(cr.pos.x, cr.pos.y)
      ctx.rotate(0)
      this.drawCreatureBody(ctx, s, 0, 0)
      ctx.restore()
      ctx.globalAlpha = 1
    } else if (s.creatureCloseHint) {
      // subtle hint: a barely visible shadow pooling under it
      ctx.save()
      ctx.globalAlpha = 0.25
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.ellipse(cr.pos.x, cr.pos.y + 10, 14, 6, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      ctx.globalAlpha = 1
    }
  }

  private drawCreatureBody(ctx: CanvasRenderingContext2D, s: RenderState, ox: number, oy: number): void {
    const cr = s.creature
    const stunned = cr.state === 'STUNNED'
    const walking = cr.moving
    const t = s.time
    const tw = cr.twitchAmp + (stunned ? 0 : Math.sin(t * 3.7) * (cr.state === 'VISIBLE' ? 1.2 : 0.3))
    const headTilt = cr.headTilt + (stunned ? 0.7 : 0)

    ctx.translate(ox, oy)
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.beginPath()
    ctx.ellipse(0, 34, 20, 6, 0, 0, Math.PI * 2)
    ctx.fill()

    const bodyColor = stunned ? '#16141c' : '#050407'
    ctx.fillStyle = bodyColor
    ctx.strokeStyle = 'rgba(120,115,140,0.35)'
    ctx.lineWidth = 1

    // legs
    const legSwing = walking ? Math.sin(cr.walkPhase) * 9 : 0
    ctx.fillStyle = bodyColor
    for (const dir of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(0, 22)
      ctx.lineTo(dir * 6 + legSwing * dir, 34)
      ctx.lineTo(dir * 8 + legSwing * dir, 36)
      ctx.lineTo(dir * 3 - legSwing * dir, 33)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }

    // long arms (unnaturally long, reaching past knees)
    for (const dir of [-1, 1]) {
      const armSwing = walking ? Math.sin(cr.walkPhase + dir) * 7 : Math.sin(t * 1.3 + dir) * 1.5 + tw * dir
      ctx.beginPath()
      ctx.moveTo(0, -2)
      ctx.quadraticCurveTo(dir * 12, 14 + armSwing, dir * 10, 32 + armSwing)
      ctx.lineTo(dir * 14, 33 + armSwing)
      ctx.lineTo(dir * 6, 20)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }

    // body (tall, thin, slightly hunched when stunned)
    const hunch = stunned ? 6 : 0
    ctx.beginPath()
    ctx.moveTo(-9, -18)
    ctx.quadraticCurveTo(-10, 2, -6, 24 - hunch)
    ctx.lineTo(6, 24 - hunch)
    ctx.quadraticCurveTo(10, 2, 9, -18)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // neck + head
    ctx.save()
    ctx.translate(0, -20 + tw)
    ctx.rotate(headTilt)
    // neck
    ctx.fillStyle = bodyColor
    ctx.fillRect(-2, -2, 4, 5)
    // head
    ctx.beginPath()
    ctx.ellipse(0, -8, 8.5, 10, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    // when visible, faint pale eyes
    if (cr.state === 'VISIBLE' || cr.state === 'STUNNED') {
      const eyeY = -8 + (stunned ? -2 : 0)
      ctx.fillStyle = stunned ? 'rgba(40,40,50,0.5)' : 'rgba(220,220,230,0.55)'
      ctx.beginPath()
      ctx.ellipse(-3, eyeY, 1.6, 1.1, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(3, eyeY, 1.6, 1.1, 0, 0, Math.PI * 2)
      ctx.fill()
      if (!stunned) {
        ctx.fillStyle = 'rgba(140,120,140,0.6)'
        ctx.fillRect(-3.4, eyeY - 0.4, 1, 1.6)
        ctx.fillRect(2.6, eyeY - 0.4, 1, 1.6)
      }
    }
    ctx.restore()

    ctx.lineWidth = 1
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, p: Player): void {
    ctx.save()
    ctx.translate(p.pos.x, p.pos.y + p.bobOffset)
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.65)'
    ctx.beginPath()
    ctx.ellipse(0, 6, 12, 4, 0, 0, Math.PI * 2)
    ctx.fill()
    // body
    ctx.fillStyle = '#1d2130'
    ctx.beginPath()
    ctx.moveTo(-6, -2)
    ctx.quadraticCurveTo(-5, 8, -4, 8)
    ctx.lineTo(4, 8)
    ctx.quadraticCurveTo(5, 8, 6, -2)
    ctx.quadraticCurveTo(4, -6, 0, -8)
    ctx.quadraticCurveTo(-4, -6, -6, -2)
    ctx.closePath()
    ctx.fill()
    // head
    ctx.fillStyle = '#1d2130'
    ctx.beginPath()
    ctx.arc(0, -10, 5.5, 0, Math.PI * 2)
    ctx.fill()
    // facing direction marker (subtle)
    ctx.fillStyle = 'rgba(160,170,200,0.5)'
    ctx.beginPath()
    ctx.arc(Math.cos(p.face) * 4, -10 + Math.sin(p.face) * 4, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  drawDeathFace(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number, time: number, seed: number): void {
    if (progress <= 0.01) return
    const cx = w / 2
    const cy = h / 2
    const scale = Math.min(w, h) / 480
    const t = time * 6 + seed

    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.globalAlpha = progress

    // dark seized head
    ctx.fillStyle = 'rgba(5,4,8,0.92)'
    ctx.beginPath()
    ctx.ellipse(0, 0, 120, 150, 0, 0, Math.PI * 2)
    ctx.fill()

    // radiating cracks
    ctx.strokeStyle = 'rgba(200,60,50,0.5)'
    ctx.lineWidth = 2
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + seed
      const r0 = 118 + Math.sin(t * 2 + i) * 6
      const r1 = 152 + Math.sin(t * 3 + i * 7) * 14
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * 1.25)
      ctx.lineTo(Math.cos(a + 0.1) * r1, Math.sin(a + 0.1) * r1 * 1.25)
      ctx.stroke()
    }

    // eyes
    const eyeOpen = 1 + progress * 0.6
    for (const dir of [-1, 1]) {
      const ex = dir * 42
      const ey = -40 + Math.sin(t * 1.3) * 2
      ctx.fillStyle = 'rgba(225,228,235,0.95)'
      ctx.beginPath()
      ctx.ellipse(ex, ey, 16, 22 * eyeOpen, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(8,6,8,1)'
      ctx.beginPath()
      ctx.arc(ex, ey, 4 + progress * 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(180,40,35,0.6)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(ex - 12, ey)
      ctx.lineTo(ex - 24, ey - 6 + Math.sin(t * 7) * 4)
      ctx.moveTo(ex + 12, ey)
      ctx.lineTo(ex + 24, ey + 5 + Math.cos(t * 6) * 4)
      ctx.stroke()
    }

    // gaping maw
    const mouthOpen = 8 + progress * 46
    ctx.fillStyle = 'rgba(10,5,6,0.98)'
    ctx.beginPath()
    ctx.ellipse(0, 55, 46 + Math.sin(t * 2) * 4, mouthOpen, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(215,210,205,0.85)'
    const teeth = 7
    for (let i = 0; i < teeth; i++) {
      const tx = -30 + (60 * i) / (teeth - 1)
      ctx.beginPath()
      ctx.moveTo(tx - 3, 55 - mouthOpen * 0.7)
      ctx.lineTo(tx + 3, 55 - mouthOpen * 0.7)
      ctx.lineTo(tx, 55 - mouthOpen * 0.7 + 8)
      ctx.closePath()
      ctx.fill()
    }

    // red halo
    const g = ctx.createRadialGradient(0, 0, 40, 0, 0, 220)
    g.addColorStop(0, 'rgba(150,30,25,0)')
    g.addColorStop(1, `rgba(150,30,25,${(0.25 * progress).toFixed(3)})`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, 220, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
    ctx.globalAlpha = 1
  }

  private drawSpotlightBeams(ctx: CanvasRenderingContext2D, lvl: LevelData): void {
    for (const sp of lvl.objects) {
      if (sp.type !== 'spotlight' || !sp.active) continue
      const c = rectCenter(sp)
      const dir = sp.faceDir
      const len = 200
      let dx = 0
      let dy = 0
      if (dir === 'north') dy = -1
      else if (dir === 'south') dy = 1
      else if (dir === 'east') dx = 1
      else dx = -1
      const perp = { x: -dy, y: dx }
      const ax = c.x + dx * len
      const ay = c.y + dy * len
      const pw = 26
      ctx.fillStyle = 'rgba(255,245,220,0.05)'
      ctx.beginPath()
      ctx.moveTo(c.x - perp.x * pw * 0.3, c.y - perp.y * pw * 0.3)
      ctx.lineTo(ax - perp.x * pw, ay - perp.y * pw)
      ctx.lineTo(ax + perp.x * pw, ay + perp.y * pw)
      ctx.lineTo(c.x + perp.x * pw * 0.3, c.y + perp.y * pw * 0.3)
      ctx.closePath()
      ctx.fill()
    }
  }
}