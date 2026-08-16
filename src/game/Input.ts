import type { KeyBindings, Vec2 } from '../types'
import { DEFAULT_KEY_BINDINGS } from '../types'

export { DEFAULT_KEY_BINDINGS as DEFAULT_BINDINGS }
export type { KeyBindings }

export type PadDir = 'up' | 'down' | 'left' | 'right'

const PAD_RADIUS = 24

export class Input {
  keys = new Set<string>()
  private justPressed = new Set<string>()
  private pressedThisFrame = new Set<string>()
  mouse: Vec2 = { x: 0, y: 0 }
  mouseDown = false
  touch = false
  /** normalized movement vector [-1..1] */
  move = { x: 0, y: 0 }
  /** true while any run key is held */
  run = false
  /** true while any crouch key is held */
  crouch = false
  /** explicit look angle set by the look joystick (radians); only valid while touchLookActive */
  touchLookAngle = 0
  touchLookActive = false

  joystickActive = false
  joystickCenter: Vec2 = { x: 0, y: 0 }
  joystickOffset: Vec2 = { x: 0, y: 0 }

  /** pressed state of the on-screen movement D-pad */
  pad: Record<PadDir, boolean> = { up: false, down: false, left: false, right: false }

  /** set true when a quick tap on the right side happens (touch interact) */
  interactTapped = false
  /** true while the interact key/touch is currently held down (hold-to-interact) */
  interactHeld = false

