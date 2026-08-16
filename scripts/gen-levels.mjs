// Generates validated level maps as ASCII grids to embed into level files.
// Run: node scripts/gen-levels.mjs
function makeGrid(cols, rows, fill = '.') {
  const g = []
  for (let r = 0; r < rows; r++) g.push(new Array(cols).fill(fill))
  return g
}
function set(g, x, y, ch) {
  if (y >= 0 && y < g.length && x >= 0 && x < g[y].length) g[y][x] = ch
}
function wallRect(g, x, y, w, h) {
  for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) set(g, c, r, '#')
}
function border(g) {
  for (let r = 0; r < g.length; r++) { g[r][0] = '#'; g[r][g[r].length - 1] = '#' }
  for (let c = 0; c < g[0].length; c++) { g[0][c] = '#'; g[g.length - 1][c] = '#' }
}
const PASSABLE = new Set(['.', 'P', 'W', 'D', 'K', 'S', 'X', 'G', 'B', 'M', 'L', 'C', 'E', 'Z', 'T', 'N', 'F', 'V', 'R', 'Y', 'Q'])

function validate(name, g) {
  const rows = g.length, cols = g[0].length
  const errors = []
  for (let r = 0; r < rows; r++) {
    if (g[r].length !== cols) errors.push(`row ${r} length ${g[r].length} != ${cols}`)
  }
  // find start of each entity
  const find = (ch) => {
    const out = []
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (g[r][c] === ch) out.push([c, r])
    return out
  }
  const starts = find('P')
  const exits = find('E')
  const keys = find('K')
  const plates = find('X')
  const gens = find('G')
  const doors = find('D')
  const checks = find('C')
  const batts = find('B')
  const las = find('Z')
  const notes = find('N')

  if (starts.length !== 1) errors.push(`P count = ${starts.length}`)
  if (exits.length === 0) errors.push('no exit')

  const bfs = (sx, sy) => {
    if (!PASSABLE.has(g[sy][sx])) return new Set()
    const seen = new Set()
    const q = [[sx, sy]]
    seen.add(sx + ',' + sy)
    while (q.length) {
      const [x, y] = q.shift()
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
        if (seen.has(nx + ',' + ny)) continue
        if (!PASSABLE.has(g[ny][nx])) continue
        seen.add(nx + ',' + ny)
        q.push([nx, ny])
      }
    }
    return seen
  }

  if (starts.length === 1) {
    const reach = bfs(starts[0][0], starts[0][1])
    const check = (list, label) => {
      if (list.length === 0) return
      for (const [x, y] of list) {
        if (!reach.has(x + ',' + y)) errors.push(`${label} at (${x},${y}) unreachable`)
      }
    }
    check(exits, 'E')
    check(keys, 'K')
    check(plates, 'X')
    check(gens, 'G')
    check(checks, 'C')
    check(batts, 'B')
    check(las, 'Z')
    check(notes, 'N')
    check(doors, 'D') // doors treated passable (they open)
    const ws = find('W')
    for (const w of ws) {
      // creature must have a walkable cell
      const [wx, wy] = w
      if (!PASSABLE.has(g[wy][wx])) errors.push(`W at (${wx},${wy}) on wall`)
      if (!reach.has(wx + ',' + wy)) errors.push(`W at (${wx},${wy}) unreachable from P`)
    }
  }

  console.log(`[${errors.length === 0 ? 'OK ' : 'FAIL'}] ${name} (${cols}x${rows})`)
  for (const e of errors) console.log('     - ' + e)
}

function printLevel(name, g) {
  console.log(`// === ${name} (${g[0].length} x ${g.length}) ===`)
  for (const row of g) console.log('"' + row.join('') + '",')
  console.log('')
}

// ---------------- Level 1: The Corridor (46x13) ----------------
{
  const cols = 46, rows = 13
  const g = makeGrid(cols, rows, '.')
  border(g)
  // staggered pillars
  for (const [cx, cy] of [[8,3],[16,3],[24,3],[32,3]]) wallRect(g, cx, cy, 2, 2)
  for (const [cx, cy] of [[12,8],[20,8],[28,8],[36,8]]) wallRect(g, cx, cy, 2, 2)
  // exit room right, wall col 39
  wallRect(g, 39, 1, 1, 11)
  set(g, 39, 5, 'D')     // sensor door (creature proximity)
  set(g, 33, 5, 'W')
  set(g, 2, 2, 'P')
  // exit room floor
  for (let r = 1; r < 12; r++) for (let c = 40; c < 45; c++) set(g, c, r, '.')
  set(g, 41, 4, 'E')
  validate('LEVEL 1', g)
  printLevel('LEVEL 1', g)
}

// ---------------- Level 2: The Locked Door (44x15) ----------------
{
  const cols = 44, rows = 15
  const g = makeGrid(cols, rows, '.')
  border(g)
  // west room
  wallRect(g, 12, 1, 1, 5)     // wall col12 rows1-5, opening rows6-13
  set(g, 2, 2, 'P')
  set(g, 7, 10, 'W')
  // middle room
  wallRect(g, 15, 6, 2, 2)     // pillar
  set(g, 17, 2, 'K')
  wallRect(g, 24, 1, 1, 13)    // wall col24
  set(g, 24, 7, 'D')           // locked door (key)
  // east room
  wallRect(g, 33, 3, 1, 9)     // divider col33 rows3-11
  set(g, 30, 12, 'C')
  set(g, 41, 12, 'E')
  validate('LEVEL 2', g)
  printLevel('LEVEL 2', g)
}

