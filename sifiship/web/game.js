// SIFIship: game loop, motion, drawing, input and screens. Rules: logic.js. Progression: progress.js.
// Sprites: render.js. Sound: audio.js.
import { COLORS, DIRS, BAYS, EXTRA_BAYS, generateLevel, occupancy, blocker, pickShooter, radarHint, warpStorm } from "./logic.js";
import { SKINS, xpToNext, addXp, winXp, lossXp, rankFor, levelRewards, nextUnlock, streakMultiplier } from "./progress.js";
import { setDpr, shipSprite, shadowSprite, glowSprite, saucerSprite, padSprite, hangarTexture, backdrop, drawSprite, rgba } from "./render.js";
import { sfx, buzz, initAudio, bindSettings } from "./audio.js";

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const $ = (id) => document.getElementById(id);

const FIRE_EVERY = 0.06; // seconds between shots
const COMBO_WINDOW = 1.2; // seconds between kills that keep a combo going
const CHAIN_WINDOW = 0.9; // seconds between launches that count as a chain launch
const HULL_DAMAGE = 14; // shield points per second while the wave touches it
const GRACE = 4; // seconds before the wave starts closing in
const HEAD = "Orbitron, 'Exo 2', system-ui, sans-serif";

// ---------- easing ----------
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOutCubic = (k) => 1 - Math.pow(1 - k, 3);
const easeInQuad = (k) => k * k;
const easeOutBack = (k, s = 1.8) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
const lerp = (a, b, k) => a + (b - a) * k;
function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

// ---------- saved progress (per phone) ----------
const SAVE_KEY = "sifiship.v1";
const defaults = {
  level: 1,
  best: 0,
  stars: {},
  sound: true,
  vibrate: true,
  boost: { bay: 2, undo: 3, radar: 3, shuffle: 2 },
  pilot: { level: 1, xp: 0 },
  skin: "interceptor",
  streak: 0,
};
let save = { ...defaults };
try {
  const stored = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
  save = { ...defaults, ...stored, boost: { ...defaults.boost, ...(stored.boost || {}) } };
  // V.2 players had stars but no pilot level: credit their stars as XP once.
  if (!stored.pilot) {
    const total = Object.values(save.stars).reduce((a, b) => a + b, 0);
    const { level, xp } = addXp(defaults.pilot, total * 60);
    save.pilot = { level, xp };
  }
} catch {
  /* private mode or bad data: start fresh */
}
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* storage unavailable: progress lasts this session only */
  }
}
bindSettings(save);
const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0);

// ---------- layout ----------
const L = {};
function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  setDpr(dpr);
  L.dpr = dpr;
  L.W = window.innerWidth;
  L.H = window.innerHeight;
  canvas.width = Math.round(L.W * dpr);
  canvas.height = Math.round(L.H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  L.hudH = 66;
  L.enemyTop = L.hudH + 4;
  // The enemy zone is kept slim (10% of the height, 60-104 px) so the hangar gets the room.
  L.shieldY = L.enemyTop + Math.min(104, Math.max(60, L.H * 0.1));
  L.slots = BAYS + EXTRA_BAYS;
  L.bayGap = 6;
  L.bayW = Math.min((L.W - 28 - (L.slots - 1) * L.bayGap) / L.slots, 54);
  L.bayH = L.bayW * 1.08;
  L.bayTop = L.shieldY + 8;
  L.bayY = L.bayTop + L.bayH / 2;
  L.gridTop = L.bayTop + L.bayH + 22;
  L.boostH = 66;
  L.perRow = 11;
  L.sx = Math.min((L.W - 24) / L.perRow, 32);
  L.rowH = L.sx * 0.62;
  L.enemyR = L.sx * 0.4;
  if (G.cfg) placeGrid();
  stars.forEach((s) => (s.x = Math.random() * L.W));
}
function placeGrid() {
  const { cols, rows } = G.cfg;
  const frame = 10;
  const availH = L.H - L.gridTop - L.boostH - frame * 2 - 4;
  L.cell = Math.max(14, Math.floor(Math.min((L.W - 8 - frame * 2) / cols, availH / rows)));
  L.gx = Math.round((L.W - L.cell * cols) / 2);
  L.gy = Math.round(L.gridTop + frame + Math.max(0, (availH - L.cell * rows) / 2));
  // Sprite sizes: a rocket in the hangar, and the same rocket on a landing pad.
  L.shipW = L.cell * 0.8;
}
const bayX = (i) => L.W / 2 + (i - (L.slots - 1) / 2) * (L.bayW + L.bayGap);
const gridLen = (s) => s.len * L.cell - L.cell * 0.12;
const padLen = (s) => L.bayH * (0.74 + 0.06 * (s.len - 2));
const padWid = () => L.bayW * 0.56;

// ---------- game state ----------
const G = { phase: "menu", t: 0 };
const fx = { particles: [], beams: [], rings: [], texts: [], flashes: [], warps: [], shake: 0, flash: 0 };
const levelCache = new Map();
function getLevel(n) {
  if (!levelCache.has(n)) levelCache.set(n, generateLevel(n));
  return levelCache.get(n);
}

function startLevel(n) {
  const lv = getLevel(n);
  levelCache.delete(n - 1);
  G.n = n;
  G.cfg = lv.cfg;
  G.ships = lv.ships.map((s) => ({
    ...s,
    state: "grid",
    anim: null,
    flash: 0,
    wob: 0,
    trail: [],
    // Deploy: rockets drop into the hangar row by row when the sector opens.
    deploy: (s.y / lv.cfg.rows) * 0.5 + Math.random() * 0.12,
  }));
  G.queue = lv.queue;
  G.solution = lv.order;
  G.q = 0;
  G.qAnim = 0;
  G.bays = new Array(lv.cfg.bays).fill(null);
  G.hull = 100;
  G.threat = 0;
  G.score = 0;
  G.streak = 0;
  G.mult = 1;
  G.maxMult = 1;
  G.lastKill = -9;
  G.chain = 0;
  G.lastLaunch = -9;
  G.peak = 0;
  G.fireTimer = 0;
  G.jamTimer = 0;
  G.alarmTimer = 0;
  G.endTimer = 0;
  G.playTime = 0;
  G.alert = false;
  G.result = null;
  G.start = G.t;
  G.lastTap = G.t;
  G.launched = [];
  G.launches = 0;
  G.hintId = -1;
  G.hintUntil = 0;
  G.pendingLoss = false;
  G.golds = 0;
  G.storms = 0;
  G.stormLeft = lv.cfg.stormEvery;
  G.stormAt = 0;
  G.stormUntil = 0;
  G.waveFlip = null;
  refreshOcc();
  placeGrid();
  pickGold();
  for (const k of Object.keys(fx)) if (Array.isArray(fx[k])) fx[k] = [];
  G.phase = "play";
  showOnly(null);
  syncBoosts();
  sfx.launch();
}

function refreshOcc() {
  G.occ = occupancy(
    G.ships.filter((s) => s.state === "grid" || s.state === "bounce"),
    G.cfg.cols,
    G.cfg.rows,
  );
}
const inHangar = () => G.ships.filter((s) => s.state === "grid" || s.state === "bounce" || s.state === "press").length;

// ---------- geometry ----------
const dirAngle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
function shipCenter(s) {
  const horizontal = s.dir === "left" || s.dir === "right";
  const w = horizontal ? s.len : 1;
  const h = horizontal ? 1 : s.len;
  return [L.gx + (s.x + w / 2) * L.cell, L.gy + (s.y + h / 2) * L.cell];
}
function enemySlotPos(slot) {
  const frontY = L.shieldY - 10 - (1 - G.threat) * L.rowH * 1.1;
  const at = (k) => {
    const r = Math.floor(k / L.perRow);
    const c = k % L.perRow;
    const col = r % 2 === 0 ? c : L.perRow - 1 - c;
    return [L.W / 2 + (col - (L.perRow - 1) / 2) * L.sx, frontY - r * L.rowH];
  };
  const k = Math.floor(slot);
  const f = slot - k;
  const a = at(Math.max(0, k));
  if (f === 0) return a;
  const b = at(k + 1);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

// ---------- effects ----------
function sparks(x, y, color, n = 12, speed = 220) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random());
    fx.particles.push({ kind: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.25 + Math.random() * 0.35, color });
  }
}
function debris(x, y, color, n = 6, speed = 140) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random());
    fx.particles.push({
      kind: "debris", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.5 + Math.random() * 0.4, color,
      size: 2 + Math.random() * 3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18,
    });
  }
}
function flashAt(x, y, color, r, life = 0.25) {
  fx.flashes.push({ x, y, color, r, t: 0, life });
}
function ring(x, y, color, maxR = 40, life = 0.4, width = 2.5) {
  fx.rings.push({ x, y, color, t: 0, maxR, life, width });
}
/** Floating text; a `key` replaces the previous text with that key instead of stacking on it. */
function floatText(text, x, y, color = "#fff", size = 22, life = 1, key = null) {
  const margin = Math.min(L.W / 2, text.length * size * 0.42);
  if (key) fx.texts = fx.texts.filter((t) => t.key !== key);
  fx.texts.push({ text, x: Math.max(margin, Math.min(L.W - margin, x)), y, color, size, t: 0, life, key });
}
function explode(x, y, colorIndex, big = false) {
  const c = COLORS[colorIndex];
  flashAt(x, y, c.main, L.enemyR * (big ? 4 : 2.6), 0.3);
  ring(x, y, c.glow, L.enemyR * (big ? 4 : 2.2), 0.35, 2);
  sparks(x, y, c.glow, big ? 26 : 10, big ? 320 : 200);
  debris(x, y, c.main, big ? 14 : 5);
}

