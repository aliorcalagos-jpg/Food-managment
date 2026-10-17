// SIFIship: drawing, input, effects, sound and screens. The rules live in logic.js.
import { COLORS, DIRS, generateLevel, occupancy, blocker, pickShooter } from "./logic.js";

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const $ = (id) => document.getElementById(id);

const FIRE_EVERY = 0.085; // seconds between shots
const COMBO_WINDOW = 1.2; // seconds between kills that keep a combo going
const CHAIN_WINDOW = 0.9; // seconds between launches that count as a chain launch
const HULL_DAMAGE = 14; // shield points per second while the wave touches it
const GRACE = 3; // seconds before the wave starts closing in

// ---------- saved progress (per phone) ----------
const SAVE_KEY = "sifiship.v1";
let save = { level: 1, best: 0, stars: {}, sound: true, vibrate: true };
try {
  save = { ...save, ...JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") };
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

// ---------- sound (synthesized, no files) ----------
let audio = null;
let master = null;
function initAudio() {
  if (audio) return;
  try {
    audio = new (window.AudioContext || window.webkitAudioContext)();
    master = audio.createGain();
    master.gain.value = 0.35;
    master.connect(audio.destination);
  } catch {
    audio = null;
  }
}
function tone(freq, dur, type = "square", vol = 0.3, slideTo = null, delay = 0) {
  if (!audio || !save.sound) return;
  const t0 = audio.currentTime + delay;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}
let noiseBuf = null;
function noise(dur, vol = 0.3, freq = 900) {
  if (!audio || !save.sound) return;
  if (!noiseBuf) {
    noiseBuf = audio.createBuffer(1, audio.sampleRate * 0.6, audio.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = audio.currentTime;
  const src = audio.createBufferSource();
  src.buffer = noiseBuf;
  const f = audio.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(freq, t0);
  f.frequency.exponentialRampToValueAtTime(80, t0 + dur);
  const g = audio.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur);
}
let lastBoom = 0;
const sfx = {
  pew: () => tone(1100 + Math.random() * 200, 0.07, "square", 0.08, 300),
  boom: () => {
    const now = performance.now();
    if (now - lastBoom < 60) return;
    lastBoom = now;
    noise(0.18, 0.22, 1400);
  },
  launch: () => {
    tone(180, 0.32, "sawtooth", 0.12, 900);
    noise(0.3, 0.08, 3000);
  },
  dock: () => tone(520, 0.08, "triangle", 0.18, 780),
  thunk: () => {
    tone(140, 0.1, "sine", 0.4, 70);
    noise(0.06, 0.15, 500);
  },
  warp: () => tone(300, 0.35, "sine", 0.15, 2400),
  error: () => {
    tone(220, 0.12, "square", 0.12);
    tone(160, 0.16, "square", 0.12, null, 0.12);
  },
  alarm: () => {
    tone(880, 0.14, "square", 0.07);
    tone(620, 0.14, "square", 0.07, null, 0.16);
  },
  combo: (m) => tone(500 + m * 120, 0.18, "triangle", 0.2, 900 + m * 200),
  hit: () => noise(0.25, 0.3, 600),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, "triangle", 0.22, null, i * 0.09)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, "sawtooth", 0.13, null, i * 0.16)),
  click: () => tone(700, 0.05, "triangle", 0.15),
};

function buzz(kind) {
  if (!save.vibrate) return;
  try {
    if (window.AndroidBridge) window.AndroidBridge.haptic(kind);
    else if (navigator.vibrate) navigator.vibrate(kind === "tick" ? 12 : 40);
  } catch {
    /* no haptics */
  }
}

// ---------- layout ----------
const L = {};
function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  L.W = window.innerWidth;
  L.H = window.innerHeight;
  canvas.width = Math.round(L.W * dpr);
  canvas.height = Math.round(L.H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  L.hudH = 62;
  L.enemyTop = L.hudH + 4;
  L.shieldY = L.enemyTop + Math.max(150, L.H * 0.27);
  L.bayW = Math.min((L.W - 32 - 4 * 8) / 5, 74);
  L.bayH = L.bayW * 1.18;
  L.bayTop = L.shieldY + 14;
  L.bayY = L.bayTop + L.bayH / 2;
  L.gridTop = L.bayTop + L.bayH + 30;
  if (G.cfg) placeGrid();
  L.perRow = 7;
  L.sx = Math.min((L.W - 36) / L.perRow, 46);
  L.rowH = L.sx * 0.78;
}
function placeGrid() {
  const { cols, rows } = G.cfg;
  const availH = L.H - L.gridTop - 14;
  L.cell = Math.floor(Math.min((L.W - 24) / cols, availH / rows));
  L.gx = (L.W - L.cell * cols) / 2;
  L.gy = L.gridTop + Math.max(0, (availH - L.cell * rows) / 2);
}
const bayX = (i) => L.W / 2 + (i - 2) * (L.bayW + 8);

