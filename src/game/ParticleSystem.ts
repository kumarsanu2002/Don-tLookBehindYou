export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  gravity: number
  drag: number
  fade: boolean
  glow: boolean
  shape: 'circle' | 'smoke'
  rotation: number
  vr: number
}

const COLORS = {
  dust: 'rgba(118,90,60,',
  smoke: 'rgba(60,58,60,',
  steam: 'rgba(148,150,160,',
  ash: 'rgba(90,88,95,',
  spark: 'rgba(210,205,190,',
  ember: 'rgba(200,120,60,',
  blood: 'rgba(80,12,10,',
  light: 'rgba(200,195,180,',
}

export class ParticleSystem {
  particles: Particle[] = []
  private max = 420

  spawn(p: Partial<Particle> & { x: number; y: number }): void {
    if (this.particles.length >= this.max) {
      this.particles.shift()
    }
    this.particles.push({
      vx: 0,
      vy: 0,
      life: 1,
      maxLife: 1,
      size: 2,
      color: 'rgba(255,255,255,',
      gravity: 0,
      drag: 0,
      fade: true,
      glow: false,
      shape: 'circle',
      rotation: 0,
      vr: 0,
      ...p,
    })
  }

  dust(x: number, y: number, count = 3): void {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 12,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 40,
        vy: -Math.random() * 20 - 5,
        life: 0.8 + Math.random() * 0.8,
        maxLife: 1.6,
        size: 1.5 + Math.random() * 2,
        color: COLORS.dust,
        drag: 1.5,
        shape: 'smoke',
      })
    }
  }

  footstep(x: number, y: number): void {
    this.spawn({
      x: x + (Math.random() - 0.5) * 8,
      y: y + 2,
      vx: (Math.random() - 0.5) * 8,
      vy: -Math.random() * 4,
      life: 0.15,
      maxLife: 0.6,
      size: 0.8 + Math.random() * 1.2,
      color: COLORS.dust,
      drag: 2,
      shape: 'smoke',
    })
  }

  creatureStep(x: number, y: number): void {
    this.spawn({
      x,
      y,
      vx: 0,
      vy: -8,
      life: 0.6,
      maxLife: 0.6,
      size: 3,
      color: COLORS.smoke,
      drag: 1,
      shape: 'smoke',
    })
  }

  spark(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 30 + Math.random() * 60
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.4,
        maxLife: 0.7,
        size: 1 + Math.random() * 1.5,
        color: COLORS.spark,
        gravity: 60,
        drag: 2,
        glow: true,
      })
    }
  }

  lightFlicker(x: number, y: number): void {
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2
      this.spawn({
        x: x + Math.cos(a) * 40,
        y: y + Math.sin(a) * 40,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 4,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        size: 1 + Math.random() * 1.5,
        color: COLORS.ember,
        glow: true,
        shape: 'smoke',
      })
    }
  }

  objectFall(x: number, y: number): void {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI
      const sp = 20 + Math.random() * 50
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * sp * (Math.random() < 0.5 ? -1 : 1),
        vy: -Math.random() * 60,
        life: 0.6 + Math.random() * 0.6,
        maxLife: 1.2,
        size: 1 + Math.random() * 2,
        color: COLORS.ash,
        gravity: 220,
        drag: 1,
      })
    }
  }

  shadowStreak(x: number, y: number, dir: number): void {
    for (let i = 0; i < 10; i++) {
      const a = dir + (Math.random() - 0.5) * 0.6
      const sp = 60 + Math.random() * 80
      this.spawn({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        size: 3 + Math.random() * 4,
        color: COLORS.smoke,
        drag: 3,
        shape: 'smoke',
      })
    }
  }

  emberSpawn(x: number, y: number): void {
    this.spawn({
      x,
      y,
      vx: (Math.random() - 0.5) * 10,
      vy: -20 - Math.random() * 30,
      life: 1 + Math.random() * 1.5,
      maxLife: 2.5,
      size: 1 + Math.random() * 1.5,
      color: COLORS.ember,
      glow: true,
      shape: 'smoke',
      drag: 0.5,
    })
  }

  /** pressure-lock hiss: steam wisps escaping along a door frame as it unseals */
  hiss(x: number, y: number, w: number, h: number): void {
    const edges: [number, number][] = []
    for (let i = 0; i <= 4; i++) {
      const t = (i / 4) * w
      edges.push([x + t, y])
      edges.push([x + t, y + h])
    }
    for (let i = 0; i <= 2; i++) {
      const t = (i / 2) * h
      edges.push([x, y + t])
      edges.push([x + w, y + t])
    }
    for (const [ex, ey] of edges) {
      this.spawn({
        x: ex + (Math.random() - 0.5) * 4,
        y: ey + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 20 - 4,
        life: 0.35 + Math.random() * 0.4,
        maxLife: 0.8,
        size: 1.2 + Math.random() * 1.6,
        color: COLORS.steam,
        drag: 2,
        shape: 'smoke',
      })
    }
  }

  /** small golden twinkle burst on item pickup */
  sparkle(x: number, y: number): void {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 24 + Math.random() * 46
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.35,
        maxLife: 0.65,
        size: 1.2 + Math.random() * 1.4,
        color: COLORS.spark,
        glow: true,
        drag: 2.5,
      })
    }
  }

  update(dt: number): void {
    const ps = this.particles
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.life -= dt
      if (p.life <= 0) {
        ps[i] = ps[ps.length - 1]
        ps.pop()
        continue
      }
      p.vy += p.gravity * dt
      if (p.drag > 0) {
        const d = Math.exp(-p.drag * dt)
        p.vx *= d
        p.vy *= d
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rotation += p.vr * dt
    }
  }

  render(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }): void {
    const ps = this.particles
    for (const p of ps) {
      const t = Math.max(0, p.life / p.maxLife)
      const alpha = p.fade ? t : 1
      ctx.globalAlpha = alpha * 0.8
      ctx.fillStyle = p.color + alpha.toFixed(3) + ')'
      const sx = p.x - cam.x
      const sy = p.y - cam.y
      if (p.glow) {
        ctx.shadowBlur = 8
        ctx.shadowColor = p.color + (alpha * 0.6).toFixed(3) + ')'
      }
      if (p.shape === 'smoke') {
        ctx.beginPath()
        ctx.arc(sx, sy, p.size * (1 + (1 - t)), 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.save()
        ctx.translate(sx, sy)
        ctx.rotate(p.rotation)
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        ctx.restore()
      }
      ctx.shadowBlur = 0
    }
    ctx.globalAlpha = 1
  }
}