// ---------- input ----------
canvas.addEventListener("pointerdown", (e) => {
  if (G.phase !== "play") return;
  initAudio();
  const lx = bayX(L.slots - 1);
  if (G.bays.length < L.slots && Math.abs(e.clientX - lx) < L.bayW / 2 && Math.abs(e.clientY - L.bayY) < L.bayH / 2) {
    spendBoost("bay");
    return;
  }
  const id = shipAt(e.clientX, e.clientY);
  if (id !== -1) tapShip(id);
});

/** The rocket under a touch; a touch on an empty cell picks the nearest rocket within ~0.7 cell. */
function shipAt(px, py) {
  const cx = Math.floor((px - L.gx) / L.cell);
  const cy = Math.floor((py - L.gy) / L.cell);
  const inGrid = (x, y) => x >= 0 && y >= 0 && x < G.cfg.cols && y < G.cfg.rows;
  if (inGrid(cx, cy) && G.occ[cy][cx] !== -1) return G.occ[cy][cx];
  let best = -1;
  let bestD = L.cell * 0.7;
  for (let y = cy - 1; y <= cy + 1; y++)
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (!inGrid(x, y) || G.occ[y][x] === -1) continue;
      const d = Math.hypot(px - (L.gx + (x + 0.5) * L.cell), py - (L.gy + (y + 0.5) * L.cell));
      if (d < bestD) {
        bestD = d;
        best = G.occ[y][x];
      }
    }
  return best;
}

function tapShip(id) {
  const s = G.ships[id];
  if (!s || s.state !== "grid" || G.t - G.start < 0.35 || G.t < G.stormUntil) return false;
  G.lastTap = G.t;
  const block = blocker(s, G.occ, G.cfg.cols, G.cfg.rows);
  if (block) {
    s.state = "bounce";
    s.anim = { t: 0, dist: block.distance * L.cell + L.cell * 0.22, hit: false, blocker: block.id };
    sfx.press();
    return false;
  }
  const bay = G.bays.indexOf(null);
  if (bay === -1) {
    sfx.error();
    buzz("long");
    fx.shake = Math.max(fx.shake, 5);
    floatText("PADS FULL", L.W / 2, L.bayY, "#ff3b5c", 20, 0.9, "full");
    G.bayShake = 0.35;
    return false;
  }
  G.bays[bay] = { ship: id, color: s.color, ammo: s.cap, ready: false, recoil: 0, ang: -Math.PI / 2, aimUntil: 0, pop: 0 };
  G.peak = Math.max(G.peak, G.bays.filter(Boolean).length);
  // Anticipation: a quick squash before the burn.
  s.state = "press";
  s.anim = { t: 0, bay };
  refreshOcc();
  G.launched.push(id);
  G.launches++;
  G.hintId = -1;
  sfx.press();
  buzz("tick");
  if (s.gold) {
    s.gold = false;
    G.golds++;
    G.score += 500;
    const [x, y] = shipCenter(s);
    floatText("GOLDEN +500", x, y - 26, "#ffd75a", 22, 1.2, "gold");
    sparks(x, y, "#ffd75a", 26, 260);
    ring(x, y, "#ffd75a", L.cell * 2.4, 0.5, 3);
    sfx.gold();
    buzz("long");
  }
  // The storm strikes shortly after the launch that charges it; launches meanwhile do not push it back.
  if (G.cfg.stormEvery > 0 && !G.stormAt && --G.stormLeft <= 0) G.stormAt = G.t + 0.45;
  if (G.t - G.lastLaunch < CHAIN_WINDOW) {
    G.chain++;
    const [x, y] = shipCenter(s);
    floatText(`CHAIN x${G.chain}`, x, y - 20, "#ffc23a", 16 + Math.min(G.chain, 8) * 2, 0.9, "chain");
    G.score += 25 * G.chain;
  } else G.chain = 1;
  G.lastLaunch = G.t;
  return true;
}

// ---------- boosters ----------
const BOOSTS = {
  bay: { label: "Extra pad", icon: "⊕" },
  undo: { label: "Undo", icon: "↶" },
  shuffle: { label: "Shuffle", icon: "⇄" },
  radar: { label: "Radar", icon: "◎" },
};
function canBoost(kind) {
  if (G.phase !== "play" || save.boost[kind] <= 0) return false;
  if (kind === "bay") return G.bays.length < L.slots;
  if (kind === "undo") return undoTarget() !== -1;
  if (kind === "radar") return inHangar() > 0;
  if (kind === "shuffle") return inHangar() >= 2 && G.t >= G.stormUntil && !G.stormAt;
  return false;
}
/** The last launched rocket that is docked and has not fired yet (it can go back to the hangar). */
function undoTarget() {
  for (let k = G.launched.length - 1; k >= 0; k--) {
    const id = G.launched[k];
    const i = G.bays.findIndex((b) => b && b.ship === id);
    if (i === -1) continue;
    const b = G.bays[i];
    return b.ready && b.ammo === G.ships[id].cap ? i : -1;
  }
  return -1;
}
function spendBoost(kind) {
  if (!canBoost(kind)) {
    sfx.error();
    return false;
  }
  save.boost[kind]--;
  persist();
  if (kind === "bay") {
    G.bays.push(null);
    const x = bayX(G.bays.length - 1);
    ring(x, L.bayY, "#ffc23a", L.bayW, 0.5, 3);
    sparks(x, L.bayY, "#ffc23a", 24, 220);
    floatText("PAD ONLINE", x, L.bayY - L.bayH * 0.75, "#ffc23a", 16, 1);
  } else if (kind === "undo") {
    const i = undoTarget();
    const s = G.ships[G.bays[i].ship];
    G.bays[i] = null;
    G.launched.splice(G.launched.lastIndexOf(s.id), 1);
    s.state = "grid";
    s.deploy = 0;
    s.wob = 0.4;
    refreshOcc();
    const [x, y] = shipCenter(s);
    ring(x, y, COLORS[s.color].glow, L.cell * s.len * 0.7, 0.45);
    flashAt(bayX(i), L.bayY, "#ffffff", L.bayW * 0.8);
  } else if (kind === "shuffle") {
    if (!runStorm(true)) {
      save.boost.shuffle++; // nothing valid to shuffle into: give it back
      persist();
      floatText("NO BETTER SHUFFLE", L.W / 2, L.gy - 16, "#8fa3d4", 14, 1);
    }
  } else if (kind === "radar") {
    const hint = radarHint(G.ships.filter((s) => s.state === "grid"), G.queue, G.q, G.bays, G.cfg.cols, G.cfg.rows);
    G.hintId = hint ? hint.id : -1;
    G.hintUntil = G.t + 4;
  }
  sfx.unlock();
  buzz("tick");
  syncBoosts();
  return true;
}
// ---------- warp storms and the golden rocket ----------
/** Marks one rocket golden; blocked ones are preferred, so reaching it takes a plan. */
function pickGold() {
  for (const s of G.ships) s.gold = false;
  const left = G.ships.filter((s) => s.state === "grid");
  if (left.length < 4) return;
  const occ = G.occ;
  const blocked = left.filter((s) => blocker(s, occ, G.cfg.cols, G.cfg.rows));
  const pool = blocked.length ? blocked : left;
  pool[Math.floor(Math.random() * pool.length)].gold = true;
}

/**
 * A warp storm (or the Shuffle booster, `helpful`): rockets in the hangar and the saucers still to come flip to
 * new colors, re-formed so the sector stays winnable from the pads as they are. Returns false if no storm fit.
 */
function runStorm(helpful) {
  const left = G.ships.filter((s) => s.state === "grid" || s.state === "bounce");
  const bays = G.bays.map((b) => (b ? { color: b.color, ammo: b.ammo } : null));
  const budget = Math.min(G.bays.length, G.cfg.solutionBays + 1);
  const storm = warpStorm(left, bays, G.cfg.cols, G.cfg.rows, Math.random, { helpful, budget });
  if (!storm) return false;
  G.storms++;
  const cx = L.gx + (G.cfg.cols * L.cell) / 2;
  const cy = L.gy + (G.cfg.rows * L.cell) / 2;
  for (const s of left) {
    const [x, y] = shipCenter(s);
    // a flip that ripples out from the hangar's center
    s.flip = { t0: G.t + Math.hypot(x - cx, y - cy) / (L.cell * 30), from: s.color };
    s.color = storm.colors.get(s.id);
  }
  G.waveFlip = { t0: G.t, from: G.queue.slice(G.q, G.q + 80), q: G.q };
  G.queue = G.queue.slice(0, G.q).concat(storm.queue);
  G.stormUntil = G.t + 0.75;
  G.stormFx = G.t;
  G.hintId = -1;
  pickGold();
  fx.shake = Math.max(fx.shake, 6);
  fx.texts = fx.texts.filter((t) => t.key !== "chain");
  floatText(helpful ? "SHUFFLE" : "WARP STORM", L.W / 2, cy, helpful ? "#22e4ff" : "#d58bff", 30, 1.2, "storm");
  sfx.storm();
  buzz("long");
  return true;
}

