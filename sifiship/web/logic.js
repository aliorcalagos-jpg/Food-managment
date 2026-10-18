// SIFIship game rules: no drawing, no DOM. Shared by the game (game.js) and the checks (test/logic.check.mjs).
//
// A level is a hangar grid of ships. Each ship faces one way (its arrow) along its long side and can only
// leave the hangar if every cell between its nose and the grid edge is empty. A launched ship parks in one of
// a few launch bays and shoots the enemy at the front of the wave when the colors match; a ship that has used
// all its shots warps away and frees its bay. The level is cleared when the wave is gone, and lost when every
// bay is taken by ships that cannot shoot the front enemy (or the wave breaks through the base shield).

export const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export const COLORS = [
  { name: "red", main: "#ff3b5c", dark: "#a3123a", glow: "#ff8aa0" },
  { name: "cyan", main: "#22e4ff", dark: "#0a7f99", glow: "#9af3ff" },
  { name: "lime", main: "#7dff4a", dark: "#2f9a14", glow: "#c4ff9f" },
  { name: "amber", main: "#ffc23a", dark: "#a8700a", glow: "#ffe39a" },
  { name: "violet", main: "#b26bff", dark: "#5b23a8", glow: "#dcb6ff" },
  { name: "magenta", main: "#ff4fd8", dark: "#a01585", glow: "#ffaaf0" },
];

export const BAYS = 5;

/** Shots a ship carries, by its length in cells. */
export const AMMO = { 2: 3, 3: 4, 4: 6 };

/** Bays a player can open with the +1 bay booster, on top of BAYS. */
export const EXTRA_BAYS = 1;

/** Tension within every block of 5 sectors: build up over four, then one to breathe. */
const CYCLE = [0, 0.05, 0.1, 0.18, -0.08];

/**
 * The difficulty curve. Growth t = 1 - e^(-(n-1)/18) rises fast early and flattens out (t ≈ 0.4 at
 * sector 10, 0.65 at 20, 0.9 at 40), so new players climb quickly and veterans meet a steady ceiling.
 * On top of it, e = t + the 5-sector cycle (+0.25 on every 10th, boss, sector) sets everything that may
 * swing from one sector to the next; the grid and colors follow t alone so the board never shrinks back.
 */
export function difficulty(n) {
  const t = 1 - Math.exp(-(n - 1) / 18);
  const e = Math.min(1, Math.max(0, t + CYCLE[(n - 1) % CYCLE.length] + (n % 10 === 0 ? 0.25 : 0)));
  return { t, e };
}

