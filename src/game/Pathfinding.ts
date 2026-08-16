import type { Rect, Vec2 } from '../types'

const CELL = 48

interface Node {
  x: number
  y: number
  g: number
  f: number
  parent: Node | null
}

export class Pathfinder {
  private cols = 0
  private rows = 0
  private base: Uint8Array = new Uint8Array(0)
  private walkable: Uint8Array = new Uint8Array(0)
  private blocks: Rect[] = []
  private cellW = CELL
  private cellH = CELL
  private margin = 6
  private cache = new Map<string, Vec2[]>()

  constructor(walls: Rect[], worldW: number, worldH: number, margin = 6) {
    this.margin = margin
    this.cols = Math.ceil(worldW / this.cellW)
    this.rows = Math.ceil(worldH / this.cellH)
    this.base = new Uint8Array(this.cols * this.rows)
    this.rebuildBase(walls)
    this.rebuild()
  }

  private rebuildBase(walls: Rect[]): void {
    const inset: Rect[] = walls.map((w) => ({
      x: w.x - this.margin,
      y: w.y - this.margin,
      w: w.w + this.margin * 2,
      h: w.h + this.margin * 2,
    }))
    for (let gy = 0; gy < this.rows; gy++) {
      for (let gx = 0; gx < this.cols; gx++) {
        const cx = gx * this.cellW + this.cellW / 2
        const cy = gy * this.cellH + this.cellH / 2
        let blocked = false
        for (const w of inset) {
          // only block when the (margin-inflated) wall covers the cell's center.
          // using full rect overlap would also block the 1-tile gap cells next to
          // a wall, making narrow doorways/plates unreachable for the creature.
          if (cx >= w.x && cx < w.x + w.w && cy >= w.y && cy < w.y + w.h) {
            blocked = true
            break
          }
        }
        this.base[gy * this.cols + gx] = blocked ? 0 : 1
      }
    }
  }

  /** mark additional blocking rects (closed doors, lasers) and rebuild walkability */
  setExtraBlocks(rects: Rect[]): void {
    this.blocks = rects
    this.cache.clear()
    this.rebuild()
  }

  private rebuild(): void {
    this.walkable = this.base.slice()
    const inset: Rect[] = this.blocks.map((w) => ({
      x: w.x - this.margin,
      y: w.y - this.margin,
      w: w.w + this.margin * 2,
      h: w.h + this.margin * 2,
    }))
    for (let gy = 0; gy < this.rows; gy++) {
      for (let gx = 0; gx < this.cols; gx++) {
        const idx = gy * this.cols + gx
        if (this.walkable[idx] === 0) continue
        const cx = gx * this.cellW + this.cellW / 2
        const cy = gy * this.cellH + this.cellH / 2
        for (const w of inset) {
          if (cx >= w.x && cx < w.x + w.w && cy >= w.y && cy < w.y + w.h) {
            this.walkable[idx] = 0
            break
          }
        }
      }
    }
  }

  private cellIndex(gx: number, gy: number): number {
    return gy * this.cols + gx
  }

  inBounds(gx: number, gy: number): boolean {
    return gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows
  }

  isWalkable(gx: number, gy: number): boolean {
    if (!this.inBounds(gx, gy)) return false
    return this.walkable[this.cellIndex(gx, gy)] === 1
  }

  private worldToCell(wx: number, wy: number): { gx: number; gy: number } {
    const gx = Math.floor(wx / this.cellW)
    const gy = Math.floor(wy / this.cellH)
    return { gx: Math.max(0, Math.min(this.cols - 1, gx)), gy: Math.max(0, Math.min(this.rows - 1, gy)) }
  }

  private cellCenter(gx: number, gy: number): Vec2 {
    return { x: gx * this.cellW + this.cellW / 2, y: gy * this.cellH + this.cellH / 2 }
  }

  clearCache(): void {
    this.cache.clear()
  }

  /** Find a path from start to target in world coordinates. */
  findPath(start: Vec2, target: Vec2): Vec2[] {
    const key = `${Math.round(start.x / this.cellW)},${Math.round(start.y / this.cellH)}->${Math.round(target.x / this.cellW)},${Math.round(target.y / this.cellH)}`
    const cached = this.cache.get(key)
    if (cached) return cached

    const s = this.worldToCell(start.x, start.y)
    const t = this.worldToCell(target.x, target.y)
    if (!this.isWalkable(t.gx, t.gy)) {
      // clamp target to nearest walkable cell
      let best: { gx: number; gy: number; d: number } | null = null
      const rad = 3
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const gx = t.gx + dx
          const gy = t.gy + dy
          if (this.isWalkable(gx, gy)) {
            const d = dx * dx + dy * dy
            if (!best || d < best.d) best = { gx, gy, d }
          }
        }
      }
      if (!best) return []
      t.gx = best.gx
      t.gy = best.gy
    }
    if (!this.isWalkable(s.gx, s.gy)) return []

    const nodes = new Map<number, Node>()
    const open: Node[] = []
    const closed = new Set<number>()
    const startNode: Node = { x: s.gx, y: s.gy, g: 0, f: this.heuristic(s.gx, s.gy, t.gx, t.gy), parent: null }
    open.push(startNode)
    nodes.set(this.cellIndex(s.gx, s.gy), startNode)

    let found: Node | null = null
    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ]
    const dCosts = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2]

    let guard = 0
    while (open.length > 0 && guard < 4000) {
      guard++
      // find lowest f (small open sets, linear scan is fine)
      let li = 0
      for (let i = 1; i < open.length; i++) {
        if (open[i].f < open[li].f) li = i
      }
      const cur = open[li]
      open.splice(li, 1)
      if (cur.x === t.gx && cur.y === t.gy) {
        found = cur
        break
      }
      const ci = this.cellIndex(cur.x, cur.y)
      if (closed.has(ci)) continue
      closed.add(ci)

      for (let d = 0; d < dirs.length; d++) {
        const nx = cur.x + dirs[d][0]
        const ny = cur.y + dirs[d][1]
        if (!this.isWalkable(nx, ny)) continue
        // avoid cutting corners diagonally
        if (d >= 4) {
          if (!this.isWalkable(cur.x + dirs[d][0], cur.y) || !this.isWalkable(cur.x, cur.y + dirs[d][1])) {
            continue
          }
        }
        const ni = this.cellIndex(nx, ny)
        if (closed.has(ni)) continue
        const g = cur.g + dCosts[d]
        const existing = nodes.get(ni)
        if (!existing) {
          const node: Node = {
            x: nx,
            y: ny,
            g,
            f: g + this.heuristic(nx, ny, t.gx, t.gy),
            parent: cur,
          }
          nodes.set(ni, node)
          open.push(node)
        } else if (g < existing.g) {
          existing.g = g
          existing.f = g + this.heuristic(nx, ny, t.gx, t.gy)
          existing.parent = cur
        }
      }
    }

    if (!found) return []
    const path: Vec2[] = []
    let cur: Node | null = found
    while (cur) {
      path.push(this.cellCenter(cur.x, cur.y))
      cur = cur.parent
    }
    path.reverse()
    // drop the first waypoint if it's basically the start cell
    if (path.length > 1) {
      const d = Math.hypot(path[1].x - start.x, path[1].y - start.y)
      if (d < this.cellW * 0.6) path.shift()
    }
    if (path.length > 32) this.cache.set(key, path)
    return path
  }

  private heuristic(ax: number, ay: number, bx: number, by: number): number {
    const dx = Math.abs(ax - bx)
    const dy = Math.abs(ay - by)
    return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy)
  }
}