function syncBoosts() {
  for (const kind of Object.keys(BOOSTS)) {
    const el = $("boost-" + kind);
    el.querySelector("b").textContent = save.boost[kind];
    el.classList.toggle("off", !canBoost(kind));
  }
}
for (const kind of Object.keys(BOOSTS))
  $("boost-" + kind).addEventListener("pointerdown", (e) => {
    e.preventDefault();
    initAudio();
    spendBoost(kind);
  });

// ---------- update ----------
function update(dt) {
  G.t += dt;
  updateFx(dt);
  // Only a sector in play (or finishing) moves; every screen on top of it freezes it. (Letting the loop run
  // under the win screen re-detected the cleared wave and replayed the win forever.)
  if (!G.cfg || (G.phase !== "play" && G.phase !== "ending")) return;

  for (const s of G.ships) {
    s.flash = Math.max(0, s.flash - dt);
    s.wob = Math.max(0, s.wob - dt);
    if (s.state === "bounce") updateBounce(s, dt);
    else if (s.state === "press") {
      s.anim.t += dt;
      if (s.anim.t >= 0.08) {
        s.state = "fly";
        s.anim = { t: 0, phase: 1, off: 0, v: L.cell * 7, bay: s.anim.bay };
        sfx.launch();
      }
    } else if (s.state === "fly") updateFlight(s, dt);
    else if (s.state === "dock") {
      s.anim.t += dt;
      if (s.anim.t >= 0.3) s.state = "bay";
    }
  }
  for (const b of G.bays)
    if (b) {
      b.recoil = Math.max(0, b.recoil - dt * 7);
      b.pop = Math.max(0, b.pop - dt * 4);
      const want = G.t < b.aimUntil ? b.aim : -Math.PI / 2;
      b.ang = lerpAngle(b.ang, want, Math.min(1, dt * 16));
    }
  G.bayShake = Math.max(0, (G.bayShake || 0) - dt);
  G.qAnim += (G.q - G.qAnim) * Math.min(1, dt * 9);
  if (G.waveFlip && G.t - G.waveFlip.t0 > 2) G.waveFlip = null;
  G.boostSync = (G.boostSync || 0) - dt;
  if (G.boostSync <= 0) {
    syncBoosts();
    G.boostSync = 0.2;
  }

  if (G.stormAt && G.t >= G.stormAt && G.phase === "play") {
    G.stormAt = 0;
    G.stormLeft = G.cfg.stormEvery;
    runStorm(false);
  }

  if (G.phase === "ending") {
    G.endTimer -= dt;
    if (G.endTimer <= 0) finish();
    return;
  }
  G.playTime += dt;

  G.fireTimer += dt;
  while (G.fireTimer >= FIRE_EVERY && G.q < G.queue.length) {
    const i = pickShooter(G.bays, G.queue[G.q]);
    if (i === -1) {
      G.fireTimer = 0;
      break;
    }
    G.fireTimer -= FIRE_EVERY;
    kill(i);
  }
  if (G.fireTimer > FIRE_EVERY) G.fireTimer = FIRE_EVERY;
  if (G.t - G.lastKill > COMBO_WINDOW) G.mult = 1;

  if (G.q >= G.queue.length) return end("win");

  if (G.cfg.creep > 0 && G.playTime > GRACE) {
    G.threat = Math.min(1, G.threat + G.cfg.creep * dt);
    if (G.threat >= 1) {
      G.hull -= HULL_DAMAGE * dt;
      fx.shake = Math.max(fx.shake, 3);
      if (Math.random() < dt * 14) {
        const x = L.W / 2 + (Math.random() - 0.5) * L.W * 0.85;
        sparks(x, L.shieldY, "#ff3b5c", 6, 150);
        flashAt(x, L.shieldY, "#ff3b5c", 26, 0.2);
      }
      if (Math.random() < dt * 3) sfx.hit();
      if (G.hull <= 0) {
        G.hull = 0;
        return end("hull");
      }
    }
  }

  const front = G.queue[G.q];
  const allDocked = G.bays.every((b) => b && b.ready);
  const anyFlying = G.ships.some((s) => s.state === "fly" || s.state === "press");
  if (allDocked && !anyFlying && pickShooter(G.bays, front) === -1) {
    G.jamTimer += dt;
    if (G.jamTimer > 0.6) return end("jam");
  } else G.jamTimer = 0;

  const used = G.bays.filter(Boolean).length;
  const frontCovered = G.bays.some((b) => b && b.color === front);
  G.alert = (used >= G.cfg.bays - 1 && !frontCovered) || G.threat > 0.82;
  if (G.alert) {
    G.alarmTimer -= dt;
    if (G.alarmTimer <= 0) {
      sfx.alarm();
      buzz("tick");
      G.alarmTimer = 0.9;
    }
  } else G.alarmTimer = 0;
}

/** Blocked: surge forward to the blocker, hit it (sparks, its wobble), spring back with a small overshoot. */
function updateBounce(s, dt) {
  const a = s.anim;
  a.t += dt;
  if (!a.hit && a.t >= 0.11) {
    a.hit = true;
    const [x, y] = shipCenter(s);
    const [dx, dy] = DIRS[s.dir];
    const nose = gridLen(s) / 2 + a.dist;
    sparks(x + dx * nose, y + dy * nose, "#ffd28a", 10, 160);
    flashAt(x + dx * nose, y + dy * nose, "#ffb347", L.cell * 0.7, 0.18);
    const b = G.ships[a.blocker];
    b.flash = 0.5;
    b.wob = 0.35;
    sfx.thunk();
    buzz("tick");
  }
  if (a.t >= 0.45) {
    s.state = "grid";
    s.anim = null;
  }
}
function bounceOffset(s) {
  const a = s.anim;
  if (a.t < 0.11) return a.dist * easeInQuad(a.t / 0.11);
  const k = clamp01((a.t - 0.11) / 0.34);
  // spring back: 1 → slightly below 0 → 0
  return a.dist * (1 - easeOutBack(k, 2.2));
}

function updateFlight(s, dt) {
  const a = s.anim;
  a.t += dt;
  const pose = flightPose(s);
  s.trail.push([pose.x, pose.y]);
  if (s.trail.length > 16) s.trail.shift();
  if (a.phase === 1) {
    a.v += L.cell * 70 * dt;
    a.off += a.v * dt;
    const [cx, cy] = shipCenter(s);
    const [dx, dy] = DIRS[s.dir];
    const x = cx + dx * a.off;
    const y = cy + dy * a.off;
    const half = gridLen(s) / 2;
    const out = x < L.gx - half || x > L.gx + L.cell * G.cfg.cols + half || y < L.gy - half || y > L.gy + L.cell * G.cfg.rows + half;
    if (out) {
      a.phase = 2;
      a.t = 0;
      a.p0 = [x, y];
      a.c = [x + dx * L.cell * 3, Math.min(y + dy * L.cell * 3, L.bayY + L.bayH) - L.cell * 2];
    }
  } else if (a.t >= 0.42) {
    s.state = "dock";
    s.anim = { t: 0 };
    s.trail = [];
    const bay = G.bays[a.bay];
    bay.ready = true;
    const x = bayX(a.bay);
    ring(x, L.bayY, COLORS[s.color].main, L.bayW * 0.75, 0.4, 3);
    flashAt(x, L.bayY, COLORS[s.color].glow, L.bayW * 0.9, 0.25);
    sparks(x, L.bayY + L.bayH * 0.3, COLORS[s.color].glow, 8, 120);
    sfx.dock();
  }
}

function flightPose(s) {
  const a = s.anim;
  const [cx, cy] = shipCenter(s);
  const [dx, dy] = DIRS[s.dir];
  if (a.phase === 1) return { x: cx + dx * a.off, y: cy + dy * a.off, ang: dirAngle[s.dir], k: 0 };
  const k = clamp01(a.t / 0.42);
  const e = easeOutCubic(k);
  const p2 = [bayX(a.bay), L.bayY];
  const u = 1 - e;
  const x = u * u * a.p0[0] + 2 * u * e * a.c[0] + e * e * p2[0];
  const y = u * u * a.p0[1] + 2 * u * e * a.c[1] + e * e * p2[1];
  // Bank along the curve: heading follows the path's tangent, then settles nose-up on the pad.
  const tx = 2 * u * (a.c[0] - a.p0[0]) + 2 * e * (p2[0] - a.c[0]);
  const ty = 2 * u * (a.c[1] - a.p0[1]) + 2 * e * (p2[1] - a.c[1]);
  const heading = Math.atan2(ty, tx);
  const ang = lerpAngle(heading, -Math.PI / 2, easeInQuad(k));
  return { x, y, ang, k: e };
}

