import type { Vec2 } from '../types'
import { clamp, lerp } from './Collision'

export class Camera {
  x = 0
  y = 0
  /** viewport size in world units */
  viewW = 960
  viewH = 540
  levelW = 2000
  levelH = 1000
  shakeTime = 0
  shakeDur = 0
  shakeMag = 0
  shakeX = 0
  shakeY = 0
  /** subtle per-step bob applied alongside shake */
  bobX = 0
  bobY = 0
  zoom = 1

  resize(canvasW: number, canvasH: number): void {
    this.viewW = canvasW
    this.viewH = canvasH
    this.zoom = 1
  }

  setLevel(w: number, h: number): void {
    this.levelW = w
    this.levelH = h
  }

  /** immediately snap camera to target */
  snapTo(t: Vec2): void {
    this.x = t.x
    this.y = t.y
    this.clamp()
  }

  follow(t: Vec2, dt: number, smooth = 4): void {
    this.x = lerp(this.x, t.x, 1 - Math.exp(-dt * smooth))
    this.y = lerp(this.y, t.y, 1 - Math.exp(-dt * smooth))
    this.clamp()
  }

  clamp(): void {
    const hw = this.viewW / 2
    const hh = this.viewH / 2
    if (this.levelW <= this.viewW) {
      this.x = this.levelW / 2
    } else {
      this.x = clamp(this.x, hw, this.levelW - hw)
    }
    if (this.levelH <= this.viewH) {
      this.y = this.levelH / 2
    } else {
      this.y = clamp(this.y, hh, this.levelH - hh)
    }
  }

  shake(mag: number, dur = 0.3): void {
    if (mag > this.shakeMag * this.shakeTime * 2) {
      this.shakeMag = mag
      this.shakeDur = dur
      this.shakeTime = dur
    }
  }

  update(dt: number, settings: { shake: boolean }): void {
    if (this.shakeTime > 0) {
      this.shakeTime -= dt
      const t = Math.max(0, this.shakeTime / this.shakeDur)
      const amp = this.shakeMag * t * t
      if (settings.shake) {
        this.shakeX = (Math.random() * 2 - 1) * amp
        this.shakeY = (Math.random() * 2 - 1) * amp
      } else {
        this.shakeX = 0
        this.shakeY = 0
      }
    } else {
      this.shakeX = 0
      this.shakeY = 0
    }
  }

  /** world position at top-left of viewport */
  get topLeft(): Vec2 {
    return { x: this.x - this.viewW / 2, y: this.y - this.viewH / 2 }
  }

  screenToWorld(sx: number, sy: number): Vec2 {
    const tl = this.topLeft
    return { x: tl.x + sx, y: tl.y + sy }
  }

  worldToScreen(wx: number, wy: number): Vec2 {
    const tl = this.topLeft
    return { x: wx - tl.x, y: wy - tl.y }
  }
}