// ---------- game state ----------
const G = { phase: "menu", t: 0 };
const fx = { particles: [], beams: [], rings: [], texts: [], warps: [], shake: 0, flash: 0 };

function startLevel(n) {
  const lv = generateLevel(n);
  G.n = n;
  G.cfg = lv.cfg;
  G.ships = lv.ships.map((s) => ({ ...s, state: "grid", anim: null, flash: 0, bob: Math.random() * 6 }));
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
  G.lastTap = G.t;
  refreshOcc();
  placeGrid();
  fx.particles = [];
  fx.beams = [];
  fx.rings = [];
  fx.texts = [];
  fx.warps = [];
  G.phase = "play";
  showOnly(null);
  $("pauseBtn").classList.add("show");
  floatText(lv.cfg.boss ? "⚠ BOSS WAVE" : `SECTOR ${n}`, L.W / 2, L.shieldY - 40, lv.cfg.boss ? "#ff3b5c" : "#22e4ff", 30, 1.6);
}

function refreshOcc() {
  G.occ = occupancy(
    G.ships.filter((s) => s.state === "grid" || s.state === "bounce"),
    G.cfg.cols,
    G.cfg.rows,
  );
}

// ---------- geometry helpers ----------
const dirAngle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
function shipCenter(s) {
  const horizontal = s.dir === "left" || s.dir === "right";
  const w = horizontal ? s.len : 1;
  const h = horizontal ? 1 : s.len;
  return [L.gx + (s.x + w / 2) * L.cell, L.gy + (s.y + h / 2) * L.cell];
}
function enemySlotPos(slot) {
  const frontY = L.shieldY - 16 - (1 - G.threat) * L.rowH * 2.2;
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
function burst(x, y, color, n = 14, speed = 160, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random());
    fx.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.4 + Math.random() * 0.5, color, size: size * (0.5 + Math.random()) });
  }
}
function floatText(text, x, y, color = "#fff", size = 22, life = 1) {
  const margin = Math.min(L.W / 2, text.length * size * 0.36);
  fx.texts.push({ text, x: Math.max(margin, Math.min(L.W - margin, x)), y, color, size, t: 0, life });
}
function ring(x, y, color, maxR = 40) {
  fx.rings.push({ x, y, color, t: 0, maxR });
}

// ---------- input ----------
canvas.addEventListener("pointerdown", (e) => {
  if (G.phase !== "play") return;
  initAudio();
  const cx = Math.floor((e.clientX - L.gx) / L.cell);
  const cy = Math.floor((e.clientY - L.gy) / L.cell);
  if (cx < 0 || cy < 0 || cx >= G.cfg.cols || cy >= G.cfg.rows) return;
  const id = G.occ[cy][cx];
  if (id !== -1) tapShip(id);
});

function tapShip(id) {
  const s = G.ships[id];
  if (!s || s.state !== "grid") return false;
  G.lastTap = G.t;
  const block = blocker(s, G.occ, G.cfg.cols, G.cfg.rows);
  if (block) {
    s.state = "bounce";
    s.anim = { t: 0, dur: 0.3, dist: block.distance * L.cell + L.cell * 0.2 };
    G.ships[block.id].flash = 0.5;
    sfx.thunk();
    buzz("tick");
    return false;
  }
  const bay = G.bays.indexOf(null);
  if (bay === -1) {
    sfx.error();
    buzz("long");
    fx.shake = Math.max(fx.shake, 5);
    floatText("ALL BAYS FULL", L.W / 2, L.bayY, "#ff3b5c", 20, 0.9);
    G.bayShake = 0.35;
    return false;
  }
  G.bays[bay] = { ship: id, color: s.color, ammo: s.cap, ready: false, recoil: 0 };
  G.peak = Math.max(G.peak, G.bays.filter(Boolean).length);
  s.state = "fly";
  s.anim = { t: 0, phase: 1, off: 0, v: L.cell * 6, bay };
  refreshOcc();
  sfx.launch();
  buzz("tick");
  // Chain launch: several quick launches in a row.
  if (G.t - G.lastLaunch < CHAIN_WINDOW) {
    G.chain++;
    const [x, y] = shipCenter(s);
    floatText(`CHAIN x${G.chain}`, x, y - 20, "#ffc23a", 18 + G.chain * 2, 0.9);
    G.score += 25 * G.chain;
  } else G.chain = 1;
  G.lastLaunch = G.t;
  return true;
}