function kill(bayIndex) {
  const b = G.bays[bayIndex];
  const s = G.ships[b.ship];
  const [ex, ey] = enemySlotPos(Math.max(0, G.q - G.qAnim));
  const bx = bayX(bayIndex);
  const by = L.bayY;
  b.aim = Math.atan2(ey - by, ex - bx);
  b.aimUntil = G.t + 0.3;
  const nose = padLen(s) * 0.5;
  const nx = bx + Math.cos(b.ang) * nose;
  const ny = by + Math.sin(b.ang) * nose;
  const c = COLORS[b.color];
  fx.beams.push({ x1: nx, y1: ny, x2: ex, y2: ey, t: 0, color: c.main, glow: c.glow });
  flashAt(nx, ny, c.glow, L.bayW * 0.45, 0.12);
  explode(ex, ey, b.color);
  sfx.pew();
  sfx.boom();
  G.q++;
  G.threat = Math.max(0, G.threat - G.cfg.pushback);
  G.streak = G.t - G.lastKill < COMBO_WINDOW ? G.streak + 1 : 1;
  G.lastKill = G.t;
  const mult = Math.min(5, 1 + Math.floor(G.streak / 8));
  if (mult > G.mult) {
    floatText(`COMBO x${mult}`, L.W / 2, L.shieldY - L.rowH * 2.2, "#ffc23a", 22 + mult * 3, 1, "combo");
    sfx.combo(mult);
    buzz("tick");
  }
  G.mult = mult;
  G.maxMult = Math.max(G.maxMult, mult);
  G.score += 10 * G.mult;
  b.ammo--;
  b.recoil = 1;
  b.pop = 1;
  if (b.ammo <= 0) {
    s.state = "gone";
    fx.warps.push({ x: bx, y: by, color: s.color, len: s.len, t: 0 });
    G.bays[bayIndex] = null;
    sfx.warp();
  }
}

function end(result) {
  G.result = result;
  G.phase = "ending";
  G.endTimer = result === "win" ? 1.3 : 0.9;
  G.alert = false;
  if (result === "win") {
    sfx.win();
    buzz("long");
    for (let i = 0; i < 7; i++)
      setTimeout(() => {
        const x = L.W * (0.15 + Math.random() * 0.7);
        const y = L.enemyTop + 20 + Math.random() * (L.shieldY - L.enemyTop - 20);
        explode(x, y, Math.floor(Math.random() * COLORS.length), true);
        sfx.boom();
      }, i * 130);
  } else {
    sfx.lose();
    buzz("long");
    fx.shake = 14;
    fx.flash = 0.6;
  }
}

// ---------- results, XP and level-ups ----------
let pendingLevels = [];

function grantXp(amount) {
  const before = { ...save.pilot };
  const res = addXp(save.pilot, amount);
  save.pilot = { level: res.level, xp: res.xp };
  for (const lvl of res.gained) {
    const r = levelRewards(lvl);
    for (const [k, v] of Object.entries(r.boost)) save.boost[k] += v;
  }
  pendingLevels = pendingLevels.concat(res.gained);
  persist();
  return { before, after: { ...save.pilot }, gained: res.gained };
}

function finish() {
  if (G.result === "win") {
    const hullOk = G.hull >= 70;
    const baysOk = G.peak <= 3;
    const starsWon = 1 + (hullOk ? 1 : 0) + (baysOk ? 1 : 0);
    const before = save.stars[G.n] || 0;
    save.streak += 1;
    const xp = winXp({ sector: G.n, stars: starsWon, firstClear: !before, boss: G.cfg.boss, maxCombo: G.maxMult, streak: save.streak, golds: G.golds });
    save.stars[G.n] = Math.max(before, starsWon);
    save.level = Math.max(save.level, G.n + 1);
    const best = G.score > save.best;
    save.best = Math.max(save.best, G.score);
    const gain = grantXp(xp.total);
    G.phase = "win";
    showOnly("win");
    $("winTitle").textContent = G.cfg.boss ? "BOSS DESTROYED" : "SECTOR CLEARED";
    const spans = $("stars").children;
    for (let i = 0; i < 3; i++) {
      spans[i].className = "";
      setTimeout(() => {
        if (G.phase !== "win") return;
        spans[i].className = i < starsWon ? "on" : "off";
        if (i < starsWon) {
          sfx.star(i);
          buzz("tick");
        }
      }, 300 + i * 300);
    }
    $("goals").innerHTML =
      `<div class="done">Sector cleared</div>` +
      `<div class="${hullOk ? "done" : ""}">Shield above 70% (${Math.round(G.hull)}%)</div>` +
      `<div class="${baysOk ? "done" : ""}">Never more than 3 pads in use (${G.peak})</div>`;
    countUp($("winScore"), G.score, 900);
    $("winBest").innerHTML = best ? `<span class="badge-new">NEW BEST</span>` : `Best ${save.best.toLocaleString()}`;
    const parts = xp.parts.map((p) => `<span><b>+${p.xp}</b> ${p.label}</span>`);
    if (xp.mult > 1) parts.push(`<span><b>×${xp.mult.toFixed(1)}</b> win streak</span>`);
    $("xpParts").innerHTML = parts.join("");
    [...$("xpParts").children].forEach((el, i) => (el.style.animationDelay = `${1.2 + i * 0.12}s`));
    $("winChips").innerHTML = save.streak > 1 ? `<span class="chip fire">🔥 ${save.streak} WIN STREAK</span>` : "";
    animateXp(gain, xp.total, 1300);
    // Build the next sector while the player reads the results.
    setTimeout(() => {
      if (G.phase === "win" || G.phase === "levelup") getLevel(G.n + 1);
    }, 2600);
  } else {
    G.phase = "lose";
    G.pendingLoss = true;
    showOnly("lose");
    const jam = G.result === "jam";
    $("loseTitle").textContent = jam ? "HANGAR JAMMED" : "SHIELD DOWN";
    const left = G.queue.length - G.q;
    $("loseText").textContent = jam
      ? `Every pad holds a rocket that can't hit the front saucer. ${left} saucers left. Rescue the run, or try again:`
      : `The wave broke through with ${left} saucers left. Keep a rocket firing so the wave stays back.`;
    const xp = lossXp({ sector: G.n, cleared: G.q / G.queue.length });
    $("loseChips").innerHTML =
      `<span class="chip gold">+${xp} XP banked</span>` + (save.streak > 1 ? `<span class="chip fire">🔥 ${save.streak} streak at risk</span>` : "");
    const canBay = jam && G.bays.length < L.slots && save.boost.bay > 0;
    const canUndo = jam && undoTarget() !== -1 && save.boost.undo > 0;
    $("contBay").style.display = canBay ? "" : "none";
    $("contBay").textContent = `⊕ Open pad 6 · ${save.boost.bay} left`;
    $("contUndo").style.display = canUndo ? "" : "none";
    $("contUndo").textContent = `↶ Undo last launch · ${save.boost.undo} left`;
  }
}

/** Leaving a lost sector banks its consolation XP and ends the win streak (a rescue keeps both open). */
function settleLoss() {
  if (!G.pendingLoss) return;
  G.pendingLoss = false;
  save.streak = 0;
  grantXp(lossXp({ sector: G.n, cleared: G.q / G.queue.length }));
}

function continueWith(kind) {
  G.phase = "play";
  G.result = null;
  G.jamTimer = 0;
  G.pendingLoss = false;
  fx.flash = 0;
  showOnly(null);
  spendBoost(kind);
}

