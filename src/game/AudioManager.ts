import type { Vec2 } from '../types'

interface MusicNodes {
  subGain: GainNode
  droneGain: GainNode
  tensionGain: GainNode
  dangerGain: GainNode
  criticalGain: GainNode
  windGain: GainNode
  presenceGain: GainNode
  tensionPulse: OscillatorNode
  dangerPulse: OscillatorNode
  criticalPulse: OscillatorNode
}

export class AudioManager {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private soundGain!: GainNode
  private musicGain!: GainNode
  private noiseBuf: AudioBuffer | null = null
  private music: MusicNodes | null = null
  private breathGain: GainNode | null = null
  private heartTimer = 0
  private heartBpm = 0
  private soundVolume = 0.8
  private musicVolume = 0.6
  private lastMusicDanger = 0
  private listenerPos: Vec2 = { x: 0, y: 0 }
  enabled = true

  private makeNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx!
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      // simple lowpass-ish brown noise for rumble/wind
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    }
    return buf
  }

  init(): void {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AC()
    } catch {
      this.ctx = null
      return
    }
    const ctx = this.ctx
    this.master = ctx.createGain()
    this.master.gain.value = 1
    this.master.connect(ctx.destination)
    this.soundGain = ctx.createGain()
    this.soundGain.gain.value = this.soundVolume
    this.soundGain.connect(this.master)
    this.musicGain = ctx.createGain()
    this.musicGain.gain.value = this.musicVolume
    this.musicGain.connect(this.master)
    this.noiseBuf = this.makeNoiseBuffer()
    this.buildMusic()
    this.buildBreath()
    this.startWind()
  }

  setVolumes(sound: number, music: number): void {
    this.soundVolume = sound
    this.musicVolume = music
    if (this.soundGain) this.soundGain.gain.value = sound
    if (this.musicGain) this.musicGain.gain.value = music
  }

  setEnabled(e: boolean): void {
    this.enabled = e
    if (this.master) this.master.gain.value = e ? 1 : 0
  }

  setListener(pos: Vec2): void {
    this.listenerPos = pos
  }

  private volFor(dist: number, maxDist: number, base: number): number {
    const t = Math.max(0, 1 - dist / maxDist)
    return base * t * t
  }

  private panFor(pos: Vec2): StereoPannerNode | null {
    if (!this.ctx) return null
    const pan = this.ctx.createStereoPanner()
    const dx = pos.x - this.listenerPos.x
    pan.pan.value = Math.max(-1, Math.min(1, dx / 400))
    return pan
  }

  private playTone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    opts?: { attack?: number; detune?: number; pan?: number; freqEnd?: number },
  ): void {
    if (!this.ctx || vol <= 0.001) return
    const ctx = this.ctx
    const t0 = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (opts?.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), t0 + dur)
    if (opts?.detune) osc.detune.value = opts.detune
    const g = ctx.createGain()
    const attack = opts?.attack ?? 0.01
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(vol, t0 + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    if (opts?.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner()
      p.pan.value = opts.pan
      g.connect(p)
      p.connect(this.soundGain)
    } else {
      g.connect(this.soundGain)
    }
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  private playNoise(
    dur: number,
    vol: number,
    filterFreq: number,
    opts?: { filterType?: BiquadFilterType; attack?: number; pan?: number; freqEnd?: number },
  ): void {
    if (!this.ctx || !this.noiseBuf || vol <= 0.001) return
    const ctx = this.ctx
    const t0 = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = opts?.filterType ?? 'lowpass'
    f.frequency.setValueAtTime(filterFreq, t0)
    if (opts?.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t0 + dur)
    const g = ctx.createGain()
    const attack = opts?.attack ?? 0.01
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(vol, t0 + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(f)
    f.connect(g)
    if (opts?.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner()
      p.pan.value = opts.pan
      g.connect(p)
      p.connect(this.soundGain)
    } else {
      g.connect(this.soundGain)
    }
    src.start(t0)
    src.stop(t0 + dur + 0.05)
  }

  // ---------- music layers ----------
  private buildMusic(): void {
    const ctx = this.ctx!
    const mk = (
      type: OscillatorType,
      freq: number,
      detune: number,
      gainVal: number,
      dest: AudioNode,
    ): OscillatorNode => {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = freq
      o.detune.value = detune
      const g = ctx.createGain()
      g.gain.value = gainVal
      o.connect(g)
      g.connect(dest)
      o.start()
      return o
    }

    const sub = ctx.createGain()
    sub.gain.value = 0.5
    mk('sine', 48, 0, 0.5, sub)
    mk('sine', 48.7, 0, 0.35, sub)

    const drone = ctx.createGain()
    drone.gain.value = 0.14
    mk('sawtooth', 96, 0, 0.05, drone)
    mk('sine', 191.8, 0, 0.07, drone)

    const tension = ctx.createGain()
    tension.gain.value = 0
    const tensionPulse = mk('triangle', 72.5, 0, 0.5, tension)
    mk('sine', 145, 12, 0.08, tension)

    const danger = ctx.createGain()
    danger.gain.value = 0
    const dangerPulse = mk('square', 64, 0, 0.12, danger)
    mk('sine', 650, 0, 0.02, danger)

    const critical = ctx.createGain()
    critical.gain.value = 0
    const criticalPulse = mk('sawtooth', 55, 0, 0.2, critical)
    mk('sine', 920, 0, 0.015, critical)

    // presence: swells while the Watcher is in your vision (a held, breathless high tone)
    const presence = ctx.createGain()
    presence.gain.value = 0
    mk('sine', 988, 4, 0.05, presence)
    mk('sine', 1976, -6, 0.018, presence)

    // wind bed (filtered noise) through music bus
    const wind = ctx.createGain()
    wind.gain.value = 0.25
    if (this.noiseBuf) {
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuf
      src.loop = true
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 300
      f.Q.value = 1
      src.connect(f)
      f.connect(wind)
      src.start()
    }

    const sum = ctx.createGain()
    sum.gain.value = 1
    sub.connect(sum)
    drone.connect(sum)
    tension.connect(sum)
    danger.connect(sum)
    critical.connect(sum)
    presence.connect(sum)
    wind.connect(sum)
    sum.connect(this.musicGain)

    this.music = {
      subGain: sub,
      droneGain: drone,
      tensionGain: tension,
      dangerGain: danger,
      criticalGain: critical,
      windGain: wind,
      presenceGain: presence,
      tensionPulse,
      dangerPulse,
      criticalPulse,
    }
  }

  /** set music intensity based on danger factor 0..1 */
  setMusicDanger(factor: number): void {
    if (!this.music || !this.ctx) return
    const m = this.music
    const f = Math.max(0, Math.min(1, factor))
    if (Math.abs(f - this.lastMusicDanger) < 0.005) return
    this.lastMusicDanger = f
    const t = this.ctx.currentTime
    const ease = (g: AudioParam, v: number) => g.setTargetAtTime(v, t, 0.8)
    ease(m.tensionGain.gain, f * 0.14)
    ease(m.dangerGain.gain, Math.max(0, (f - 0.5) * 2) * 0.12)
    ease(m.criticalGain.gain, Math.max(0, (f - 0.8) * 5) * 0.16)
    ease(m.subGain.gain, 0.5 + f * 0.4)
    ease(m.droneGain.gain, 0.1 + f * 0.1)
    // pulses quicken with danger
    const bpmBase = 24 + f * 50
    m.tensionPulse.frequency.setTargetAtTime(bpmBase, t, 0.6)
    m.dangerPulse.frequency.setTargetAtTime(bpmBase * 2, t, 0.6)
    m.criticalPulse.frequency.setTargetAtTime(bpmBase * 4, t, 0.6)
  }

  /** swell the presence layer while the Watcher is in your vision */
  setCreatureVisible(v: number): void {
    if (!this.music || !this.ctx) return
    const g = this.music.presenceGain.gain
    const t = this.ctx.currentTime
    g.setTargetAtTime(v * 0.5, t, 0.6)
  }

  private buildBreath(): void {
    const ctx = this.ctx!
    this.breathGain = ctx.createGain()
    this.breathGain.gain.value = 0
    this.breathGain.connect(this.soundGain)
    if (this.noiseBuf) {
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuf
      src.loop = true
      const f = ctx.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 500
      f.Q.value = 2
      src.connect(f)
      f.connect(this.breathGain)
      src.start()
    }
  }

  /** continuously modulate breath gain; call each frame */
  updateBreath(level: number): void {
    if (!this.ctx || !this.breathGain) return
    const t = this.ctx.currentTime
    const base = level * level
    // gentle in/out breath cycle
    const breath = 0.5 + 0.5 * Math.sin(t * 1.6)
    const target = base * (0.06 + breath * 0.12)
    this.breathGain.gain.setTargetAtTime(target, t, 0.35)
  }

  setHeartbeat(bpm: number): void {
    this.heartBpm = bpm
  }

  /** call each frame to trigger heartbeats on schedule */
  updateHeartbeat(dt: number): void {
    if (this.heartBpm <= 0) return
    this.heartTimer -= dt
    if (this.heartTimer <= 0) {
      this.heartTimer = 60 / this.heartBpm
      this.playHeartLub()
    }
  }

  private playHeartLub(): void {
    this.playTone(58, 0.12, 'sine', 0.5, { attack: 0.005, freqEnd: 38 })
    setTimeout(() => {
      this.playTone(50, 0.1, 'sine', 0.32, { attack: 0.005, freqEnd: 34 })
    }, 110)
  }

  private startWind(): void {
    if (!this.music?.windGain || !this.noiseBuf || !this.ctx) return
    // wind handled inside buildMusic via windGain
  }

  // ---------- SFX ----------

  playerFootstep(strength: number): void {
    const v = 0.05 + strength * 0.1
    this.playNoise(0.12, v, 220, { filterType: 'lowpass' })
    this.playTone(90 + Math.random() * 30, 0.08, 'sine', v * 0.5, { freqEnd: 45 })
  }

  creatureFootstep(pos: Vec2, volumeScale = 1): void {
    const d = Math.hypot(pos.x - this.listenerPos.x, pos.y - this.listenerPos.y)
    const v = this.volFor(d, 700, 0.5) * volumeScale
    if (v < 0.005) return
    const pan = this.panFor(pos)
    this.playNoise(0.18, v, 150, { filterType: 'lowpass', pan: pan?.pan.value })
    this.playTone(60 + Math.random() * 20, 0.14, 'sine', v * 0.8, { freqEnd: 30, pan: pan?.pan.value })
  }

  doorSqueak(): void {
    this.playNoise(0.6, 0.16, 900, { filterType: 'bandpass', freqEnd: 300 })
    this.playTone(220, 0.5, 'sawtooth', 0.02, { freqEnd: 120 })
  }

  doorThud(): void {
    this.playNoise(0.15, 0.3, 120, { filterType: 'lowpass' })
    this.playTone(55, 0.2, 'sine', 0.4, { freqEnd: 30 })
  }

  switchClick(): void {
    this.playNoise(0.05, 0.25, 3000, { filterType: 'highpass' })
    this.playTone(1200, 0.04, 'square', 0.08, { freqEnd: 800 })
  }

  leverMove(): void {
    this.playNoise(0.2, 0.2, 700, { filterType: 'bandpass' })
    this.playTone(180, 0.15, 'square', 0.06, { freqEnd: 240 })
  }

  keyPickup(): void {
    this.playTone(660, 0.3, 'sine', 0.16, { attack: 0.01, freqEnd: 990 })
    this.playTone(990, 0.4, 'sine', 0.1, { attack: 0.05, freqEnd: 1320 })
  }

  batteryPickup(): void {
    this.playTone(220, 0.3, 'sine', 0.16, { freqEnd: 330 })
    this.playNoise(0.2, 0.1, 800, { filterType: 'bandpass' })
  }

  knock(pos: Vec2): void {
    const d = Math.hypot(pos.x - this.listenerPos.x, pos.y - this.listenerPos.y)
    const v = this.volFor(d, 800, 0.6)
    if (v < 0.005) return
    const pan = this.panFor(pos)
    this.playTone(90, 0.14, 'sine', v, { attack: 0.002, freqEnd: 55, pan: pan?.pan.value })
    setTimeout(() => {
      this.playTone(82, 0.12, 'sine', v * 0.8, { attack: 0.002, freqEnd: 50, pan: pan?.pan.value })
    }, 180)
  }

  whisper(): void {
    this.playNoise(1.6, 0.08, 1400, { filterType: 'bandpass', freqEnd: 700 })
    this.playNoise(1.2, 0.05, 2000, { filterType: 'bandpass' })
  }

  buzz(pos: Vec2): void {
    const d = Math.hypot(pos.x - this.listenerPos.x, pos.y - this.listenerPos.y)
    const v = this.volFor(d, 600, 0.3)
    if (v < 0.005) return
    this.playTone(110, 0.5, 'sawtooth', v, { attack: 0.02, freqEnd: 100 })
  }

  lightFlicker(): void {
    this.playNoise(0.12, 0.2, 2500, { filterType: 'bandpass' })
    this.playNoise(0.08, 0.12, 4000, { filterType: 'highpass' })
  }

  generatorStart(): void {
    this.playNoise(0.8, 0.25, 200, { filterType: 'lowpass', freqEnd: 350 })
    this.playTone(70, 0.8, 'sawtooth', 0.08, { freqEnd: 110 })
  }

  generatorHum(pos: Vec2): void {
    const d = Math.hypot(pos.x - this.listenerPos.x, pos.y - this.listenerPos.y)
    const v = this.volFor(d, 700, 0.2)
    if (v < 0.005) return
    this.playTone(95, 0.6, 'sine', v, { attack: 0.1, freqEnd: 100 })
  }

  stingDeath(): void {
    this.playTone(180, 1.4, 'sawtooth', 0.3, { attack: 0.01, freqEnd: 40 })
    this.playNoise(1.2, 0.3, 600, { filterType: 'lowpass', freqEnd: 100 })
  }

  checkpoint(): void {
    this.playTone(440, 0.5, 'sine', 0.14, { attack: 0.02, freqEnd: 440 })
    this.playTone(660, 0.6, 'sine', 0.1, { attack: 0.2, freqEnd: 660 })
  }

  creatureReveal(): void {
    this.playNoise(0.8, 0.25, 900, { filterType: 'bandpass', freqEnd: 200 })
    this.playTone(150, 1.2, 'sawtooth', 0.12, { freqEnd: 60 })
  }

  /** distant scream: rises and cuts, like something far off being taken */
  scream(pos: Vec2): void {
    const d = Math.hypot(pos.x - this.listenerPos.x, pos.y - this.listenerPos.y)
    const v = this.volFor(d, 900, 0.7)
    if (v < 0.005) return
    const pan = this.panFor(pos)
    const dur = 1.4
    this.playTone(700, dur, 'sawtooth', v * 0.16, {
      attack: 0.25,
      freqEnd: 90,
      pan: pan?.pan.value,
    })
    this.playNoise(dur, v * 0.12, 900, { filterType: 'bandpass', freqEnd: 300, pan: pan?.pan.value })
  }

  /** low, wet growl while it is visible in your vision */
  creatureGrowl(): void {
    this.playTone(70 + Math.random() * 12, 0.9, 'sawtooth', 0.1, { attack: 0.15, freqEnd: 52 })
    this.playNoise(0.7, 0.08, 400, { filterType: 'lowpass', freqEnd: 150 })
  }

  /** brief but violent hit when it grazes you */
  graze(): void {
    this.playNoise(0.35, 0.4, 500, { filterType: 'lowpass', freqEnd: 90 })
    this.playTone(120, 0.5, 'sawtooth', 0.28, { attack: 0.01, freqEnd: 38 })
    this.playNoise(0.3, 0.2, 2400, { filterType: 'bandpass' })
  }

  /** calming chime after a checkpoint restores your composure */
  restore(): void {
    this.playTone(392, 1.2, 'sine', 0.08, { attack: 0.4 })
    this.playTone(523, 1.4, 'sine', 0.05, { attack: 0.7 })
  }

  lightBeam(): void {
    this.playNoise(0.15, 0.1, 1800, { filterType: 'bandpass' })
  }

  complete(): void {
    this.playTone(523, 0.6, 'sine', 0.18, { attack: 0.05 })
    this.playTone(659, 0.6, 'sine', 0.14, { attack: 0.15 })
    this.playTone(784, 0.9, 'sine', 0.12, { attack: 0.3 })
  }

  /** short, eerie music-box tune the radio plays while switched on */
  radioTune(pos: Vec2): void {
    const d = Math.hypot(pos.x - this.listenerPos.x, pos.y - this.listenerPos.y)
    const v = this.volFor(d, 800, 0.5)
    if (v < 0.005) return
    const pan = this.panFor(pos)?.pan.value
    const notes = [523.25, 659.25, 783.99, 587.33, 698.46]
    const start = Math.floor(Math.random() * notes.length)
    notes.slice(start, start + 3).forEach((f, i) => {
      setTimeout(() => {
        this.playTone(f, 0.5, 'triangle', v * 0.5, { attack: 0.02, freqEnd: f * 0.98, pan })
        this.playTone(f * 2, 0.35, 'sine', v * 0.18, { attack: 0.02, pan })
      }, i * 190)
    })
  }

  radioSwitchOn(): void {
    this.playTone(880, 0.1, 'square', 0.05, { freqEnd: 660 })
  }

  /** a thrown decoy clattering on the floor */
  decoyClatter(pos: Vec2): void {
    const d = Math.hypot(pos.x - this.listenerPos.x, pos.y - this.listenerPos.y)
    const v = this.volFor(d, 900, 0.9)
    if (v < 0.005) return
    const pan = this.panFor(pos)?.pan.value
    this.playNoise(0.3, v * 0.5, 2200, { filterType: 'highpass', pan })
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this.playTone(300 + Math.random() * 500, 0.06, 'square', v * 0.4, { pan })
        this.playNoise(0.05, v * 0.3, 4000, { filterType: 'highpass', pan })
      }, i * 120)
    }
  }

  /** deep, slow bell toll — the only clock the Watcher obeys */
  bellToll(pos: Vec2): void {
    const d = Math.hypot(pos.x - this.listenerPos.x, pos.y - this.listenerPos.y)
    const v = this.volFor(d, 1200, 0.7)
    if (v < 0.005) return
    const pan = this.panFor(pos)?.pan.value
    this.playTone(110, 2.6, 'sine', v * 0.8, { attack: 0.02, freqEnd: 108, pan })
    this.playTone(220, 2.0, 'sine', v * 0.25, { attack: 0.05, pan })
    this.playTone(440, 1.2, 'sine', v * 0.08, { attack: 0.1, pan })
    setTimeout(() => this.playNoise(1.6, v * 0.2, 300, { filterType: 'bandpass', pan }), 300)
  }

  /** metal creak while a valve is being turned */
  crankCreak(intensity = 0.5): void {
    this.playNoise(0.12, 0.1 + intensity * 0.2, 500 + Math.random() * 300, { filterType: 'bandpass' })
    this.playTone(120 + Math.random() * 60, 0.08, 'square', 0.03 + intensity * 0.04, { freqEnd: 100 })
  }

  /** soft whoosh marking the blink */
  blinkWhoosh(): void {
    this.playNoise(0.3, 0.12, 700, { filterType: 'bandpass', freqEnd: 200 })
    this.playTone(880, 0.25, 'sine', 0.03, { freqEnd: 440 })
  }

  /** low hum / distant chime for the secret release */
  secretRelease(): void {
    this.playTone(196, 1.8, 'sine', 0.12, { attack: 0.4, freqEnd: 196 })
    this.playTone(294, 2.2, 'sine', 0.1, { attack: 0.9, freqEnd: 294 })
    this.playTone(392, 3.0, 'sine', 0.08, { attack: 1.4, freqEnd: 392 })
  }
}