// ---------- update ----------
function update(dt) {
  G.t += dt;
  updateFx(dt);
  if (!G.cfg || G.phase === "menu" || G.phase === "pause") return;

  for (const s of G.ships) {
    s.flash = Math.max(0, s.flash - dt);
    if (s.state === "bounce") {
      s.anim.t += dt;
      if (s.anim.t >= s.anim.dur) {
        s.state = "grid";
        s.anim = null;
      }
    } else if (s.state === "fly") updateFlight(s, dt);
  }
  for (const b of G.bays) if (b) b.recoil = Math.max(0, b.recoil - dt * 6);
  G.bayShake = Math.max(0, (G.bayShake || 0) - dt);
  G.qAnim += (G.q - G.qAnim) * Math.min(1, dt * 9);

  if (G.phase === "ending") {
    G.endTimer -= dt;
    if (G.endTimer <= 0) finish();
    return;
  }
  G.playTime += dt;

  // Fire at the front of the wave.
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

  // The wave closes in; kills push it back (in kill()).
  if (G.cfg.creep > 0 && G.playTime > GRACE) {
    G.threat = Math.min(1, G.threat + G.cfg.creep * dt);
    if (G.threat >= 1) {
      G.hull -= HULL_DAMAGE * dt;
      fx.shake = Math.max(fx.shake, 3);
      if (Math.random() < dt * 14) {
        const x = L.W / 2 + (Math.random() - 0.5) * L.W * 0.8;
        burst(x, L.shieldY, "#ff3b5c", 6, 120, 2.5);
      }
      if (Math.random() < dt * 3) sfx.hit();
      if (G.hull <= 0) {
        G.hull = 0;
        return end("hull");
      }
    }
  }

  // Jammed: every bay holds a docked ship and none of them can shoot the front enemy.
  const front = G.queue[G.q];
  const allDocked = G.bays.every((b) => b && b.ready);
  const anyFlying = G.ships.some((s) => s.state === "fly");
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

function updateFlight(s, dt) {
  const a = s.anim;
  a.t += dt;
  if (a.phase === 1) {
    a.v += L.cell * 40 * dt;
    a.off += a.v * dt;
    const [cx, cy] = shipCenter(s);
    const [dx, dy] = DIRS[s.dir];
    const x = cx + dx * a.off;
    const y = cy + dy * a.off;
    const half = (s.len * L.cell) / 2;
    if (x < L.gx - half || x > L.gx + L.cell * G.cfg.cols + half || y < L.gy - half || y > L.gy + L.cell * G.cfg.rows + half) {
      a.phase = 2;
      a.t = 0;
      a.p0 = [x, y];
      a.c = [x + dx * L.cell * 2.5, y + dy * L.cell * 2.5 - L.cell * 2];
    }
    if (Math.random() < 0.8) burst(x - dx * half, y - dy * half, COLORS[s.color].glow, 1, 40, 2.5);
  } else {
    const k = Math.min(1, a.t / 0.42);
    if (k >= 1) {
      s.state = "bay";
      s.anim = null;
      const bay = G.bays[a.bay];
      bay.ready = true;
      ring(bayX(a.bay), L.bayY, COLORS[s.color].main, L.bayW * 0.7);
      sfx.dock();
    }
  }
}

function flightPose(s) {
  const a = s.anim;
  const [cx, cy] = shipCenter(s);
  const [dx, dy] = DIRS[s.dir];
  if (a.phase === 1) return { x: cx + dx * a.off, y: cy + dy * a.off, ang: dirAngle[s.dir], scale: 0 };
  const k = Math.min(1, a.t / 0.42);
  const e = 1 - Math.pow(1 - k, 3);
  const p2 = [bayX(a.bay), L.bayY];
  const u = 1 - e;
  const x = u * u * a.p0[0] + 2 * u * e * a.c[0] + e * e * p2[0];
  const y = u * u * a.p0[1] + 2 * u * e * a.c[1] + e * e * p2[1];
  let from = dirAngle[s.dir];
  let to = -Math.PI / 2;
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return { x, y, ang: from + d * e, scale: e };
}

function kill(bayIndex) {
  const b = G.bays[bayIndex];
  const color = COLORS[b.color];
  const [ex, ey] = enemySlotPos(Math.max(0, G.q - G.qAnim));
  const sx = bayX(bayIndex);
  const sy = L.bayY - L.bayH * 0.42;
  fx.beams.push({ x1: sx, y1: sy, x2: ex, y2: ey, t: 0, color: color.main, glow: color.glow });
  burst(ex, ey, color.main, 12, 170, 3);
  burst(ex, ey, "#ffffff", 4, 90, 2);
  ring(ex, ey, color.glow, 22);
  sfx.pew();
  sfx.boom();
  G.q++;
  G.threat = Math.max(0, G.threat - G.cfg.pushback);
  G.streak = G.t - G.lastKill < COMBO_WINDOW ? G.streak + 1 : 1;
  G.lastKill = G.t;
  const mult = Math.min(5, 1 + Math.floor(G.streak / 8));
  if (mult > G.mult) {
    floatText(`COMBO x${mult}`, L.W / 2, L.shieldY - L.rowH * 2.5, "#ffc23a", 24 + mult * 3, 1);
    sfx.combo(mult);
    buzz("tick");
  }
  G.mult = mult;
  G.score += 10 * G.mult;
  b.ammo--;
  b.recoil = 1;
  if (b.ammo <= 0) {
    const s = G.ships[b.ship];
    s.state = "gone";
    fx.warps.push({ x: sx, y: L.bayY, color: s.color, len: s.len, t: 0 });
    G.bays[bayIndex] = null;
    sfx.warp();
    buzz("tick");
  }
}

function end(result) {
  G.result = result;
  G.phase = "ending";
  G.endTimer = result === "win" ? 1.1 : 0.9;
  G.alert = false;
  if (result === "win") {
    sfx.win();
    buzz("long");
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const x = L.W * (0.2 + Math.random() * 0.6);
        const y = L.enemyTop + Math.random() * (L.shieldY - L.enemyTop);
        burst(x, y, COLORS[Math.floor(Math.random() * COLORS.length)].main, 40, 260, 3.5);
        ring(x, y, "#ffffff", 70);
        sfx.boom();
      }, i * 140);
    }
    if (G.cfg.boss) burst(L.W / 2, L.enemyTop + 40, "#ff3b5c", 120, 380, 4);
  } else {
    sfx.lose();
    buzz("long");
    fx.shake = 14;
    fx.flash = 0.6;
  }
}