function countUp(el, to, ms) {
  const t0 = performance.now();
  let lastTick = 0;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = Math.round(to * easeOutCubic(k)).toLocaleString();
    if (now - lastTick > 50 && k < 1) {
      sfx.tick();
      lastTick = now;
    }
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Fills the XP bar from before to after, rolling over at each level, then opens the level-up screen. */
function animateXp(gain, total, delay) {
  const bar = $("winXpBar");
  const lvlEl = $("winLvl");
  let level = gain.before.level;
  const setLabels = (lv, xp) => {
    lvlEl.textContent = lv;
    $("winRank").textContent = `${rankFor(lv).name} · Lv ${lv}`;
    $("winXpText").textContent = `${Math.round(xp)} / ${xpToNext(lv)} XP`;
  };
  setLabels(level, gain.before.xp);
  bar.style.width = `${(gain.before.xp / xpToNext(level)) * 100}%`;
  $("winXpGain").textContent = "+0 XP";
  const segments = [];
  let from = gain.before.xp;
  for (const lv of gain.gained) {
    segments.push({ level: lv - 1, from, to: xpToNext(lv - 1) });
    from = 0;
  }
  segments.push({ level: gain.after.level, from, to: gain.after.xp });
  let i = 0;
  const run = () => {
    if (G.phase !== "win") return;
    if (i >= segments.length) {
      if (pendingLevels.length) setTimeout(showLevelUp, 450);
      return;
    }
    const seg = segments[i];
    const need = xpToNext(seg.level);
    const t0 = performance.now();
    const ms = 500 + 500 * ((seg.to - seg.from) / need);
    const step = (now) => {
      if (G.phase !== "win") return;
      const k = Math.min(1, (now - t0) / ms);
      const xp = lerp(seg.from, seg.to, easeOutCubic(k));
      bar.style.width = `${(xp / need) * 100}%`;
      setLabels(seg.level, xp);
      $("winXpGain").textContent = `+${Math.round(total * ((i + k) / segments.length))} XP`;
      if (k < 1) return requestAnimationFrame(step);
      if (i < segments.length - 1) {
        // rolled over a level
        level = seg.level + 1;
        lvlEl.classList.remove("bump");
        void lvlEl.offsetWidth;
        lvlEl.classList.add("bump");
        sfx.unlock();
        buzz("tick");
        bar.style.width = "0%";
        setLabels(level, 0);
      } else $("winXpGain").textContent = `+${total} XP`;
      i++;
      setTimeout(run, 120);
    };
    requestAnimationFrame(step);
  };
  setTimeout(run, delay);
}

let levelUpReturn = "win";
function showLevelUp() {
  if (!pendingLevels.length) return;
  const lvl = pendingLevels.shift();
  levelUpReturn = G.phase === "levelup" ? levelUpReturn : G.phase;
  G.phase = "levelup";
  showOnly("levelup");
  const r = levelRewards(lvl);
  $("luLevel").textContent = lvl;
  $("luRank").textContent = r.rank ? `NEW RANK · ${r.rank.name.toUpperCase()}` : `${rankFor(lvl).name.toUpperCase()} · LEVEL ${lvl}`;
  let html = "";
  let d = 0.5;
  for (const [k, v] of Object.entries(r.boost)) {
    html += `<div class="reward glass" style="animation-delay:${d}s"><div class="ic">${BOOSTS[k].icon}</div><div class="nm">+${v} ${BOOSTS[k].label.toUpperCase()}</div></div>`;
    d += 0.15;
  }
  if (r.skin)
    html += `<div class="reward glass skin" style="animation-delay:${d}s"><canvas data-skin="${r.skin.id}" width="168" height="80"></canvas><div class="nm">NEW HULL · ${r.skin.name.toUpperCase()}</div></div>`;
  $("luRewards").innerHTML = html;
  for (const c of $("luRewards").querySelectorAll("canvas")) paintPreview(c, c.dataset.skin, 1);
  sfx.levelUp();
  buzz("long");
}
function closeLevelUp() {
  if (pendingLevels.length) return showLevelUp();
  // Back on the results: show the XP breakdown at once instead of replaying its entrance.
  for (const el of $("xpParts").children) el.style.animationDelay = "0s";
  G.phase = levelUpReturn;
  showOnly(levelUpReturn);
}

/** Draws a hull into a small canvas (hangar list, level-up card). */
function paintPreview(c, skin, colorIndex) {
  const g = c.getContext("2d");
  const r = window.devicePixelRatio || 1;
  const w = c.clientWidth || c.width;
  const h = c.clientHeight || c.height;
  c.width = w * r;
  c.height = h * r;
  g.setTransform(r, 0, 0, r, 0, 0);
  const spr = shipSprite(skin, colorIndex, w * 0.86, h * 0.8, false);
  // The sprite cache paints at the game's pixel ratio; stamp it through the same helper.
  drawSprite(g, spr, w / 2, h / 2, 0);
}

// ---------- fx update ----------
function updateFx(dt) {
  for (const p of fx.particles) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const drag = p.kind === "debris" ? 1.8 : 3.2;
    p.vx *= 1 - dt * drag;
    p.vy *= 1 - dt * drag;
    if (p.kind === "debris") p.rot += p.vr * dt;
  }
  fx.particles = fx.particles.filter((p) => p.life < p.max);
  if (fx.particles.length > 600) fx.particles.splice(0, fx.particles.length - 600);
  for (const b of fx.beams) b.t += dt;
  fx.beams = fx.beams.filter((b) => b.t < 0.12);
  for (const r of fx.rings) r.t += dt;
  fx.rings = fx.rings.filter((r) => r.t < r.life);
  for (const f of fx.flashes) f.t += dt;
  fx.flashes = fx.flashes.filter((f) => f.t < f.life);
  for (const t of fx.texts) t.t += dt;
  fx.texts = fx.texts.filter((t) => t.t < t.life);
  for (const w of fx.warps) w.t += dt;
  fx.warps = fx.warps.filter((w) => w.t < 0.5);
  fx.shake = Math.max(0, fx.shake - dt * 30);
  fx.flash = Math.max(0, fx.flash - dt);
  for (const s of stars) {
    s.y += s.v * dt;
    if (s.y > L.H) {
      s.y = -2;
      s.x = Math.random() * L.W;
    }
  }
}

// ---------- drawing ----------
const stars = Array.from({ length: 90 }, () => ({
  x: Math.random() * 400,
  y: Math.random() * 900,
  v: 6 + Math.random() * 30,
  r: Math.random() * 1.3 + 0.4,
}));

