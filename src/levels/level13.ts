import type { DoorObject, PressurePlateObject } from '../types'
import { buildLevel, type LevelBlueprint } from '../game/LevelManager'

/**
 * The Labyrinth — generated fresh on every page load.
 * A recursive-backtracker maze is carved, then three latch switches are buried
 * in it. The exit sits behind a sealed hall with three locks; each lock opens
 * only with its switch. A key, pressure plates and a checkpoint are shuffled to
 * random open cells each run, and two optional plate-gated shortcuts are carved.
 */

/** deterministic PRNG so a run can be reproduced from its seed */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeGrid(cols: number, rows: number, fill: string): string[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(fill))
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

/** carve a perfect maze into `grid` with recursive backtracker; returns floor cell list (tile coords) */
function carveMaze(
  grid: string[][],
  cols: number,
  maxCellRow: number,
  rand: () => number,
): [number, number][] {
  const cells: [number, number][] = []
  for (let r = 1; r <= maxCellRow; r += 2) {
    for (let c = 1; c < cols - 1; c += 2) {
      cells.push([c, r])
    }
  }
  const start = cells[Math.floor(rand() * cells.length)]
  const stack: [number, number][] = [start]
  grid[start[1]][start[0]] = '.'
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1]
    const dirs = shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]], rand)
    let carved = false
    for (const [dx, dy] of dirs) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 1 || ny < 1 || nx >= cols - 1 || ny > maxCellRow + 1) continue
      if (grid[ny][nx] === '#') {
        grid[cy + dy / 2][cx + dx / 2] = '.'
        grid[ny][nx] = '.'
        stack.push([nx, ny])
        carved = true
        break
      }
    }
    if (!carved) stack.pop()
  }
  return cells.filter(([c, r]) => grid[r][c] === '.')
}