// ---------------- Level 3: The Pressure Plate (33x13) ----------------
{
  const cols = 33, rows = 13
  const g = makeGrid(cols, rows, '.')
  border(g)
  wallRect(g, 9, 1, 1, 5)     // col9 rows1-5
  wallRect(g, 9, 7, 1, 6)     // col9 rows7-12 -> opening at row6 only
  set(g, 9, 6, 'X')           // plate B in the only opening
  set(g, 3, 5, 'P')
  set(g, 5, 6, 'X')           // plate A
  set(g, 16, 8, 'W')
  wallRect(g, 21, 1, 1, 12)   // col21 wall
  set(g, 21, 5, 'D')          // exit door (both plates)
  set(g, 27, 7, 'E')
  set(g, 15, 3, 'C')
  validate('LEVEL 3', g)
  printLevel('LEVEL 3', g)
}

// ---------------- Level 4: The Dark Room (42x18) ----------------
{
  const cols = 42, rows = 18
  const g = makeGrid(cols, rows, '.')
  border(g)
  wallRect(g, 5, 1, 1, 4)     // battery alcove top-left
  set(g, 3, 2, 'B')
  set(g, 2, 5, 'C')           // checkpoint near spawn
  set(g, 2, 2, 'P')
  wallRect(g, 36, 1, 1, 5)    // generator nook top-right
  set(g, 38, 2, 'G')
  // exit alcove bottom-right
  wallRect(g, 36, 12, 1, 6)   // col36 rows12-17
  set(g, 36, 14, 'D')         // exit door (generator)
  set(g, 39, 14, 'E')
  // pillars
  for (const [cx, cy] of [[9,5],[17,3],[25,8],[35,10],[11,12],[30,13]]) wallRect(g, cx, cy, 2, 2)
  set(g, 22, 9, 'W')
  validate('LEVEL 4', g)
  printLevel('LEVEL 4', g)
}

// ---------------- Level 5: Two Doors (26x24) ----------------
{
  const cols = 26, rows = 24
  const g = makeGrid(cols, rows, '.')
  border(g)
  set(g, 3, 3, 'P')
  wallRect(g, 1, 6, 24, 1)    // wall row6
  set(g, 12, 6, 'D')          // door A
  set(g, 12, 7, 'X')          // plate A (creature) below door A
  set(g, 20, 12, 'W')
  wallRect(g, 1, 17, 24, 1)   // wall row17
  set(g, 12, 17, 'D')         // door B
  set(g, 12, 15, 'X')         // plate B (creature)
  set(g, 2, 21, 'E')
  set(g, 18, 21, 'C')
  validate('LEVEL 5', g)
  printLevel('LEVEL 5', g)
}

// ---------------- Level 6: Mirror Room (40x14) ----------------
{
  const cols = 40, rows = 14
  const g = makeGrid(cols, rows, '.')
  border(g)
  // west section
  set(g, 2, 2, 'P')
  wallRect(g, 11, 1, 1, 6)    // col11 rows1-6, opening rows7-12
  // middle section (key room)
  wallRect(g, 15, 8, 2, 2)    // pillar
  set(g, 17, 2, 'K')
  wallRect(g, 25, 1, 1, 13)   // col25 wall
  set(g, 25, 7, 'D')          // locked door (key)
  // east section (mirror room)
  set(g, 30, 12, 'C')
  set(g, 38, 4, 'M')          // mirror on east wall, faces west
  set(g, 34, 7, 'D')          // vision-lock gate door (mirror freeze)
  set(g, 38, 9, 'E')
  set(g, 21, 8, 'W')
  validate('LEVEL 6', g)
  printLevel('LEVEL 6', g)
}

// ---------------- Level 7: The Long Hall (20x30) ----------------
{
  const cols = 20, rows = 30
  const g = makeGrid(cols, rows, '.')
  border(g)
  set(g, 2, 2, 'P')
  // alcoves on right side
  const alcoves = [3, 11, 19]
  for (const cy of alcoves) {
    wallRect(g, 13, cy, 1, 4)      // top wall of alcove
    wallRect(g, 13, cy + 6, 1, 2)  // bottom wall of alcove -> opening rows cy+4..cy+5
    set(g, 16, cy + 1, 'T')        // spotlight
    set(g, 16, cy + 5, 'C')        // checkpoint
  }
  // chokepoint walls
  wallRect(g, 1, 10, 10, 1)       // opening at col 11
  wallRect(g, 10, 18, 9, 1)       // opening at col 9
  wallRect(g, 1, 26, 12, 1)       // opening at col 13
  set(g, 2, 28, 'E')
  set(g, 17, 28, 'W')
  validate('LEVEL 7', g)
  printLevel('LEVEL 7', g)
}

// ---------------- Level 8: The Watcher (34x20) ----------------
{
  const cols = 34, rows = 20
  const g = makeGrid(cols, rows, '.')
  border(g)
  set(g, 2, 2, 'P')
  set(g, 9, 2, 'K')          // key in start room
  wallRect(g, 12, 1, 1, 18)  // col12 wall
  set(g, 12, 5, 'D')         // locked door (key)
  // corridor cols 13-18
  wallRect(g, 19, 1, 1, 18)  // col19 wall
  set(g, 19, 10, 'D')        // laser door D2
  set(g, 16, 10, 'Z')        // laser emitter (interrupts -> opens D2)
  // plate room
  wallRect(g, 25, 1, 1, 18)  // col25 wall
  set(g, 25, 13, 'D')        // plate door D3
  set(g, 22, 13, 'X')        // plate (creature)
  // final circle room
  set(g, 33, 3, 'M')         // mirror on east wall
  set(g, 16, 14, 'W')        // creature starts in the corridor (west of laser)
  set(g, 30, 15, 'E')        // the light / witness spot exit
  validate('LEVEL 8', g)
  printLevel('LEVEL 8', g)
}