function draw() {
  const { W, H } = L;
  ctx.save();
  drawSprite(ctx, backdrop(W, H), 0, 0);
  for (const s of stars) {
    ctx.globalAlpha = 0.25 + s.r * 0.4;
    ctx.fillStyle = "#d8e6ff";
    ctx.fillRect(s.x, s.y, s.r, s.r * (1 + s.v / 30));
  }
  ctx.globalAlpha = 1;
  if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
  if (G.cfg && G.phase !== "menu") {
    drawEnemies();
    drawShield();
    drawBays();
    drawGrid();
    for (const s of G.ships) if (s.state === "fly" || s.state === "press") drawFlying(s);
    drawStormFx();
    drawStormMeter();
    drawFx();
    drawBanner();
    if (G.alert) {
      const a = 0.22 + 0.18 * Math.sin(G.t * 10);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(255,30,60,0)");
      g.addColorStop(1, `rgba(255,30,60,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
  }
  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255,40,70,${fx.flash * 0.5})`;
    ctx.fillRect(-20, -20, W + 40, H + 40);
  }
  ctx.restore();
}

/** Sector intro: name and what is in the hangar, for the first 1.6 seconds. */
function drawBanner() {
  const k = (G.t - G.start) / 1.6;
  if (k >= 1 || G.phase !== "play") return;
  const a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
  const y = L.gy + (L.cell * G.cfg.rows) / 2;
  ctx.save();
  ctx.globalAlpha = a;
  const band = ctx.createLinearGradient(0, 0, L.W, 0);
  band.addColorStop(0, "rgba(5,8,25,0)");
  band.addColorStop(0.5, "rgba(5,8,25,0.85)");
  band.addColorStop(1, "rgba(5,8,25,0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, y - 46, L.W, 92);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const boss = G.cfg.boss;
  ctx.font = `900 ${boss ? 26 : 30}px ${HEAD}`;
  ctx.fillStyle = boss ? "#ff3b5c" : "#ffffff";
  ctx.shadowColor = boss ? "#ff3b5c" : "#22e4ff";
  ctx.shadowBlur = 18;
  const slide = (1 - easeOutCubic(clamp01(k / 0.25))) * 60;
  ctx.fillText(boss ? `☠ BOSS SECTOR ${G.n}` : `SECTOR ${G.n}`, L.W / 2 - slide, y - 12);
  ctx.shadowBlur = 0;
  ctx.font = `700 11px ${HEAD}`;
  ctx.fillStyle = "#8fa3d4";
  ctx.fillText(`${G.ships.length} ROCKETS  ·  ${G.cfg.colors} COLORS  ·  ${G.queue.length} SAUCERS`, L.W / 2 + slide, y + 18);
  ctx.restore();
}

function drawEnemies() {
  const left = G.queue.length - G.q;
  const visibleRows = Math.max(1, Math.floor((L.shieldY - L.enemyTop - 22) / L.rowH));
  const maxShown = visibleRows * L.perRow + L.perRow;
  if (G.cfg.boss) drawMothership();
  for (let k = Math.min(G.queue.length - 1, G.q + maxShown); k >= G.q; k--) {
    const [x, y] = enemySlotPos(k - G.qAnim);
    // The top strip is kept for the "incoming" count.
    if (y < L.enemyTop + 16 + L.enemyR * 0.5) continue;
    const bob = Math.sin(G.t * 3 + k * 0.7) * 1.4;
    // storm: saucers flip to their new colors in a wave running down the formation
    let color = G.queue[k];
    let sy = 1;
    const wf = G.waveFlip;
    if (wf) {
      const fk = (G.t - wf.t0 - (k - wf.q) * 0.012) / 0.35;
      if (fk < 0.5 && k - wf.q < wf.from.length) color = wf.from[k - wf.q];
      if (fk > 0 && fk < 1) sy = Math.max(0.08, Math.abs(Math.cos(Math.PI * fk)));
    }
    drawSprite(ctx, saucerSprite(color, L.enemyR), x, y + bob, Math.sin(G.t * 2 + k) * 0.06, 1, sy);
    if (k === G.q) {
      // target reticle on the front saucer
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = rgba(COLORS[G.queue[k]].glow, 0.85);
      ctx.lineWidth = 1.5;
      const r = L.enemyR * 1.35;
      for (let i = 0; i < 4; i++) {
        const a0 = G.t * 2.5 + (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.arc(x, y + bob, r, a0, a0 + 0.8);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  if (left > maxShown) {
    ctx.fillStyle = "#8fa3d4";
    ctx.font = `700 10px ${HEAD}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`+${left - maxShown} INCOMING`, L.W / 2, L.enemyTop + 7);
  }
}

function drawMothership() {
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.1 * Math.sin(G.t * 2);
  drawSprite(ctx, saucerSprite(0, L.sx * 1.1), L.W / 2, L.enemyTop + 18, 0, 2.6, 0.9);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.35 + 0.25 * Math.sin(G.t * 5);
  drawSprite(ctx, glowSprite("#ff3b5c", L.sx * 1.6), L.W / 2, L.enemyTop + 18, 0, 2, 0.7);
  ctx.restore();
}

function drawShield() {
  const y = L.shieldY;
  const hot = G.threat >= 1;
  const col = hot ? "#ff3b5c" : "#22e4ff";
  ctx.save();
  const band = ctx.createLinearGradient(0, y - 22, 0, y + 2);
  band.addColorStop(0, rgba(col, 0));
  band.addColorStop(1, rgba(col, hot ? 0.35 : 0.14 + 0.05 * Math.sin(G.t * 3)));
  ctx.fillStyle = band;
  ctx.fillRect(0, y - 22, L.W, 24);
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rgba(col, 0.7 + 0.3 * Math.sin(G.t * (hot ? 18 : 3)));
  ctx.lineWidth = 1.6;
  ctx.shadowColor = col;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  for (let x = 0; x <= L.W; x += 6) {
    const yy = y + Math.sin(x * 0.05 + G.t * 4) * 1.2;
    if (x === 0) ctx.moveTo(x, yy);
    else ctx.lineTo(x, yy);
  }
  ctx.stroke();
  ctx.restore();
  if (G.cfg.creep > 0) {
    const top = L.enemyTop + 6;
    const h = y - top - 6;
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath();
    ctx.roundRect(5, top, 4, h, 2);
    ctx.fill();
    ctx.fillStyle = G.threat > 0.8 ? "#ff3b5c" : G.threat > 0.5 ? "#ffc23a" : "#7dff4a";
    ctx.beginPath();
    ctx.roundRect(5, top + h * (1 - G.threat), 4, Math.max(0.1, h * G.threat), 2);
    ctx.fill();
  }
}

function drawBays() {
  const shakeX = G.bayShake > 0 ? Math.sin(G.t * 70) * 5 * (G.bayShake / 0.35) : 0;
  const pad = padSprite(L.bayW, L.bayH);
  for (let i = 0; i < L.slots; i++) {
    const x = bayX(i) + shakeX;
    const y = L.bayY;
    if (i >= G.bays.length) {
      drawLockedBay(x, y);
      continue;
    }
    drawSprite(ctx, pad, x, y);
    const b = G.bays[i];
    if (!b) {
      if (G.alert) {
        ctx.strokeStyle = `rgba(255,59,92,${0.4 + 0.3 * Math.sin(G.t * 10)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x - L.bayW / 2 + 2, y - L.bayH / 2 + 2, L.bayW - 4, L.bayH - 4, 10);
        ctx.stroke();
      }
      continue;
    }
    const c = COLORS[b.color];
    // pad lights in the rocket's color
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rgba(c.main, b.ready ? 0.9 : 0.35);
    ctx.shadowColor = c.main;
    ctx.shadowBlur = b.ready ? 14 : 4;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - L.bayW / 2 + 2, y - L.bayH / 2 + 2, L.bayW - 4, L.bayH - 4, 10);
    ctx.stroke();
    ctx.restore();
    const s = G.ships[b.ship];
    if (b.ready) {
      let scale = 1;
      if (s.state === "dock") scale = lerp(1.25, 1, easeOutBack(clamp01(s.anim.t / 0.3), 2.4));
      const hover = Math.sin(G.t * 3 + i) * 1.2;
      const rx = -Math.cos(b.ang) * b.recoil * 3;
      const ry = -Math.sin(b.ang) * b.recoil * 3;
      drawShipSprite(s, x + rx, y + hover + ry, b.ang, padLen(s) * scale, padWid() * scale, false, 4, 1);
    }
    // shots left
    const by = y + L.bayH / 2 + 11;
    const pop = 1 + b.pop * 0.25;
    ctx.save();
    ctx.translate(x, by);
    ctx.scale(pop, pop);
    const grad = ctx.createLinearGradient(0, -9, 0, 9);
    grad.addColorStop(0, c.glow);
    grad.addColorStop(1, c.main);
    ctx.fillStyle = grad;
    ctx.shadowColor = c.main;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(-16, -9, 32, 18, 9);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#06101c";
    ctx.font = `900 11px ${HEAD}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(b.ammo), 0, 1);
    ctx.restore();
  }
}

/** The sixth pad: locked until the +1 bay booster opens it; it glows when it would save the player. */
function drawLockedBay(x, y) {
  const w = L.bayW;
  const h = L.bayH;
  const have = save.boost.bay > 0;
  const urgent = have && (G.alert || G.bays.every(Boolean));
  ctx.save();
  ctx.globalAlpha = 0.45;
  drawSprite(ctx, padSprite(w, h), x, y);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = have ? `rgba(255,194,58,${urgent ? 0.6 + 0.4 * Math.sin(G.t * 8) : 0.45})` : "rgba(120,130,160,0.3)";
  if (urgent) {
    ctx.shadowColor = "#ffc23a";
    ctx.shadowBlur = 16;
  }
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.roundRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, h - 4, 10);
  ctx.stroke();
  ctx.restore();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = have ? 1 : 0.4;
  ctx.font = `${Math.round(w * 0.34)}px system-ui, sans-serif`;
  ctx.fillText("🔒", x, y - h * 0.1);
  ctx.font = `900 9px ${HEAD}`;
  ctx.fillStyle = have ? "#ffc23a" : "#8fa3d4";
  ctx.fillText(have ? `+1 · ${save.boost.bay}` : "+1", x, y + h * 0.28);
  ctx.globalAlpha = 1;
}

/** One rocket: soft shadow below, the sprite, then the engine glow (additive). */
function drawShipSprite(s, x, y, ang, len, wid, arrow, lift, engine) {
  const skin = save.skin;
  drawSprite(ctx, shadowSprite(skin, len, wid), x + lift * 0.6, y + lift, ang);
  drawSprite(ctx, shipSprite(skin, s.color, len, wid, arrow), x, y, ang);
  if (engine > 0) {
    const c = COLORS[s.color];
    const rx = x - Math.cos(ang) * len * 0.52;
    const ry = y - Math.sin(ang) * len * 0.52;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.min(1, engine) * (0.6 + Math.random() * 0.4);
    const r = wid * (0.45 + engine * 0.35);
    drawSprite(ctx, glowSprite(c.glow, r), rx, ry, ang, 1 + engine * 0.8, 0.7);
    ctx.restore();
  }
}

function drawGrid() {
  const { cols, rows } = G.cfg;
  const { gx, gy, cell } = L;
  const tex = hangarTexture(cols, rows, cell);
  drawSprite(ctx, tex, gx - tex.frame + tex.cx, gy - tex.frame + tex.cy);
  const front = G.queue[G.q];
  const since = G.t - G.start;
  for (const s of G.ships) {
    if (s.state !== "grid" && s.state !== "bounce") continue;
    let [x, y] = shipCenter(s);
    let ang = dirAngle[s.dir];
    let scale = 1;
    let alpha = 1;
    // deploy: drop in from above and settle
    const dk = clamp01((since - s.deploy) / 0.35);
    if (dk < 1) {
      scale = lerp(1.6, 1, easeOutBack(dk, 1.4));
      alpha = clamp01(dk * 2.5);
      if (dk <= 0) continue;
    }
    if (s.state === "bounce") {
      const off = bounceOffset(s);
      x += DIRS[s.dir][0] * off;
      y += DIRS[s.dir][1] * off;
    }
    if (s.wob > 0) ang += Math.sin(G.t * 50) * s.wob * 0.25;
    const len = gridLen(s);
    let wid = L.shipW;
    // storm flip: the rocket turns edge-on, changes color, turns back
    let shown = s;
    if (s.flip) {
      const k = (G.t - s.flip.t0) / 0.4;
      if (k >= 1) s.flip = null;
      else if (k < 0.5) shown = { ...s, color: s.flip.from };
      if (k > 0 && k < 1) wid *= Math.max(0.08, Math.abs(Math.cos(Math.PI * k)));
    }
    if (s.gold && G.phase === "play") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(G.t * 6);
      drawSprite(ctx, glowSprite("#ffc23a", L.shipW * 1.1), x, y, ang, (len / L.shipW) * 0.85, 0.9);
      ctx.restore();
    }
    // the color the wave's front needs glows softly underneath
    else if (front === s.color && G.phase === "play" && !s.flip) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.22 + 0.1 * Math.sin(G.t * 5);
      drawSprite(ctx, glowSprite(COLORS[s.color].main, wid), x, y, ang, (len / wid) * 0.8, 0.75);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    drawShipSprite(shown, x, y, ang, len * scale, wid * scale, true, dk < 1 ? 6 * (1 - dk) + 2 : 2, 0.25);
    ctx.restore();
    if (s.gold) drawGoldStar(x, y, ang, len);
    if (s.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.min(1, s.flash * 2) * (0.5 + 0.5 * Math.sin(G.t * 40));
      drawSprite(ctx, glowSprite("#ff3b5c", wid), x, y, ang, len / wid, 0.8);
      ctx.restore();
    }
  }
  const hint = G.phase === "play" && since > 0.8 ? currentHint() : null;
  if (hint) {
    const [x, y] = shipCenter(hint);
    const horizontal = hint.dir === "left" || hint.dir === "right";
    const w = (horizontal ? hint.len : 1) * cell;
    const h = (horizontal ? 1 : hint.len) * cell;
    const k = (G.t * 1.5) % 1;
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 8);
    ctx.stroke();
    ctx.globalAlpha = 1 - k;
    const grow = k * cell * 0.35;
    ctx.beginPath();
    ctx.roundRect(x - w / 2 - grow, y - h / 2 - grow, w + grow * 2, h + grow * 2, 8 + grow);
    ctx.stroke();
    ctx.restore();
    if (G.n === 1 && G.launches === 0) {
      ctx.font = `900 12px ${HEAD}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#22e4ff";
      ctx.shadowBlur = 10;
      ctx.fillText("TAP THE GLOWING ROCKET", L.W / 2, gy - 18 + Math.sin(G.t * 4) * 2);
      ctx.shadowBlur = 0;
    }
  }
}

/** A spinning four-point star riding on the golden rocket's nose, with the odd sparkle. */
function drawGoldStar(x, y, ang, len) {
  const nx = x + Math.cos(ang) * len * 0.3;
  const ny = y + Math.sin(ang) * len * 0.3;
  const r = L.cell * (0.26 + 0.05 * Math.sin(G.t * 8));
  ctx.save();
  ctx.translate(nx, ny);
  ctx.rotate(G.t * 2);
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "#fff3c4";
  ctx.shadowColor = "#ffc23a";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.3 : r;
    const a = (i * Math.PI) / 4;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (Math.random() < 0.08) fx.particles.push({ kind: "spark", x: nx, y: ny, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 40, life: 0, max: 0.5, color: "#ffd75a" });
}

/** Launches left before the next warp storm, as charging pips between the pads and the hangar. */
function drawStormMeter() {
  if (!G.cfg.stormEvery || G.phase !== "play") return;
  const n = G.cfg.stormEvery;
  const left = G.stormAt ? 0 : G.stormLeft;
  const charged = n - left;
  const y = L.gy - 17;
  const pipW = Math.min(12, (L.W * 0.32) / n);
  const x0 = L.W - 14 - n * (pipW + 3);
  const hot = left <= 2;
  ctx.save();
  ctx.font = `900 9px ${HEAD}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = hot ? `rgba(213,139,255,${0.7 + 0.3 * Math.sin(G.t * 10)})` : "#8fa3d4";
  ctx.fillText(left <= 1 ? "⚡ STORM NEXT LAUNCH" : `⚡ WARP STORM IN ${left}`, x0 - 8, y);
  for (let i = 0; i < n; i++) {
    const on = i < charged;
    ctx.fillStyle = on ? (hot ? "#d58bff" : "#9a6bff") : "rgba(255,255,255,0.1)";
    if (on) {
      ctx.shadowColor = "#b26bff";
      ctx.shadowBlur = hot ? 10 : 5;
    }
    ctx.beginPath();
    ctx.roundRect(x0 + i * (pipW + 3), y - 3, pipW, 6, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

/** The storm sweeping the hangar: a violet wash, a ring rolling outward and lightning across the floor. */
function drawStormFx() {
  if (!G.stormFx) return;
  const k = (G.t - G.stormFx) / 0.8;
  if (k >= 1) return;
  const w = G.cfg.cols * L.cell;
  const h = G.cfg.rows * L.cell;
  const cx = L.gx + w / 2;
  const cy = L.gy + h / 2;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = (1 - k) * 0.35;
  ctx.fillStyle = "#6a2cff";
  ctx.fillRect(L.gx, L.gy, w, h);
  ctx.globalAlpha = 1 - k;
  ctx.strokeStyle = "#d58bff";
  ctx.shadowColor = "#b26bff";
  ctx.shadowBlur = 18;
  ctx.lineWidth = 4 * (1 - k) + 1;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.hypot(w, h) * 0.55 * easeOutCubic(k), 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let b = 0; b < 3; b++) {
    if (Math.random() < 0.5) continue;
    let x = L.gx + Math.random() * w;
    let y = L.gy;
    ctx.beginPath();
    ctx.moveTo(x, y);
    while (y < L.gy + h) {
      x += (Math.random() - 0.5) * L.cell * 1.6;
      y += L.cell * (0.6 + Math.random() * 0.8);
      ctx.lineTo(x, Math.min(y, L.gy + h));
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** The rocket to highlight: a Radar pick, or (sectors 1-2) a free hint after a short idle time. */
function currentHint() {
  if (G.hintId !== -1 && G.t < G.hintUntil && G.ships[G.hintId].state === "grid") return G.ships[G.hintId];
  const idle = G.n === 1 && G.launches === 0 ? 0 : 4;
  if (G.n > 2 || G.t - G.lastTap < idle) return null;
  return radarHint(G.ships.filter((s) => s.state === "grid"), G.queue, G.q, G.bays, G.cfg.cols, G.cfg.rows);
}

function drawFlying(s) {
  if (s.state === "press") {
    const [x, y] = shipCenter(s);
    const k = clamp01(s.anim.t / 0.08);
    const sq = 1 - 0.14 * Math.sin(k * Math.PI);
    drawShipSprite(s, x, y, dirAngle[s.dir], gridLen(s) * sq, L.shipW * (2 - sq), true, 2, 1.2);
    return;
  }
  const p = flightPose(s);
  const c = COLORS[s.color];
  // engine trail
  if (s.trail.length > 1) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let i = 1; i < s.trail.length; i++) {
      const k = i / s.trail.length;
      ctx.strokeStyle = rgba(c.glow, k * 0.55);
      ctx.lineWidth = L.shipW * 0.5 * k;
      ctx.beginPath();
      ctx.moveTo(s.trail[i - 1][0], s.trail[i - 1][1]);
      ctx.lineTo(s.trail[i][0], s.trail[i][1]);
      ctx.stroke();
    }
    ctx.restore();
  }
  const len = lerp(gridLen(s), padLen(s), p.k) * (1 + 0.25 * Math.sin(p.k * Math.PI));
  const wid = lerp(L.shipW, padWid(), p.k) * (1 + 0.25 * Math.sin(p.k * Math.PI));
  const lift = 3 + 10 * Math.sin(p.k * Math.PI);
  drawShipSprite(s, p.x, p.y, p.ang, len, wid, false, lift, 2);
}

function drawFx() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const b of fx.beams) {
    const a = 1 - b.t / 0.12;
    ctx.globalAlpha = a;
    ctx.strokeStyle = b.glow;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const f of fx.flashes) {
    const k = f.t / f.life;
    ctx.globalAlpha = 1 - k;
    drawSprite(ctx, glowSprite(f.color, f.r), f.x, f.y, 0, 0.6 + k * 0.6);
  }
  ctx.globalAlpha = 1;
  for (const p of fx.particles) {
    if (p.kind !== "spark") continue;
    const k = 1 - p.life / p.max;
    ctx.strokeStyle = rgba(p.color, k);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
    ctx.stroke();
  }
  for (const r of fx.rings) {
    const k = r.t / r.life;
    ctx.strokeStyle = r.color;
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = r.width * (1 - k) + 0.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.maxR * (0.25 + easeOutCubic(k) * 0.75), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  for (const p of fx.particles) {
    if (p.kind !== "debris") continue;
    ctx.save();
    ctx.globalAlpha = 1 - p.life / p.max;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  }
  for (const w of fx.warps) {
    // warp out: stretch upward, flash, gone
    const k = w.t / 0.5;
    const s = { color: w.color, len: w.len };
    ctx.save();
    ctx.globalAlpha = 1 - k;
    drawShipSprite(s, w.x, w.y - easeInQuad(k) * L.H * 0.35, -Math.PI / 2, padLen(s) * (1 + k * 2.2), padWid() * (1 - k * 0.5), false, 0, 3);
    ctx.restore();
    if (k < 0.3) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 1 - k / 0.3;
      drawSprite(ctx, glowSprite(COLORS[w.color].glow, L.bayW * 0.7), w.x, w.y, 0, 1, 1.6);
      ctx.restore();
    }
  }
  for (const t of fx.texts) {
    const k = t.t / t.life;
    const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15) * 0.3);
    ctx.save();
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.translate(t.x, t.y - k * 30);
    ctx.scale(pop, pop);
    ctx.font = `900 ${t.size}px ${HEAD}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.strokeText(t.text, 0, 0);
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }
}

// ---------- HUD ----------
const hudCache = {};
function setText(id, v) {
  if (hudCache[id] !== v) {
    hudCache[id] = v;
    $(id).textContent = v;
  }
}
function updateHud() {
  if (!G.cfg || (G.phase !== "play" && G.phase !== "ending")) return;
  setText("hudLvl", String(save.pilot.level));
  setText("hudSector", G.cfg.boss ? `Boss ${G.n}` : `Sector ${G.n}`);
  setText("hudScore", G.score.toLocaleString());
  setText("hudScoreLbl", G.mult > 1 ? `Combo x${G.mult}` : "Score");
  setText("hudRockets", String(inHangar()));
  setText("hudWave", String(G.queue.length - G.q));
  $("hudScore").classList.toggle("hot", G.mult > 1);
  const xpPct = `${(save.pilot.xp / xpToNext(save.pilot.level)) * 100}%`;
  if (hudCache.xp !== xpPct) $("hudXp").style.width = hudCache.xp = xpPct;
  const sh = `${Math.max(0, G.hull)}%`;
  if (hudCache.sh !== sh) {
    hudCache.sh = sh;
    $("hudShield").style.width = sh;
    $("hudShield").style.background = G.hull > 50 ? "" : G.hull > 25 ? "linear-gradient(90deg,#ffc23a,#ffe39a)" : "linear-gradient(90deg,#ff3b5c,#ff8aa0)";
  }
}

// ---------- screens ----------
const overlays = ["menu", "how", "map", "hangar", "pause", "win", "levelup", "lose"];
function showOnly(id) {
  for (const o of overlays) $(o).classList.toggle("show", o === id);
  const playing = id === null || id === "pause";
  $("hud").classList.toggle("show", playing);
  $("shieldBar").classList.toggle("show", playing);
  $("boosts").classList.toggle("show", id === null);
}

function pilotCardHtml() {
  const p = save.pilot;
  const rank = rankFor(p.level);
  const need = xpToNext(p.level);
  const unlock = nextUnlock(p.level);
  const goal = unlock ? `Next hull: <b>${unlock.name}</b> at Lv ${unlock.level}` : rank.next ? `Next rank: ${rank.next.name} at Lv ${rank.next.level}` : "Top of the fleet";
  return (
    `<div class="hex">${p.level}</div><div class="info"><div class="rank">${rank.name.toUpperCase()}</div>` +
    `<div class="bar"><i style="width:${(p.xp / need) * 100}%"></i></div>` +
    `<div class="small">${p.xp} / ${need} XP · ${goal}</div></div>`
  );
}

function showMenu() {
  G.phase = "menu";
  $("menuPilot").innerHTML = pilotCardHtml();
  const chips = [`<span class="chip">★ ${totalStars()}</span>`];
  if (save.best) chips.push(`<span class="chip">BEST ${save.best.toLocaleString()}</span>`);
  if (save.streak > 1) chips.push(`<span class="chip fire">🔥 ${save.streak} STREAK · XP ×${streakMultiplier(save.streak + 1).toFixed(1)}</span>`);
  $("menuChips").innerHTML = chips.join("");
  $("playBtn").textContent = save.level > 1 ? `Launch · Sector ${save.level}` : "Launch";
  showOnly("menu");
  // A level reached on a lost run is celebrated here.
  if (pendingLevels.length) setTimeout(() => G.phase === "menu" && showLevelUp(), 350);
}

function showMap() {
  G.phase = "map";
  const last = Math.max(20, Math.ceil((save.level + 6) / 5) * 5);
  const step = 86;
  const height = last * step + 60;
  const width = $("mapScroll").clientWidth || 320;
  const pos = (n) => [width / 2 + Math.sin(n * 0.85) * width * 0.3, height - (n - 0.5) * step];
  let path = "";
  let done = "";
  for (let n = 1; n <= last; n++) {
    const [x, y] = pos(n);
    path += `${n === 1 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `;
    if (n <= save.level) done += `${n === 1 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `;
  }
  let html =
    `<svg width="${width}" height="${height}"><path d="${path}" fill="none" stroke="rgba(140,170,255,0.25)" stroke-width="3" stroke-dasharray="2 8" stroke-linecap="round"/>` +
    `<path d="${done}" fill="none" stroke="#22e4ff" stroke-width="3" stroke-linecap="round" style="filter:drop-shadow(0 0 6px #22e4ff)"/></svg>`;
  for (let n = 1; n <= last; n++) {
    const [x, y] = pos(n);
    const st = save.stars[n] || 0;
    const open = n <= save.level;
    const boss = n % 10 === 0;
    const hue = (n * 47) % 360;
    const bg = boss
      ? "radial-gradient(circle at 35% 30%, #ff9aa8, #ff3b5c 45%, #4a0716)"
      : `radial-gradient(circle at 35% 30%, hsl(${hue},90%,72%), hsl(${hue},70%,42%) 50%, hsl(${hue},60%,12%))`;
    const cls = ["node", open ? "" : "locked", n === save.level ? "next" : "", boss ? "boss" : ""].join(" ");
    const label = n === save.level ? `<span class="you">YOU</span>` : open && st ? `<span class="st">${"★".repeat(st)}${"☆".repeat(3 - st)}</span>` : "";
    html += `<button class="${cls}" data-n="${n}" ${open ? "" : "disabled"} style="left:${x}px;top:${y}px"><span class="planet" style="background:${bg}">${boss ? "☠" : n}</span>${label}</button>`;
  }
  $("mapPath").style.height = `${height}px`;
  $("mapPath").innerHTML = html;
  $("mapInfo").textContent = `${totalStars()} ★ earned · ${Object.keys(save.stars).length} sectors cleared`;
  showOnly("map");
  const [, cy] = pos(save.level);
  $("mapScroll").scrollTop = cy - $("mapScroll").clientHeight / 2;
}
$("mapPath").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-n]");
  if (!b || b.disabled) return;
  initAudio();
  sfx.click();
  startLevel(Number(b.dataset.n));
});