function buildLabyrinth(): LevelBlueprint {
  const cols = 37
  const rows = 25
  const seed = (Math.random() * 0xffffffff) >>> 0
  const rand = mulberry32(seed)
  const g = makeGrid(cols, rows, '#')

  // --- bottom hall: the final stretch, sealed from the maze except one entrance ---
  const hallR = rows - 3 // 22
  // keep the maze cells above the hall so the hall stays sealed
  const maxCellRow = hallR - 3 // 19

  const floorCells = carveMaze(g, cols, maxCellRow, rand)

  for (let c = 1; c < cols - 1; c++) g[hallR][c] = '.'
  // seal the maze from the hall
  for (let c = 1; c < cols - 1; c++) {
    if (c !== 3) g[hallR - 1][c] = '#'
  }
  // force the entrance stair at column 3
  g[hallR - 1][3] = '.'
  g[hallR - 2][3] = '.'

  // --- exit at the east end of the hall ---
  const exitC = cols - 3
  const exitR = hallR
  g[exitR][exitC] = 'E'

  // three locks in series before the exit
  const lockCols = [cols - 5, cols - 8, cols - 11]
  for (const lc of lockCols) g[hallR][lc] = 'D'

  // a key-locked door blocks the hall entrance
  const keyDoorC = 5
  g[hallR][keyDoorC] = 'D'

  // --- player start: top-left ---
  g[1][1] = 'P'

  // --- creature: deep in the maze, far from the start ---
  const wStart = floorCells.find(([c, r]) => c > cols * 0.55 && r > rows * 0.5)
  if (wStart) g[wStart[1]][wStart[0]] = 'W'

  // --- three latch switches buried in the maze ---
  const switchCells = shuffle(
    floorCells.filter(([c, r]) => r < hallR - 1 && (c !== 1 || r !== 1) && c > 1 && r > 1),
    rand,
  )
  const sw1 = switchCells[0]
  const sw2 = switchCells[1]
  const sw3 = switchCells[2]
  g[sw1[1]][sw1[0]] = 'S'
  g[sw2[1]][sw2[0]] = 'S'
  g[sw3[1]][sw3[0]] = 'S'

  // --- key, checkpoint, story note: shuffled ---
  const randCells = shuffle(
    floorCells.filter(
      ([c, r]) =>
        r < hallR - 1 &&
        c > 1 &&
        r > 1 &&
        (c !== sw1[0] || r !== sw1[1]) &&
        (c !== sw2[0] || r !== sw2[1]) &&
        (c !== sw3[0] || r !== sw3[1]),
    ),
    rand,
  )
  const keyCell = randCells[0]
  const checkCell = randCells[1]
  const noteCell = randCells[2]
  g[keyCell[1]][keyCell[0]] = 'K'
  g[checkCell[1]][checkCell[0]] = 'C'
  g[noteCell[1]][noteCell[0]] = 'N'

  // --- two optional plate-gated shortcuts: doors cut through thin walls ---
  const plateObjs: Record<string, Partial<PressurePlateObject>> = {}
  const plateDoors: Record<string, Partial<DoorObject>> = {}
  const thinWalls: [number, number][] = []
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (g[r][c] !== '#') continue
      const leftOpen = g[r][c - 1] === '.'
      const rightOpen = g[r][c + 1] === '.'
      const upOpen = g[r - 1][c] === '.'
      const downOpen = g[r + 1][c] === '.'
      if ((leftOpen && rightOpen) || (upOpen && downOpen)) thinWalls.push([c, r])
    }
  }
  const chosen = shuffle(thinWalls.filter(([, r]) => r < hallR - 2), rand)
  for (let i = 0; i < 2 && i < chosen.length; i++) {
    const [dc, dr] = chosen[i]
    g[dr][dc] = 'D'
    const doorId = `D_${dc}_${dr}`
    // a plate on one of the adjacent open cells
    const openNbr = ([c, r]: [number, number]) => g[r][c] === '.'
    let plateCell: [number, number] | null = null
    if (openNbr([dc, dr - 1])) plateCell = [dc, dr - 1]
    else if (openNbr([dc, dr + 1])) plateCell = [dc, dr + 1]
    else if (openNbr([dc - 1, dr])) plateCell = [dc - 1, dr]
    else if (openNbr([dc + 1, dr])) plateCell = [dc + 1, dr]
    if (plateCell) {
      const [px, py] = plateCell
      g[py][px] = 'X'
      plateObjs[`X_${px}_${py}`] = { requires: 'any', targetId: doorId }
      plateDoors[doorId] = {
        locked: false,
        opensWith: ['plate'],
        sourceIds: [`X_${px}_${py}`],
        mode: 'any',
        holdTime: 4,
        slideDir: 'up',
      }
    }
  }

  const doors: Record<string, Partial<DoorObject>> = {
    [`D_${keyDoorC}_${hallR}`]: {
      locked: true,
      keyId: 'key_1',
      opensWith: ['key'],
      sourceIds: [],
      holdTime: 9999,
      slideDir: 'down',
    },
    [`D_${lockCols[0]}_${hallR}`]: {
      locked: false,
      opensWith: ['switch'],
      sourceIds: [`S_${sw1[0]}_${sw1[1]}`],
      mode: 'any',
      holdTime: 9999,
      slideDir: 'up',
    },
    [`D_${lockCols[1]}_${hallR}`]: {
      locked: false,
      opensWith: ['switch'],
      sourceIds: [`S_${sw2[0]}_${sw2[1]}`],
      mode: 'any',
      holdTime: 9999,
      slideDir: 'up',
    },
    [`D_${lockCols[2]}_${hallR}`]: {
      locked: false,
      opensWith: ['switch'],
      sourceIds: [`S_${sw3[0]}_${sw3[1]}`],
      mode: 'any',
      holdTime: 9999,
      slideDir: 'up',
    },
    ...plateDoors,
  }

  return {
    id: 13,
    name: 'The Labyrinth',
    subtitle: 'They said: three locks, throw away the map. Then they locked it in with us.',
    briefing: [
      'No two visits are the same. The walls re-grow while you are not looking.',
      'Three switches are buried somewhere in the maze. Each unseals one lock.',
      'A key, a resting place, and a story note — all moved since the last time you were here.',
      'Find the switches. Open the locks. Do not let it corner you at a dead end.',
      'And if you have read the other notes, you know what to do at the end.',
    ],
    map: g.map((row) => row.join('')),
    creature: { speed: 112, chaseMul: 1.55, reactDelay: 0.3 },
    ambient: { darkness: 0.95, fogDensity: 0.65, fogColor: 'rgba(6,8,16,0.4)', tint: 'rgba(8,10,20,0.35)', flickerIntensity: 1.4, whisperChance: 0.45 },
    player: { speed: 166 },
    prowl: [],
    overrides: {
      keys: {
        [`K_${keyCell[0]}_${keyCell[1]}`]: { keyId: 'key_1' },
      },
      plates: plateObjs,
      notes: {
        [`N_${noteCell[0]}_${noteCell[1]}`]: {
          id: 'story_labyrinth',
          storyIndex: 4,
          text: 'ENTRY 5 — Final. They said: lock it in the Labyrinth, three locks, throw away the map. But it was never locked in. We were. The one who looks is the one who stays — that was always the rule, and we wrote it down and forgot what it meant. Stop looking. Let it leave. Let yourself leave.',
        },
      },
      doors,
    },
  }
}

export default buildLevel(buildLabyrinth())