function finish() {
  $("pauseBtn").classList.remove("show");
  if (G.result === "win") {
    const hullOk = G.hull >= 70;
    const baysOk = G.peak <= 3;
    const stars = 1 + (hullOk ? 1 : 0) + (baysOk ? 1 : 0);
    save.stars[G.n] = Math.max(save.stars[G.n] || 0, stars);
    save.level = Math.max(save.level, G.n + 1);
    const best = G.score > save.best;
    save.best = Math.max(save.best, G.score);
    persist();
    G.phase = "win";
    showOnly("win");
    const spans = $("stars").children;
    for (let i = 0; i < 3; i++) {
      spans[i].className = "";
      setTimeout(() => {
        spans[i].className = i < stars ? "on" : "off";
        if (i < stars) {
          tone(880 + i * 220, 0.16, "triangle", 0.2);
          buzz("tick");
        }
      }, 250 + i * 280);
    }
    $("goals").innerHTML =
      `<div class="done">Sector cleared</div>` +
      `<div class="${hullOk ? "done" : ""}">Shield above 70% (${Math.round(G.hull)}%)</div>` +
      `<div class="${baysOk ? "done" : ""}">Never more than 3 bays in use (${G.peak})</div>`;
    animateNumber($("winScore"), G.score);
    $("winBest").textContent = best ? "New best score!" : `Best: ${save.best}`;
  } else {
    G.phase = "lose";
    showOnly("lose");
    $("loseTitle").textContent = G.result === "jam" ? "HANGAR JAMMED" : "SHIELD DOWN";
    const left = G.queue.length - G.q;
    $("loseText").textContent =
      G.result === "jam"
        ? `Every bay is holding a ship that can't hit the front enemy. ${left} enemies left. Launch the color the wave needs next.`
        : `The wave broke through with ${left} enemies left. Keep a ship firing so the wave stays back.`;
  }
}

function animateNumber(el, to) {
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 700);
    el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString();
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function updateFx(dt) {
  for (const p of fx.particles) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - dt * 2.5;
    p.vy *= 1 - dt * 2.5;
  }
  fx.particles = fx.particles.filter((p) => p.life < p.max);
  for (const b of fx.beams) b.t += dt;
  fx.beams = fx.beams.filter((b) => b.t < 0.12);
  for (const r of fx.rings) r.t += dt;
  fx.rings = fx.rings.filter((r) => r.t < 0.4);
  for (const t of fx.texts) t.t += dt;
  fx.texts = fx.texts.filter((t) => t.t < t.life);
  for (const w of fx.warps) w.t += dt;
  fx.warps = fx.warps.filter((w) => w.t < 0.45);
  fx.shake = Math.max(0, fx.shake - dt * 30);
  fx.flash = Math.max(0, fx.flash - dt);
  for (const s of stars) {
    s.y += s.v * dt;
    if (s.y > L.H) {
      s.y = 0;
      s.x = Math.random() * L.W;
    }
  }
}

