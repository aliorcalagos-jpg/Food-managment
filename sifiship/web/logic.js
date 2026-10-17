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
export const AMMO = { 2: 4, 3: 6 };

/** How a level number turns into grid size, colors, ship count and how fast the wave closes in. */
export function levelConfig(n) {
  const cols = n <= 2 ? 5 : n <= 6 ? 6 : 7;
  const rows = n <= 2 ? 6 : n <= 6 ? 8 : 9;
  const colors = Math.min(COLORS.length, 2 + Math.floor((n + 1) / 2));
  const maxShips = Math.floor((cols * rows * 0.78) / 2.35);
  const ships = Math.min(maxShips, 5 + Math.round(n * 1.4));
  return {
    level: n,
    cols,
    rows,
    colors,
    ships,
    bays: BAYS,
    // The most bays the intended solution needs at once: the rest is the player's room for mistakes.
    solutionBays: n <= 3 ? 2 : n <= 12 ? 3 : 4,
    // Wave pressure (0 = far away, 1 = touching the shield), per second; each kill pushes it back.
    creep: n <= 2 ? 0 : Math.min(0.03, 0.007 + 0.0016 * n),
    pushback: 0.012,
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
 * Returns { ok, peak } where peak is the most bays in use at once.
 */
export function simulate(ships, queue, order, bayCount) {
  const byId = new Map(ships.map((s) => [s.id, s]));
  const bays = new Array(bayCount).fill(null);
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

const DIR_WEIGHTS = [
  ["up", 0.4],
  ["left", 0.2],
  ["right", 0.2],
  ["down", 0.2],
];

function pickDir(rng) {
  let r = rng();
  for (const [d, w] of DIR_WEIGHTS) if ((r -= w) < 0) return d;
  return "up";
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function tryGenerate(cfg, rng) {
  const { cols, rows } = cfg;
  const ships = [];
  const occ = Array.from({ length: rows }, () => new Array(cols).fill(-1));
  // Each new ship must have a clear way out past the ships already placed, but may sit in their way.
  // So launching in reverse placement order always works, and earlier ships end up blocked.
  for (let tries = 0; tries < 3000 && ships.length < cfg.ships; tries++) {
    const len = rng() < (cfg.level <= 2 ? 0.2 : 0.35) ? 3 : 2;
    const dir = pickDir(rng);
    const horizontal = dir === "left" || dir === "right";
    const x = Math.floor(rng() * (cols - (horizontal ? len - 1 : 0)));
    const y = Math.floor(rng() * (rows - (horizontal ? 0 : len - 1)));
    const ship = { id: ships.length, x, y, len, dir, color: 0, cap: AMMO[len] };
    const cells = shipCells(ship);
    if (cells.some(([cx, cy]) => occ[cy][cx] !== -1)) continue;
    if (exitPath(ship, cols, rows).some(([cx, cy]) => occ[cy][cx] !== -1)) continue;
    for (const [cx, cy] of cells) occ[cy][cx] = ship.id;
    ships.push(ship);
  }
  if (ships.length < cfg.ships - 2) return null;

  // Every color used, roughly evenly, in a random spread.
  const palette = shuffle([...Array(COLORS.length).keys()], rng).slice(0, cfg.colors);
  const colorOf = shuffle(ships.map((_, i) => palette[i % palette.length]), rng);
  ships.forEach((s, i) => (s.color = colorOf[i]));

  const order = ships.map((s) => s.id).reverse();

  // A level where most ships can leave right away is no puzzle.
  const startOcc = occupancy(ships, cols, rows);
  const blocked = ships.filter((s) => blocker(s, startOcc, cols, rows)).length;
  if (cfg.level >= 3 && blocked < ships.length * 0.4) return null;

  // The wave: each ship's shots in launch order, split in pairs, then mixed up as long as the intended
  // order still clears it within `solutionBays`. Mixing is what makes the launch order matter.
  let chunks = [];
  for (const id of order) {
    const s = ships[id];
    for (let left = s.cap; left > 0; left -= 2) chunks.push({ color: s.color, n: Math.min(2, left) });
  }
  const flat = (cs) => cs.flatMap((c) => new Array(c.n).fill(c.color));
  const passes = chunks.length * (cfg.level <= 2 ? 1 : 3);
  for (let p = 0; p < passes; p++) {
    const i = Math.floor(rng() * (chunks.length - 1));
    if (chunks[i].color === chunks[i + 1].color) continue;
    const swapped = chunks.slice();
    [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
    if (simulate(ships, flat(swapped), order, cfg.solutionBays).ok) chunks = swapped;
  }
  const queue = flat(chunks);
  const check = simulate(ships, queue, order, cfg.solutionBays);
  if (!check.ok) return null;
  return { ships, queue, order };
}

/** A level is the same every time for the same number (seeded), and always has a solution. */
export function generateLevel(n) {
  const cfg = levelConfig(n);
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = mulberry32(n * 7919 + attempt * 104729 + 17);
    const made = tryGenerate(cfg, rng);
    if (made) return { cfg, ...made };
  }
  throw new Error(`could not build level ${n}`);
}
