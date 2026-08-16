import type { Rect, Vec2 } from '../types'

export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

export const pointInRect = (px: number, py: number, r: Rect): boolean =>
  px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h

export const rectCenter = (r: Rect): Vec2 => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

export const distSq = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * Ray-AABB intersection (slab method). Returns distance along the ray to the
 * nearest hit, or Infinity if no hit.
 */
export function rayRectHit(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  r: Rect,
): number {
  if (dx === 0 && dy === 0) return Number.POSITIVE_INFINITY

  let tmin = 0
  let tmax = Number.POSITIVE_INFINITY

  if (dx === 0) {
    if (ox < r.x || ox > r.x + r.w) return Number.POSITIVE_INFINITY
  } else {
    let t1 = (r.x - ox) / dx
    let t2 = (r.x + r.w - ox) / dx
    if (t1 > t2) {
      const tmp = t1
      t1 = t2
      t2 = tmp
    }
    tmin = Math.max(tmin, t1)
    tmax = Math.min(tmax, t2)
    if (tmin > tmax) return Number.POSITIVE_INFINITY
  }

  if (dy === 0) {
    if (oy < r.y || oy > r.y + r.h) return Number.POSITIVE_INFINITY
  } else {
    let t1 = (r.y - oy) / dy
    let t2 = (r.y + r.h - oy) / dy
    if (t1 > t2) {
      const tmp = t1
      t1 = t2
      t2 = tmp
    }
    tmin = Math.max(tmin, t1)
    tmax = Math.min(tmax, t2)
    if (tmin > tmax) return Number.POSITIVE_INFINITY
  }

  if (tmax < 0) return Number.POSITIVE_INFINITY
  if (tmin < 0) return 0
  return tmin
}

/**
 * Cast a ray from (ox,oy) along (dx,dy) against a list of rects, returns the
 * distance to the nearest hit (Infinity if none).
 */
export function castRay(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  rects: Rect[],
  maxDist = Number.POSITIVE_INFINITY,
): number {
  let best = maxDist
  for (const r of rects) {
    const t = rayRectHit(ox, oy, dx, dy, r)
    if (t < best) best = t
  }
  return best
}

/**
 * Determine whether a point is visible from (ox,oy), i.e. no rect blocks the
 * straight line of sight before reaching the point.
 */
export function lineOfSight(
  ox: number,
  oy: number,
  tx: number,
  ty: number,
  rects: Rect[],
): boolean {
  const dx = tx - ox
  const dy = ty - oy
  const d = Math.hypot(dx, dy)
  if (d === 0) return true
  const hit = castRay(ox, oy, dx / d, dy / d, rects, d)
  return hit >= d
}

/** Axis-aligned circle vs rect collision resolution. Returns corrected position. */
export function resolveCircleRect(
  px: number,
  py: number,
  radius: number,
  r: Rect,
): { x: number; y: number; hit: boolean } {
  const cx = clamp(px, r.x, r.x + r.w)
  const cy = clamp(py, r.y, r.y + r.h)
  const dx = px - cx
  const dy = py - cy
  const d2 = dx * dx + dy * dy
  if (d2 >= radius * radius) return { x: px, y: py, hit: false }

  const d = Math.sqrt(d2)
  if (d === 0) {
    // center inside rect: push out along smallest penetration axis
    const left = px - r.x
    const right = r.x + r.w - px
    const top = py - r.y
    const bottom = r.y + r.h - py
    const minDist = Math.min(left, right, top, bottom)
    if (minDist === left) return { x: r.x - radius, y: py, hit: true }
    if (minDist === right) return { x: r.x + r.w + radius, y: py, hit: true }
    if (minDist === top) return { x: px, y: r.y - radius, hit: true }
    return { x: px, y: r.y + r.h + radius, hit: true }
  }
  const overlap = radius - d
  return {
    x: px + (dx / d) * overlap,
    y: py + (dy / d) * overlap,
    hit: true,
  }
}

export interface CollisionWorld {
  walls: Rect[]
  solids: Rect[]
}

/**
 * Move a circle through the world resolving collisions axis-by-axis.
 * Returns the new position.
 */
export function moveCircle(
  x: number,
  y: number,
  radius: number,
  dx: number,
  dy: number,
  world: CollisionWorld,
): { x: number; y: number; blockedX: boolean; blockedY: boolean } {
  let nx = x
  let ny = y
  let blockedX = false
  let blockedY = false

  const solids = world.solids

  nx += dx
  for (const r of solids) {
    const res = resolveCircleRect(nx, ny, radius, r)
    if (res.hit && res.x !== nx) {
      nx = res.x
      blockedX = true
    }
  }

  ny += dy
  for (const r of solids) {
    const res = resolveCircleRect(nx, ny, radius, r)
    if (res.hit && res.y !== ny) {
      ny = res.y
      blockedY = true
    }
  }

  return { x: nx, y: ny, blockedX, blockedY }
}