// ---------- drawing ----------
const stars = Array.from({ length: 110 }, () => ({
  x: Math.random() * 1000,
  y: Math.random() * 2000,
  v: 8 + Math.random() * 40,
  r: Math.random() * 1.4 + 0.3,
}));

function draw() {
  const { W, H } = L;
  ctx.save();
  ctx.fillStyle = "#05060f";
  ctx.fillRect(0, 0, W, H);
  const neb = ctx.createRadialGradient(W * 0.2, H * 0.15, 10, W * 0.2, H * 0.15, W * 0.9);
  neb.addColorStop(0, "rgba(90, 40, 160, 0.25)");
  neb.addColorStop(1, "rgba(5, 6, 15, 0)");
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, W, H);
  for (const s of stars) {
    ctx.globalAlpha = 0.35 + s.r * 0.35;
    ctx.fillStyle = "#cfe3ff";
    ctx.fillRect(s.x % W, s.y % H, s.r, s.r);
  }
  ctx.globalAlpha = 1;

  if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);

  if (G.cfg) {
    drawEnemies();
    drawShield();
    drawBays();
    drawGrid();
    for (const s of G.ships) if (s.state === "fly") drawFlying(s);
    drawFx();
    drawHud();
    if (G.alert) {
      const a = 0.25 + 0.2 * Math.sin(G.t * 10);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(255, 30, 60, 0)");
      g.addColorStop(1, `rgba(255, 30, 60, ${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
  }
  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255, 40, 70, ${fx.flash * 0.5})`;
    ctx.fillRect(-20, -20, W + 40, H + 40);
  }
  ctx.restore();
}

function drawHud() {
  const { W } = L;
  ctx.fillStyle = "rgba(8, 12, 30, 0.8)";
  ctx.fillRect(0, 0, W, L.hudH);
  ctx.strokeStyle = "rgba(34, 228, 255, 0.25)";
  ctx.beginPath();
  ctx.moveTo(0, L.hudH);
  ctx.lineTo(W, L.hudH);
  ctx.stroke();
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#8ea3d6";
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(G.cfg.boss ? "BOSS SECTOR" : "SECTOR", 14, 17);
  ctx.fillStyle = "#e8f1ff";
  ctx.font = "900 20px system-ui, sans-serif";
  ctx.fillText(String(G.n), 14, 36);
  ctx.textAlign = "center";
  ctx.fillStyle = "#8ea3d6";
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.fillText(G.mult > 1 ? `SCORE  ·  COMBO x${G.mult}` : "SCORE", W / 2, 17);
  ctx.fillStyle = G.mult > 1 ? "#ffc23a" : "#e8f1ff";
  ctx.font = "900 20px system-ui, sans-serif";
  ctx.fillText(G.score.toLocaleString(), W / 2, 36);
  ctx.textAlign = "right";
  ctx.fillStyle = "#8ea3d6";
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.fillText("WAVE", W - 62, 17);
  ctx.fillStyle = "#e8f1ff";
  ctx.font = "900 20px system-ui, sans-serif";
  ctx.fillText(String(G.queue.length - G.q), W - 62, 36);
  // Shield bar
  const bw = W - 28;
  const pct = G.hull / 100;
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  roundRect(14, 50, bw, 6, 3);
  ctx.fill();
  ctx.fillStyle = pct > 0.5 ? "#22e4ff" : pct > 0.25 ? "#ffc23a" : "#ff3b5c";
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 8;
  roundRect(14, 50, bw * pct, 6, 3);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawEnemies() {
  const left = G.queue.length - G.q;
  const visibleRows = Math.max(1, Math.floor((L.shieldY - L.enemyTop - 24) / L.rowH));
  const maxShown = visibleRows * L.perRow + L.perRow;
  if (G.cfg.boss) drawMothership();
  for (let k = Math.min(G.queue.length - 1, G.q + maxShown); k >= G.q; k--) {
    const slot = k - G.qAnim;
    const [x, y] = enemySlotPos(slot);
    if (y < L.enemyTop + 6) continue;
    drawAlien(x, y + Math.sin(G.t * 3 + k) * 2, L.sx * 0.36, COLORS[G.queue[k]], k === G.q);
  }
  if (left > maxShown) {
    ctx.fillStyle = "#8ea3d6";
    ctx.font = "700 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`+${left - maxShown} more incoming`, L.W / 2, L.enemyTop + 12);
  }
}

function drawMothership() {
  const x = L.W / 2;
  const y = L.enemyTop + 26;
  const w = Math.min(L.W * 0.8, 320);
  ctx.save();
  ctx.globalAlpha = 0.45 + 0.1 * Math.sin(G.t * 2);
  const g = ctx.createLinearGradient(x - w / 2, y, x + w / 2, y);
  g.addColorStop(0, "#3a0d1a");
  g.addColorStop(0.5, "#8a1730");
  g.addColorStop(1, "#3a0d1a");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = -3; i <= 3; i++) {
    ctx.fillStyle = Math.sin(G.t * 6 + i) > 0 ? "#ff3b5c" : "#5a1020";
    ctx.beginPath();
    ctx.arc(x + i * (w / 8), y + 6, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawAlien(x, y, r, c, front) {
  ctx.save();
  ctx.translate(x, y);
  if (front) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.45, G.t * 2, G.t * 2 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.shadowColor = c.main;
  ctx.shadowBlur = 10;
  // saucer
  ctx.fillStyle = c.dark;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.25, r, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.main;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.12, r * 0.92, r * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // dome
  ctx.fillStyle = "rgba(220, 245, 255, 0.85)";
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.1, r * 0.45, r * 0.42, 0, Math.PI, 0);
  ctx.fill();
  // eyes
  ctx.fillStyle = c.dark;
  ctx.beginPath();
  ctx.arc(-r * 0.15, -r * 0.2, r * 0.08, 0, Math.PI * 2);
  ctx.arc(r * 0.15, -r * 0.2, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  // lights
  ctx.fillStyle = c.glow;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(i * r * 0.36, r * 0.28, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawShield() {
  const y = L.shieldY;
  const hot = G.threat >= 1;
  const a = 0.4 + 0.25 * Math.sin(G.t * (hot ? 18 : 3));
  ctx.strokeStyle = hot ? `rgba(255, 59, 92, ${a + 0.3})` : `rgba(34, 228, 255, ${a})`;
  ctx.lineWidth = 2;
  ctx.shadowColor = hot ? "#ff3b5c" : "#22e4ff";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  for (let x = 8; x <= L.W - 8; x += 6) {
    const yy = y + Math.sin(x * 0.05 + G.t * 4) * 1.5;
    if (x === 8) ctx.moveTo(x, yy);
    else ctx.lineTo(x, yy);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  // threat meter on the left edge of the enemy zone
  if (G.cfg.creep > 0) {
    const top = L.enemyTop + 6;
    const h = y - top - 6;
    ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
    roundRect(6, top, 4, h, 2);
    ctx.fill();
    ctx.fillStyle = G.threat > 0.8 ? "#ff3b5c" : G.threat > 0.5 ? "#ffc23a" : "#7dff4a";
    roundRect(6, top + h * (1 - G.threat), 4, h * G.threat, 2);
    ctx.fill();
  }
}

function drawBays() {
  const shakeX = G.bayShake > 0 ? Math.sin(G.t * 70) * 5 * (G.bayShake / 0.35) : 0;
  for (let i = 0; i < G.bays.length; i++) {
    const b = G.bays[i];
    const x = bayX(i) + shakeX;
    const y = L.bayY;
    const w = L.bayW;
    const h = L.bayH;
    ctx.save();
    if (b) {
      const c = COLORS[b.color];
      ctx.fillStyle = c.dark + "55";
      ctx.strokeStyle = c.main;
      ctx.shadowColor = c.main;
      ctx.shadowBlur = b.ready ? 14 : 4;
    } else {
      ctx.fillStyle = "rgba(20, 30, 70, 0.35)";
      ctx.strokeStyle = G.alert ? "rgba(255, 59, 92, 0.7)" : "rgba(120, 150, 230, 0.45)";
      ctx.setLineDash([5, 4]);
    }
    ctx.lineWidth = 2;
    roundRect(x - w / 2, y - h / 2, w, h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (b && b.ready) {
      const s = G.ships[b.ship];
      const recoil = b.recoil * 4;
      drawShip(x, y + recoil, -Math.PI / 2, h * 0.82, w * 0.62, COLORS[s.color], { engine: 1 });
    }
    if (b) {
      // shots left, like a seat counter
      const c = COLORS[b.color];
      const bx = x;
      const by = y + h / 2 + 12;
      ctx.fillStyle = c.main;
      roundRect(bx - 17, by - 9, 34, 18, 6);
      ctx.fill();
      ctx.fillStyle = "#06101c";
      ctx.font = "900 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(b.ammo), bx, by + 1);
    }
  }
}

function drawGrid() {
  const { cols, rows } = G.cfg;
  const { gx, gy, cell } = L;
  ctx.save();
  ctx.fillStyle = "rgba(14, 20, 46, 0.85)";
  ctx.strokeStyle = "rgba(34, 228, 255, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.shadowColor = "#22e4ff";
  ctx.shadowBlur = 10;
  roundRect(gx - 8, gy - 8, cols * cell + 16, rows * cell + 16, 14);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = "rgba(120, 150, 230, 0.08)";
  ctx.lineWidth = 1;
  for (let i = 1; i < cols; i++) {
    ctx.beginPath();
    ctx.moveTo(gx + i * cell, gy);
    ctx.lineTo(gx + i * cell, gy + rows * cell);
    ctx.stroke();
  }
  for (let j = 1; j < rows; j++) {
    ctx.beginPath();
    ctx.moveTo(gx, gy + j * cell);
    ctx.lineTo(gx + cols * cell, gy + j * cell);
    ctx.stroke();
  }
  for (const s of G.ships) {
    if (s.state !== "grid" && s.state !== "bounce") continue;
    let [x, y] = shipCenter(s);
    if (s.state === "bounce") {
      const k = s.anim.t / s.anim.dur;
      const off = s.anim.dist * Math.sin(Math.PI * k);
      x += DIRS[s.dir][0] * off;
      y += DIRS[s.dir][1] * off;
    }
    const pad = cell * 0.1;
    drawShip(x, y, dirAngle[s.dir], s.len * cell - pad, cell - pad * 1.6, COLORS[s.color], { arrow: true, flash: s.flash, engine: 0.35 });
  }
  // First sectors: after a few idle seconds, pulse the ship the intended solution launches next.
  if (G.n <= 2 && G.phase === "play" && G.t - G.lastTap > 4) {
    const hint = G.solution.map((id) => G.ships[id]).find((s) => s.state === "grid");
    if (hint) {
      const [x, y] = shipCenter(hint);
      const k = (G.t * 1.5) % 1;
      ctx.strokeStyle = `rgba(255, 255, 255, ${1 - k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, cell * (0.5 + k * 0.6) * (hint.len / 2 + 0.3), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawFlying(s) {
  const p = flightPose(s);
  const lenGrid = s.len * L.cell - L.cell * 0.1;
  const widGrid = L.cell * 0.84;
  const len = lenGrid + (L.bayH * 0.82 - lenGrid) * p.scale;
  const wid = widGrid + (L.bayW * 0.62 - widGrid) * p.scale;
  drawShip(p.x, p.y, p.ang, len, wid, COLORS[s.color], { engine: 1.6, arrow: p.scale < 0.3 });
}

/** A ship pointing along `ang` (0 = right), `len` long and `wid` wide, centered on x, y. */
function drawShip(x, y, ang, len, wid, c, opt = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const hl = len / 2;
  const hw = wid / 2;
  // engine flame at the back
  if (opt.engine) {
    const fl = hw * (0.8 + Math.random() * 0.5) * opt.engine;
    const g = ctx.createLinearGradient(-hl, 0, -hl - fl * 1.6, 0);
    g.addColorStop(0, c.glow);
    g.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-hl + 2, -hw * 0.38);
    ctx.lineTo(-hl - fl * 1.6, 0);
    ctx.lineTo(-hl + 2, hw * 0.38);
    ctx.fill();
  }
  ctx.shadowColor = c.main;
  ctx.shadowBlur = opt.flash > 0 ? 22 : 8;
  // wings
  ctx.fillStyle = c.dark;
  ctx.beginPath();
  ctx.moveTo(-hl * 0.15, -hw * 0.55);
  ctx.lineTo(-hl * 0.95, -hw);
  ctx.lineTo(-hl, -hw * 0.5);
  ctx.lineTo(-hl, hw * 0.5);
  ctx.lineTo(-hl * 0.95, hw);
  ctx.lineTo(-hl * 0.15, hw * 0.55);
  ctx.closePath();
  ctx.fill();
  // hull: long body with a pointed nose
  const body = ctx.createLinearGradient(0, -hw, 0, hw);
  body.addColorStop(0, c.glow);
  body.addColorStop(0.45, c.main);
  body.addColorStop(1, c.dark);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(hl, 0);
  ctx.quadraticCurveTo(hl * 0.7, -hw * 0.72, hl * 0.3, -hw * 0.72);
  ctx.lineTo(-hl * 0.88, -hw * 0.62);
  ctx.quadraticCurveTo(-hl, -hw * 0.62, -hl, -hw * 0.4);
  ctx.lineTo(-hl, hw * 0.4);
  ctx.quadraticCurveTo(-hl, hw * 0.62, -hl * 0.88, hw * 0.62);
  ctx.lineTo(hl * 0.3, hw * 0.72);
  ctx.quadraticCurveTo(hl * 0.7, hw * 0.72, hl, 0);
  ctx.fill();
  ctx.shadowBlur = 0;
  // panel line
  ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-hl * 0.85, 0);
  ctx.lineTo(hl * 0.25, 0);
  ctx.stroke();
  // cockpit
  ctx.fillStyle = "rgba(10, 20, 40, 0.85)";
  ctx.beginPath();
  ctx.ellipse(hl * 0.55, 0, Math.min(hl * 0.22, hw * 0.9), hw * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(200, 245, 255, 0.7)";
  ctx.beginPath();
  ctx.ellipse(hl * 0.6, -hw * 0.1, Math.min(hl * 0.1, hw * 0.4), hw * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  if (opt.flash > 0) {
    ctx.fillStyle = `rgba(255, 60, 80, ${Math.min(1, opt.flash * 2) * (0.5 + 0.5 * Math.sin(G.t * 40))})`;
    ctx.fillRect(-hl, -hw, len, wid);
  }
  // direction arrow
  if (opt.arrow) {
    const s = Math.min(hw * 0.9, len * 0.22);
    const ax = -hl * 0.25;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax + s, 0);
    ctx.lineTo(ax, -s * 0.75);
    ctx.lineTo(ax, -s * 0.3);
    ctx.lineTo(ax - s * 0.9, -s * 0.3);
    ctx.lineTo(ax - s * 0.9, s * 0.3);
    ctx.lineTo(ax, s * 0.3);
    ctx.lineTo(ax, s * 0.75);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }
  ctx.restore();
}

function drawFx() {
  for (const b of fx.beams) {
    const a = 1 - b.t / 0.12;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = b.glow;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }
  for (const p of fx.particles) {
    ctx.globalAlpha = 1 - p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const r of fx.rings) {
    const k = r.t / 0.4;
    ctx.strokeStyle = r.color;
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = 2.5 * (1 - k) + 0.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.maxR * (0.3 + k * 0.7), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const w of fx.warps) {
    // warping away: stretches upward and fades
    const k = w.t / 0.45;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    drawShip(w.x, w.y - k * k * L.H * 0.4, -Math.PI / 2, L.bayH * 0.82 * (1 + k * 2.5), L.bayW * 0.62 * (1 - k * 0.6), COLORS[w.color], { engine: 3 });
    ctx.restore();
  }
  for (const t of fx.texts) {
    const k = t.t / t.life;
    const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15) * 0.3);
    ctx.save();
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.translate(t.x, t.y - k * 30);
    ctx.scale(pop, pop);
    ctx.font = `900 ${t.size}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
    ctx.strokeText(t.text, 0, 0);
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }
}

function roundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- screens ----------
const overlays = ["menu", "pause", "win", "lose"];
function showOnly(id) {
  for (const o of overlays) $(o).classList.toggle("show", o === id);
}
function showMenu() {
  G.phase = "menu";
  $("pauseBtn").classList.remove("show");
  const total = Object.values(save.stars).reduce((a, b) => a + b, 0);
  $("menuLevel").textContent = `Sector ${save.level}${total ? `  ·  ★ ${total}` : ""}${save.best ? `  ·  Best ${save.best.toLocaleString()}` : ""}`;
  showOnly("menu");
}
function pause() {
  if (G.phase !== "play") return;
  G.phase = "pause";
  $("pauseInfo").textContent = `Sector ${G.n}  ·  ${G.queue.length - G.q} enemies left`;
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
    if (audio && audio.state === "suspended") audio.resume();
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
onTap("retryBtn", () => startLevel(G.n));
onTap("loseMenuBtn", showMenu);
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

// Android back button: pause first, then resume / go to the menu; on the menu the app closes.
window.__back = () => {
  if (G.phase === "play") return pause(), true;
  if (G.phase === "pause") return resume(), true;
  if (G.phase === "win" || G.phase === "lose") return showMenu(), true;
  return false;
};
window.__pause = pause;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});

// Hook for automated checks (drives the game without touch input).
window.__sifi = {
  state: () => ({ phase: G.phase, n: G.n, q: G.q, total: G.queue && G.queue.length, bays: G.bays, hull: G.hull, score: G.score }),
  solution: () => G.solution.slice(),
  tap: (id) => tapShip(id),
  start: (n) => startLevel(n),
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
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