function showHangar() {
  G.phase = "hangar";
  showOnly("hangar");
  let html = "";
  SKINS.forEach((s, i) => {
    const locked = save.pilot.level < s.level;
    const on = save.skin === s.id;
    const act = locked ? `🔒 LV ${s.level}` : on ? "EQUIPPED" : "EQUIP";
    html += `<button class="skin ${locked ? "locked" : ""} ${on ? "on" : ""}" data-skin="${s.id}"><canvas data-color="${i % COLORS.length}"></canvas>` +
      `<div><div class="nm">${s.name.toUpperCase()}</div><div class="small">${s.blurb}</div></div><span class="act">${act}</span></button>`;
  });
  $("skinList").innerHTML = html;
  for (const c of $("skinList").querySelectorAll("canvas")) paintPreview(c, c.parentElement.dataset.skin, Number(c.dataset.color));
}
$("skinList").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-skin]");
  if (!b) return;
  const skin = SKINS.find((s) => s.id === b.dataset.skin);
  initAudio();
  if (save.pilot.level < skin.level) return sfx.error();
  save.skin = skin.id;
  persist();
  sfx.unlock();
  showHangar();
});

function pause() {
  if (G.phase !== "play") return;
  G.phase = "pause";
  $("pauseInfo").textContent = `Sector ${G.n} · ${G.queue.length - G.q} saucers · ${inHangar()} rockets left`;
  showOnly("pause");
}
function resume() {
  if (G.phase !== "pause") return;
  G.phase = "play";
  showOnly(null);
}
function syncToggles() {
  $("sndBtn").classList.toggle("on", save.sound);
  $("vibBtn").classList.toggle("on", save.vibrate);
}

