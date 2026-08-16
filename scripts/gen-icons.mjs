// Generates PWA icons (192/512 PNG) matching the eye favicon, with no external deps.
import { deflateSync, crc32 } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'icons')

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0)
  return Buffer.concat([len, body, crc])
}

function writePng(size, pixels) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = pixels[i]
      raw[o + 1] = pixels[i + 1]
      raw[o + 2] = pixels[i + 2]
      raw[o + 3] = pixels[i + 3]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const BG = [5, 6, 7]
const RIM = [109, 122, 140]
const PUPIL = [154, 168, 184]

function ellipseDist(px, py, rx, ry) {
  const nx = px / rx
  const ny = py / ry
  const len = Math.hypot(nx, ny)
  if (len < 1e-9) return -Math.min(rx, ry)
  const ux = nx / len
  const uy = ny / len
  const ex = ux * rx
  const ey = uy * ry
  const d = Math.hypot(px - ex, py - ey)
  return len < 1 ? -d : d
}

function render(size) {
  const SS = 4
  const W = size * SS
  const pixels = new Uint8Array(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const rx = size * 0.375
  const ry = size * 0.235
  const stroke = size * 0.055
  const pupilR = size * 0.2
  const innerR = size * 0.08

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS
          const fy = y + (sy + 0.5) / SS
          const px = fx - cx
          const py = fy - cy
          let col = BG
          const dEllipse = ellipseDist(px, py, rx, ry)
          if (Math.abs(dEllipse) <= stroke / 2) {
            col = RIM
          }
          const dPupil = Math.hypot(px, py) - pupilR
          if (dPupil <= 0) {
            col = PUPIL
          }
          const dInner = Math.hypot(px, py) - innerR
          if (dInner <= 0) {
            col = BG
          }
          r += col[0]
          g += col[1]
          b += col[2]
          a += 255
        }
      }
      const n = SS * SS
      const i = (y * size + x) * 4
      pixels[i] = Math.round(r / n)
      pixels[i + 1] = Math.round(g / n)
      pixels[i + 2] = Math.round(b / n)
      pixels[i + 3] = Math.round(a / n)
    }
  }
  return pixels
}

mkdirSync(OUT_DIR, { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), writePng(size, render(size)))
  console.log(`generated public/icons/icon-${size}.png`)
}