  private bindings: KeyBindings = { ...DEFAULT_KEY_BINDINGS }
  private canvas: HTMLCanvasElement
  private joystickId: number | null = null
  private interactTouchId: number | null = null
  private interactTouchStart: Vec2 = { x: 0, y: 0 }
  private interactTouchMoved = false
  private padIds = new Map<PadDir, number>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.attach()
  }

  setBindings(bindings: Partial<KeyBindings>): void {
    this.bindings = { ...DEFAULT_KEY_BINDINGS, ...bindings }
  }

  getBindings(): KeyBindings {
    return this.bindings
  }

  /** scale factor shrinking touch controls on smaller screens (CSS pixel space) */
  getTouchScale(w: number, h: number): number {
    return Math.max(0.55, Math.min(1, Math.min(w, h) / 460))
  }

  /** on-screen D-pad button centers in CSS pixel space */
  getDpadUpCenter(w: number, h: number): Vec2 {
    const s = this.getTouchScale(w, h)
    return { x: w - 150 * s, y: h - 196 * s }
  }

  getDpadDownCenter(w: number, h: number): Vec2 {
    const s = this.getTouchScale(w, h)
    return { x: w - 150 * s, y: h - 76 * s }
  }

  getDpadLeftCenter(w: number, h: number): Vec2 {
    const s = this.getTouchScale(w, h)
    return { x: w - 210 * s, y: h - 136 * s }
  }

  getDpadRightCenter(w: number, h: number): Vec2 {
    const s = this.getTouchScale(w, h)
    return { x: w - 90 * s, y: h - 136 * s }
  }

  private hitButton(x: number, y: number, center: Vec2, r: number): boolean {
    const dx = x - center.x
    const dy = y - center.y
    return dx * dx + dy * dy <= r * r
  }

  private padFor(x: number, y: number, w: number, h: number): PadDir | null {
    const s = this.getTouchScale(w, h)
    const r = PAD_RADIUS * s
    const slots: Array<[PadDir, Vec2]> = [
      ['up', this.getDpadUpCenter(w, h)],
      ['down', this.getDpadDownCenter(w, h)],
      ['left', this.getDpadLeftCenter(w, h)],
      ['right', this.getDpadRightCenter(w, h)],
    ]
    for (const [dir, center] of slots) {
      if (this.hitButton(x, y, center, r)) return dir
    }
    return null
  }

  private attach(): void {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    this.canvas.addEventListener('mousemove', this.onMouseMove)
    this.canvas.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false })
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false })
    this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false })
    this.canvas.addEventListener('touchcancel', this.onTouchEnd, { passive: false })
    this.canvas.addEventListener('contextmenu', this.onContextMenu)
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.canvas.removeEventListener('mousemove', this.onMouseMove)
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    this.canvas.removeEventListener('touchstart', this.onTouchStart)
    this.canvas.removeEventListener('touchmove', this.onTouchMove)
    this.canvas.removeEventListener('touchend', this.onTouchEnd)
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd)
    this.canvas.removeEventListener('contextmenu', this.onContextMenu)
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return
    if (!this.keys.has(e.code)) {
      this.justPressed.add(e.code)
    }
    this.keys.add(e.code)
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code)
  }

  private onBlur = (): void => {
    this.keys.clear()
  }

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect()
    const scale = this.canvas.width / Math.max(1, rect.width)
    this.mouse.x = (e.clientX - rect.left) * scale
    this.mouse.y = (e.clientY - rect.top) * scale
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDown = true
  }

  private onMouseUp = (): void => {
    this.mouseDown = false
  }

  private onContextMenu = (e: Event): void => {
    e.preventDefault()
  }

  onTouchStart = (e: TouchEvent): void => {
    e.preventDefault()
    this.touch = true
    const rect = this.canvas.getBoundingClientRect()
    const scale = this.canvas.width / Math.max(1, rect.width)
    const cssW = this.canvas.width / scale
    const cssH = this.canvas.height / scale
    for (const t of Array.from(e.changedTouches)) {
      const x = (t.clientX - rect.left) * scale
      const y = (t.clientY - rect.top) * scale
      const cssX = x / scale
      const cssY = y / scale

      const padDir = this.padFor(cssX, cssY, cssW, cssH)
      if (padDir !== null) {
        if (!this.padIds.has(padDir)) {
          this.padIds.set(padDir, t.identifier)
          this.pad[padDir] = true
        }
        continue
      }

      if (x < this.canvas.width * 0.4) {
        if (this.joystickId === null) {
          this.joystickId = t.identifier
          this.joystickCenter = { x: cssX, y: cssY }
          this.joystickOffset = { x: 0, y: 0 }
          this.joystickActive = true
          this.touchLookActive = true
        }
      } else if (this.interactTouchId === null) {
        this.interactTouchId = t.identifier
        this.interactTouchStart = { x: cssX, y: cssY }
        this.interactTouchMoved = false
      }
    }
  }

  onTouchMove = (e: TouchEvent): void => {
    e.preventDefault()
    const rect = this.canvas.getBoundingClientRect()
    const scale = this.canvas.width / Math.max(1, rect.width)
    for (const t of Array.from(e.changedTouches)) {
      const x = (t.clientX - rect.left) * scale
      const y = (t.clientY - rect.top) * scale
      const cssX = x / scale
      const cssY = y / scale
      const cssW = this.canvas.width / scale
      const cssH = this.canvas.height / scale
      if (t.identifier === this.joystickId) {
        const s = this.getTouchScale(cssW, cssH)
        let dx = cssX - this.joystickCenter.x
        let dy = cssY - this.joystickCenter.y
        const mag = Math.hypot(dx, dy)
        const maxR = 64 * s
        if (mag > maxR) {
          dx = (dx / mag) * maxR
          dy = (dy / mag) * maxR
        }
        this.joystickOffset = { x: dx, y: dy }
        if (mag > 12) {
          this.touchLookAngle = Math.atan2(dy, dx)
        }
      } else if (t.identifier === this.interactTouchId) {
        if (Math.hypot(cssX - this.interactTouchStart.x, cssY - this.interactTouchStart.y) > 12) {
          this.interactTouchMoved = true
        }
      }
    }
  }

  onTouchEnd = (e: TouchEvent): void => {
    e.preventDefault()
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.joystickId) {
        this.joystickId = null
        this.joystickOffset = { x: 0, y: 0 }
        this.joystickActive = false
        this.touchLookActive = false
      }
      if (t.identifier === this.interactTouchId) {
        this.interactTouchId = null
        if (!this.interactTouchMoved) this.interactTapped = true
      }
      for (const [dir, id] of Array.from(this.padIds.entries())) {
        if (id === t.identifier) {
          this.padIds.delete(dir)
          this.pad[dir] = false
        }
      }
    }
  }

  /** recompute derived state each frame */
  update(): void {
    this.pressedThisFrame = this.justPressed
    this.justPressed = new Set<string>()
    let mx = 0
    let my = 0
    const b = this.bindings
    if (this.keysHasAny(b.up)) my -= 1
    if (this.keysHasAny(b.down)) my += 1
    if (this.keysHasAny(b.left)) mx -= 1
    if (this.keysHasAny(b.right)) mx += 1
    if (this.touch) {
      if (this.pad.up) my -= 1
      if (this.pad.down) my += 1
      if (this.pad.left) mx -= 1
      if (this.pad.right) mx += 1
    }

    this.run = !this.touch && this.keysHasAny(b.run)
    this.crouch = !this.touch && this.keysHasAny(b.crouch)
    this.interactHeld = this.keysHasAny(b.interact) || this.interactTouchId !== null

    const len = Math.hypot(mx, my)
    if (len > 1) {
      mx /= len
      my /= len
    }
    this.move.x = mx
    this.move.y = my
  }

  private keysHasAny(codes: string[]): boolean {
    for (const c of codes) {
      if (this.keys.has(c)) return true
    }
    return false
  }

  pressedAction(action: 'interact' | 'pause' | 'debug'): boolean {
    const codes = this.bindings[action]
    for (const c of codes) {
      if (this.pressedThisFrame.has(c)) {
        this.pressedThisFrame.delete(c)
        return true
      }
    }
    return false
  }

  wasPressed(code: string): boolean {
    if (this.pressedThisFrame.has(code)) {
      this.pressedThisFrame.delete(code)
      return true
    }
    return false
  }
}