/** How a sector number turns into grid size, colors, rocket count and pressure. */
export function levelConfig(n) {
  const { t, e } = difficulty(n);
  // A dense hangar from the first sector (about 60 rockets), growing to about 75.
  const cols = 12 + Math.round(t); // 12..13
  const rows = 15 + Math.round(t); // 15..16
  return {
    level: n,
    t,
    e,
    cols,
    rows,
    colors: Math.min(COLORS.length, 3 + Math.floor(6 * t)),
    // Share of the hangar covered by rockets: 72% at the start, up to 76% (about the most a grid this size
    // holds while every rocket still has some launch order that frees it).
    fill: 0.72 + 0.04 * e,
    // Never fewer rockets than this (about 60 at the start, 66 on the biggest hangar).
    minShips: Math.round(60 + 6 * t),
    // Share of rockets that start blocked.
    blockTarget: 0.25 + 0.3 * e,
    // How strongly placement prefers spots that block rockets already placed: builds launch-order chains.
    chainBias: 0.1 + 0.8 * e,
    // Long cruisers (4 cells, 6 shots) are rare; 3-cell rockets get rarer as sectors get harder, so the
    // same hangar holds more rockets.
    cruisers: 0.02 + 0.04 * e,
    longShare: 0.16 - 0.06 * e,
    bays: BAYS,
    // The most bays the intended solution needs at once: the rest is the player's room for mistakes.
    solutionBays: e < 0.3 ? 2 : e < 0.7 ? 3 : 4,
    // Expected thinking time per rocket (seconds); sets how fast the wave closes in (see generateLevel).
    secondsPerShip: 3.2 - 1.4 * e,
    // Warp storms: after this many launches the hangar's colors shuffle (none in sectors 1-2).
    stormEvery: n <= 2 ? 0 : Math.round(12 - 5 * e),
    boss: n % 10 === 0,
  };
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shipCells(ship) {
  const horizontal = ship.dir === "left" || ship.dir === "right";
  const cells = [];
  for (let i = 0; i < ship.len; i++) cells.push(horizontal ? [ship.x + i, ship.y] : [ship.x, ship.y + i]);
  return cells;
}

/** Cells from just past the ship's nose to the grid edge, nearest first. */
export function exitPath(ship, cols, rows) {
  const [dx, dy] = DIRS[ship.dir];
  const cells = shipCells(ship);
  let [x, y] = dx + dy > 0 ? cells[cells.length - 1] : cells[0];
  const path = [];
  for (x += dx, y += dy; x >= 0 && y >= 0 && x < cols && y < rows; x += dx, y += dy) path.push([x, y]);
  return path;
}

/** Grid of ship ids (-1 = empty) for the ships still in the hangar. */
export function occupancy(ships, cols, rows) {
  const occ = Array.from({ length: rows }, () => new Array(cols).fill(-1));
  for (const s of ships) for (const [x, y] of shipCells(s)) occ[y][x] = s.id;
  return occ;
}

/** The first ship in the way of `ship`'s exit, as { id, distance in cells }, or null when the way is clear. */
export function blocker(ship, occ, cols, rows) {
  const path = exitPath(ship, cols, rows);
  for (let i = 0; i < path.length; i++) {
    const id = occ[path[i][1]][path[i][0]];
    if (id !== -1 && id !== ship.id) return { id, distance: i };
  }
  return null;
}

/** Which bay fires at an enemy of `color`: the matching ship with the fewest shots left, so bays free up soonest. */
export function pickShooter(bays, color) {
  let best = -1;
  for (let i = 0; i < bays.length; i++) {
    const b = bays[i];
    if (!b || !b.ready || b.ammo <= 0 || b.color !== color) continue;
    if (best === -1 || b.ammo < bays[best].ammo) best = i;
  }
  return best;
}

/**
 * Plays `order` (ship ids, launched one after another as soon as a bay is free) against the wave.
 * `start` optionally gives what already sits in the bays ({ color, ammo } or null each).
 * Returns { ok, peak } where peak is the most bays in use at once.
 */
export function simulate(ships, queue, order, bayCount, start = null) {
  const byId = new Map(ships.map((s) => [s.id, s]));
  const bays = new Array(bayCount).fill(null);
  if (start) start.forEach((b, i) => (bays[i] = b && b.ammo > 0 ? { color: b.color, ammo: b.ammo, ready: true } : null));
  let q = 0;
  let next = 0;
  let peak = 0;
  for (;;) {
    while (q < queue.length) {
      const i = pickShooter(bays, queue[q]);
      if (i === -1) break;
      bays[i].ammo--;
      q++;
      if (bays[i].ammo === 0) bays[i] = null;
    }
    if (q === queue.length) return { ok: true, peak };
    const free = bays.indexOf(null);
    if (free === -1 || next >= order.length) return { ok: false, peak };
    const s = byId.get(order[next++]);
    bays[free] = { color: s.color, ammo: s.cap, ready: true };
    peak = Math.max(peak, bays.filter(Boolean).length);
  }
}

/** True when every ship in `order` can leave the hangar at its turn. */
export function orderClears(ships, order, cols, rows) {
  let left = ships.slice();
  for (const id of order) {
    const occ = occupancy(left, cols, rows);
    const s = left.find((t) => t.id === id);
    if (!s || blocker(s, occ, cols, rows)) return false;
    left = left.filter((t) => t.id !== id);
  }
  return left.length === 0;
}


const DIR_WEIGHTS = { up: 0.4, left: 0.2, right: 0.2, down: 0.2 };

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Every way a rocket of length 2, 3 (and 4 when cruisers fly) fits on the grid. */
function allPlacements(cfg) {
  const { cols, rows } = cfg;
  const out = [];
  for (const len of cfg.cruisers > 0 ? [2, 3, 4] : [2, 3])
    for (const dir of Object.keys(DIRS)) {
      const horizontal = dir === "left" || dir === "right";
      for (let y = 0; y < rows - (horizontal ? 0 : len - 1); y++)
        for (let x = 0; x < cols - (horizontal ? len - 1 : 0); x++) {
          const p = { x, y, len, dir };
          p.cells = shipCells(p);
          p.path = exitPath(p, cols, rows);
          out.push(p);
        }
    }
  return out;
}

/** The rocket that most quickly covers the wave's front: free to launch, color needed soonest. Null if none. */
export function radarHint(ships, queue, q, bays, cols, rows) {
  const occ = occupancy(ships, cols, rows);
  const free = ships.filter((s) => !blocker(s, occ, cols, rows));
  const covered = new Set(bays.filter((b) => b && b.ammo > 0).map((b) => b.color));
  const seen = new Set();
  for (let k = q; k < queue.length; k++) {
    const c = queue[k];
    if (covered.has(c) || seen.has(c)) continue;
    seen.add(c);
    const match = free.filter((s) => s.color === c).sort((a, b) => b.cap - a.cap);
    if (match.length) return match[0];
  }
  return free[0] || null;
}

/**
 * The wave for launching `order`: each rocket's shots (after whatever already sits in `start` bays) in launch
 * order, split in pairs, then mixed up as long as that order still clears it within `bayCount` bays. Mixing
 * is what makes the launch order matter. Returns the wave (colors), or null if even the unmixed one fails.
 */
function buildWave(ships, order, bayCount, rng, passesPerChunk, start = null) {
  const byId = new Map(ships.map((s) => [s.id, s]));
  let chunks = [];
  const add = (color, shots) => {
    for (let left = shots; left > 0; left -= 2) chunks.push({ color, n: Math.min(2, left) });
  };
  for (const b of start || []) if (b && b.ammo > 0) add(b.color, b.ammo);
  for (const id of order) add(byId.get(id).color, byId.get(id).cap);
  const flat = (cs) => cs.flatMap((c) => new Array(c.n).fill(c.color));
  const passes = Math.round(chunks.length * passesPerChunk);
  for (let p = 0; p < passes; p++) {
    const i = Math.floor(rng() * (chunks.length - 1));
    if (chunks[i].color === chunks[i + 1].color) continue;
    const swapped = chunks.slice();
    [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
    if (simulate(ships, flat(swapped), order, bayCount, start).ok) chunks = swapped;
  }
  const queue = flat(chunks);
  return simulate(ships, queue, order, bayCount, start).ok ? queue : null;
}

function tryGenerate(cfg, rng, placements) {
  const { cols, rows } = cfg;
  const ships = [];
  const occ = Array.from({ length: rows }, () => new Array(cols).fill(-1));
  // pathHits[y][x]: how many placed rockets would have to fly through this cell to leave.
  const pathHits = Array.from({ length: rows }, () => new Array(cols).fill(0));
  const target = cfg.fill * cols * rows;
  let covered = 0;
  // Placements only ever become invalid (cells fill up), so the live list just shrinks.
  let live = placements;
  // Each new rocket needs a clear way out past the rockets already placed, but may sit in their way:
  // launching in reverse placement order always works, and earlier rockets end up blocked.
  while (covered < target) {
    live = live.filter(
      (p) => p.cells.every(([x, y]) => occ[y][x] === -1) && p.path.every(([x, y]) => occ[y][x] === -1),
    );
    const valid = live;
    if (!valid.length) break;
    const roll = rng();
    const len = roll < cfg.cruisers ? 4 : roll < cfg.cruisers + cfg.longShare ? 3 : 2;
    let pool = valid.filter((p) => p.len === len);
    if (!pool.length) pool = valid;
    // Chain bias: prefer the spots that block the most rockets already placed.
    if (rng() < cfg.chainBias) {
      const scored = pool.map((p) => [p, p.cells.reduce((sum, [x, y]) => sum + pathHits[y][x], 0)]);
      const best = Math.max(...scored.map(([, s]) => s));
      if (best > 0) pool = scored.filter(([, s]) => s >= best * 0.5).map(([p]) => p);
    }
    // Direction weights (more rockets point up, toward the bays).
    let r = rng() * pool.reduce((sum, p) => sum + DIR_WEIGHTS[p.dir], 0);
    let pick = pool[pool.length - 1];
    for (const p of pool) if ((r -= DIR_WEIGHTS[p.dir]) < 0) { pick = p; break; }
    const ship = { id: ships.length, x: pick.x, y: pick.y, len: pick.len, dir: pick.dir, color: 0, cap: AMMO[pick.len] };
    for (const [x, y] of pick.cells) occ[y][x] = ship.id;
    for (const [x, y] of pick.path) pathHits[y][x]++;
    covered += pick.len;
    ships.push(ship);
  }
  if (covered < target * 0.9 || ships.length < cfg.minShips) return null;

  // A sector where most rockets can leave right away is no puzzle.
  const startOcc = occupancy(ships, cols, rows);
  const blocked = ships.filter((s) => blocker(s, startOcc, cols, rows)).length;
  if (blocked < ships.length * cfg.blockTarget) return null;

  // Every color used, as evenly as possible, in a random spread.
  const palette = shuffle([...Array(COLORS.length).keys()], rng).slice(0, cfg.colors);
  const colorOf = shuffle(ships.map((_, i) => palette[i % palette.length]), rng);
  ships.forEach((s, i) => (s.color = colorOf[i]));

  const order = ships.map((s) => s.id).reverse();

  const queue = buildWave(ships, order, cfg.solutionBays, rng, Math.round(1 + 3 * cfg.e));
  if (!queue) return null;
  return { ships, queue, order };
}

/** A sector is the same every time for the same number (seeded), and always has a solution. */
export function generateLevel(n) {
  const base = levelConfig(n);
  const placements = allPlacements(base);
  for (let attempt = 0; attempt < 300; attempt++) {
    // If a strict target keeps failing, relax it a little every 50 attempts.
    const relax = Math.floor(attempt / 50) * 0.05;
    const cfg = {
      ...base,
      fill: base.fill - relax,
      blockTarget: Math.max(0, base.blockTarget - relax),
      minShips: base.minShips - Math.round(relax * 40),
    };
    const made = tryGenerate(cfg, mulberry32(n * 7919 + attempt * 104729 + 17), placements);
    if (!made) continue;
    const shots = made.queue.length;
    // Wave pressure (0 = far, 1 = at the shield). Kills push it back 0.6 in total; closing in adds 1.45
    // over the expected play time (rockets × seconds per rocket). A player at that pace ends near 0.85.
    const pushback = 0.6 / shots;
    const creep = n <= 2 ? 0 : 1.45 / (made.ships.length * base.secondsPerShip);
    return { cfg: { ...base, pushback, creep }, ...made };
  }
  throw new Error(`could not build sector ${n}`);
}

/** The first `k` distinct colors the wave needs that no bay is already covering. */
function neededColors(queue, bays, k) {
  const covered = new Set(bays.filter((b) => b && b.ammo > 0).map((b) => b.color));
  const out = [];
  for (const c of queue) {
    if (out.length >= k) break;
    if (!covered.has(c) && !out.includes(c)) out.push(c);
  }
  return out;
}

/**
 * A warp storm. The rockets still in the hangar swap colors, only between rockets of the same length, so each
 * color keeps the same number of shots; then the rest of the wave is re-formed for the new colors (same
 * saucers per color) so the sector can still be cleared from the current bays (`bays`: the open bays as
 * { color, ammo } or null) using at most `budget` of them. `helpful` (the Shuffle booster) tries several
 * storms and keeps the one that leaves the most free rockets in the colors the new wave needs first.
 * Returns { colors: Map id → color, queue: the new rest of the wave }, or null if no storm fits.
 */
export function warpStorm(ships, bays, cols, rows, rng, { helpful = false, budget = bays.length } = {}) {
  if (ships.length < 2) return null;
  const order = ships.map((s) => s.id).sort((a, b) => b - a);
  const occ = occupancy(ships, cols, rows);
  const free = new Set(ships.filter((s) => !blocker(s, occ, cols, rows)).map((s) => s.id));
  const byLen = new Map();
  for (const s of ships) byLen.set(s.len, [...(byLen.get(s.len) || []), s]);
  const bayCount = Math.max(1, Math.min(bays.length, budget));
  let best = null;
  let bestScore = -1;
  for (let t = 0; t < (helpful ? 6 : 3); t++) {
    const colors = new Map();
    for (const group of byLen.values()) {
      const pool = shuffle(group.map((s) => s.color), rng);
      group.forEach((s, i) => colors.set(s.id, pool[i]));
    }
    const recolored = ships.map((s) => ({ ...s, color: colors.get(s.id) }));
    // The docked rockets keep their bay; the budget counts them, so the storm never assumes extra room.
    const room = Math.min(bays.length, Math.max(bayCount, bays.filter(Boolean).length + 1));
    const queue = buildWave(recolored, order, room, rng, 2, bays);
    if (!queue) continue;
    const result = { colors, queue };
    if (!helpful) return result;
    const need = neededColors(queue, bays, 3);
    const score = recolored.reduce((sum, s) => {
      const i = need.indexOf(s.color);
      return sum + (free.has(s.id) && i !== -1 ? 3 - i : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      best = result;
    }
  }
  return best;
}