const onTap = (id, fn) =>
  $(id).addEventListener("click", () => {
    initAudio();
    sfx.click();
    fn();
  });
onTap("playBtn", () => startLevel(save.level));
onTap("pauseBtn", pause);
onTap("resumeBtn", resume);
onTap("restartBtn", () => startLevel(G.n));
onTap("menuBtn", showMenu);
onTap("nextBtn", () => startLevel(G.n + 1));
onTap("replayBtn", () => startLevel(G.n));
onTap("winMapBtn", showMap);
onTap("retryBtn", () => {
  settleLoss();
  startLevel(G.n);
});
onTap("loseMenuBtn", () => {
  settleLoss();
  showMenu();
});
onTap("contBay", () => continueWith("bay"));
onTap("contUndo", () => continueWith("undo"));
onTap("mapBtn", showMap);
onTap("mapBack", showMenu);
onTap("hangarBtn", showHangar);
onTap("hangarBack", showMenu);
onTap("howBtn", () => {
  G.phase = "how";
  showOnly("how");
});
onTap("howBack", showMenu);
onTap("luBtn", closeLevelUp);
onTap("sndBtn", () => {
  save.sound = !save.sound;
  syncToggles();
  persist();
});
onTap("vibBtn", () => {
  save.vibrate = !save.vibrate;
  syncToggles();
  persist();
  buzz("tick");
});
syncToggles();

// Android back button: closes what is on top; on the menu the app closes.
window.__back = () => {
  const p = G.phase;
  if (p === "play") return pause(), true;
  if (p === "pause") return resume(), true;
  if (p === "levelup") return closeLevelUp(), true;
  if (p === "lose") return settleLoss(), showMenu(), true;
  if (p === "win" || p === "map" || p === "hangar" || p === "how") return showMenu(), true;
  return false;
};
window.__pause = pause;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});

// Hook for automated checks (drives the game without touch input).
window.__sifi = {
  state: () => ({ phase: G.phase, n: G.n, q: G.q, total: G.queue && G.queue.length, bays: G.bays, hull: G.hull, score: G.score,
    rockets: G.ships ? G.ships.length : 0, pilot: save.pilot, streak: save.streak }),
  solution: () => G.solution.slice(),
  tap: (id) => tapShip(id),
  start: (n) => startLevel(n),
  storm: (helpful = false) => runStorm(helpful),
  gold: () => (G.ships ? G.ships.findIndex((s) => s.gold) : -1),
  extra: () => ({ golds: G.golds, storms: G.storms, stormLeft: G.stormLeft, queue: G.queue.slice(G.q),
    bays: G.bays.map((b) => b && { color: b.color, ammo: b.ammo }),
    hangar: G.ships.filter((s) => s.state === "grid" || s.state === "bounce").map((s) => ({ color: s.color, cap: s.cap })) }),
};

// ---------- loop ----------
window.addEventListener("resize", layout);
layout();
showMenu();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  updateHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
