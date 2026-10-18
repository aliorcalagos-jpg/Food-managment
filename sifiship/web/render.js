// SIFIship visuals: rockets, saucers, landing pads, the hangar floor and the backdrop. Everything detailed is
// painted once into an offscreen canvas (a sprite) and cached, so a frame only stamps images: 70 rockets with
// metal shading, glass and glowing engines cost about as much as 70 rectangles.
import { COLORS } from "./logic.js";

// Older Android WebViews lack roundRect.
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(typeof r === "number" ? r : 0, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}

let dpr = 1;
const cache = new Map();

export function setDpr(value) {
  if (value !== dpr) cache.clear();
  dpr = value;
}

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const g = c.getContext("2d");
  g.scale(dpr, dpr);
  return [c, g];
}

function cached(key, make) {
  let v = cache.get(key);
  if (!v) cache.set(key, (v = make()));
  return v;
}

// ---------- color helpers ----------
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a, b, k) {
  const x = rgb(a);
  const y = rgb(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(",")})`;
}
export function rgba(hex, a) {
  return `rgba(${rgb(hex).join(",")},${a})`;
}
function tones(colorIndex) {
  const c = COLORS[colorIndex];
  return {
    ...c,
    light: mix(c.main, "#ffffff", 0.5),
    deep: mix(c.dark, "#000000", 0.45),
  };
}

/** Stamps a sprite centered on (x, y), rotated by `ang` (0 = pointing right). */
export function drawSprite(ctx, spr, x, y, ang = 0, sx = 1, sy = sx, alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  if (ang) ctx.rotate(ang);
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  const w = spr.img.width / dpr;
  const h = spr.img.height / dpr;
  ctx.drawImage(spr.img, -spr.cx * sx, -spr.cy * sy, w * sx, h * sy);
  ctx.restore();
}

// ---------- rocket hulls ----------
// Each hull is drawn pointing right in a box of half-length 1 and half-width 1 (scaled to the rocket), as
// wings (under), hull (over), canopy and engines. Lighting comes from the top-left of the screen... of the
// sprite, which is good enough at this size and keeps every hull consistent.
const HULLS = {
  interceptor: {
    wings: [[[-0.1, -0.34], [-0.72, -1], [-0.95, -0.96], [-0.86, -0.3]]],
    hull(p) {
      p.moveTo(1, 0);
      p.quadraticCurveTo(0.82, -0.44, 0.38, -0.44);
      p.lineTo(-0.84, -0.38);
      p.quadraticCurveTo(-1, -0.38, -1, -0.2);
      p.lineTo(-1, 0.2);
      p.quadraticCurveTo(-1, 0.38, -0.84, 0.38);
      p.lineTo(0.38, 0.44);
      p.quadraticCurveTo(0.82, 0.44, 1, 0);
    },
    canopy: [0.46, 0, 0.24, 0.22],
    engines: [[-1, 0, 0.17]],
    panels: [-0.15, -0.52],
    lights: [[-0.88, -0.94], [-0.88, 0.94]],
  },
  falcon: {
    wings: [[[-0.62, -0.3], [0.08, -0.98], [-0.14, -1], [-0.86, -0.42]]],
    pods: [[-1, -0.46, 0.5, 0.22]],
    hull(p) {
      p.moveTo(1, 0);
      p.quadraticCurveTo(0.7, -0.36, 0.28, -0.36);
      p.lineTo(-0.9, -0.32);
      p.lineTo(-0.96, 0);
      p.lineTo(-0.9, 0.32);
      p.lineTo(0.28, 0.36);
      p.quadraticCurveTo(0.7, 0.36, 1, 0);
    },
    canopy: [0.42, 0, 0.26, 0.18],
    engines: [[-1, -0.46, 0.15], [-1, 0.46, 0.15]],
    panels: [-0.2, -0.6],
    lights: [[0.02, -0.97], [0.02, 0.97]],
  },
  phantom: {
    wings: [[[0.55, -0.12], [-0.62, -1], [-1, -0.92], [-0.76, -0.22]]],
    facets: true,
    hull(p) {
      p.moveTo(1, 0);
      p.lineTo(0.3, -0.34);
      p.lineTo(-0.8, -0.4);
      p.lineTo(-1, -0.16);
      p.lineTo(-1, 0.16);
      p.lineTo(-0.8, 0.4);
      p.lineTo(0.3, 0.34);
      p.closePath();
    },
    canopy: [0.34, 0, 0.2, 0.16],
    engines: [[-1, -0.1, 0.1], [-1, 0.1, 0.1]],
    panels: [-0.35],
    lights: [[-0.96, -0.9], [-0.96, 0.9]],
  },
  titan: {
    wings: [[[-0.25, -0.4], [-0.35, -0.72], [-0.7, -0.72], [-0.7, -0.4]]],
    pods: [[-0.96, -0.82, 1.2, 0.3]],
    hull(p) {
      p.moveTo(0.96, -0.2);
      p.quadraticCurveTo(1, 0, 0.96, 0.2);
      p.lineTo(0.62, 0.46);
      p.lineTo(-0.9, 0.46);
      p.lineTo(-1, 0.3);
      p.lineTo(-1, -0.3);
      p.lineTo(-0.9, -0.46);
      p.lineTo(0.62, -0.46);
      p.closePath();
    },
    canopy: [0.5, 0, 0.18, 0.24],
    engines: [[-1, -0.22, 0.12], [-1, 0.22, 0.12], [-0.96, -0.82, 0.12], [-0.96, 0.82, 0.12]],
    panels: [0.1, -0.3, -0.65],
    lights: [[0.22, -0.95], [0.22, 0.95]],
  },
  nova: {
    wings: [[[-0.35, -0.24], [-0.82, -0.86], [-0.98, -0.8], [-0.78, -0.24]]],
    halo: true,
    hull(p) {
      p.moveTo(1, 0);
      p.quadraticCurveTo(0.6, -0.26, 0.1, -0.28);
      p.lineTo(-0.92, -0.24);
      p.quadraticCurveTo(-1, -0.2, -1, 0);
      p.quadraticCurveTo(-1, 0.2, -0.92, 0.24);
      p.lineTo(0.1, 0.28);
      p.quadraticCurveTo(0.6, 0.26, 1, 0);
    },
    canopy: [0.38, 0, 0.26, 0.14],
    engines: [[-1, 0, 0.14]],
    panels: [-0.3],
    lights: [[-0.9, -0.84], [-0.9, 0.84]],
  },
};

function polyPath(g, pts, sx, sy, mirror) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x * sx, y * sy * mirror) : g.moveTo(x * sx, y * sy * mirror)));
  g.closePath();
}

function hullPath(g, hull, sx, sy) {
  g.beginPath();
  const p = {
    moveTo: (x, y) => g.moveTo(x * sx, y * sy),
    lineTo: (x, y) => g.lineTo(x * sx, y * sy),
    quadraticCurveTo: (a, b, x, y) => g.quadraticCurveTo(a * sx, b * sy, x * sx, y * sy),
    closePath: () => g.closePath(),
  };
  hull.hull(p);
  g.closePath();
}

function paintShip(g, skinId, colorIndex, L, W) {
  const hull = HULLS[skinId] || HULLS.interceptor;
  const t = tones(colorIndex);
  const sx = L / 2;
  const sy = W / 2;

  // Wings, both sides, darker metal with a lit leading edge and a tip light.
  for (const wing of hull.wings)
    for (const m of [1, -1]) {
      polyPath(g, wing, sx, sy, m);
      const wg = g.createLinearGradient(0, -sy * m, 0, 0);
      wg.addColorStop(0, t.deep);
      wg.addColorStop(1, t.dark);
      g.fillStyle = wg;
      g.fill();
      g.strokeStyle = "rgba(0,0,0,0.55)";
      g.lineWidth = 1;
      g.stroke();
      g.strokeStyle = rgba(t.glow, 0.35);
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(wing[0][0] * sx, wing[0][1] * sy * m);
      g.lineTo(wing[1][0] * sx, wing[1][1] * sy * m);
      g.stroke();
    }

  // Engine pods (Falcon, Titan)
  for (const [px, py, pl, pw] of hull.pods || [])
    for (const m of [1, -1]) {
      const x = px * sx;
      const y = py * sy * m - (pw * sy) / 2;
      const pg = g.createLinearGradient(0, y, 0, y + pw * sy);
      pg.addColorStop(0, t.light);
      pg.addColorStop(0.45, t.main);
      pg.addColorStop(1, t.deep);
      g.fillStyle = pg;
      g.beginPath();
      g.roundRect(x, y, pl * sx, pw * sy, (pw * sy) / 2);
      g.fill();
      g.strokeStyle = "rgba(0,0,0,0.5)";
      g.lineWidth = 1;
      g.stroke();
    }

  // Hull: cylinder shading across, a darker tail along, soft contact shadow on the wings.
  hullPath(g, hull, sx, sy);
  g.save();
  g.shadowColor = "rgba(0,0,0,0.6)";
  g.shadowBlur = W * 0.12;
  const hg = g.createLinearGradient(0, -sy * 0.5, 0, sy * 0.5);
  hg.addColorStop(0, t.light);
  hg.addColorStop(0.32, t.main);
  hg.addColorStop(0.72, t.dark);
  hg.addColorStop(1, t.deep);
  g.fillStyle = hg;
  g.fill();
  g.restore();
  g.save();
  hullPath(g, hull, sx, sy);
  g.clip();
  if (hull.facets) {
    // Stealth facets: the lower half sits in shade, split by a hard crease.
    g.fillStyle = "rgba(0,0,0,0.28)";
    g.fillRect(-sx, 0, L, sy);
    g.strokeStyle = rgba("#ffffff", 0.25);
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(sx, 0);
    g.lineTo(-sx, 0);
    g.stroke();
  }
  const along = g.createLinearGradient(sx, 0, -sx, 0);
  along.addColorStop(0, "rgba(255,255,255,0.12)");
  along.addColorStop(0.5, "rgba(0,0,0,0)");
  along.addColorStop(1, "rgba(0,0,0,0.35)");
  g.fillStyle = along;
  g.fillRect(-sx, -sy, L, W);
  // Specular streak along the spine
  const spec = g.createLinearGradient(0, -sy * 0.34, 0, -sy * 0.04);
  spec.addColorStop(0, "rgba(255,255,255,0)");
  spec.addColorStop(0.5, "rgba(255,255,255,0.55)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = spec;
  g.fillRect(-sx * 0.8, -sy * 0.34, L * 0.82, sy * 0.3);
  // Panel lines and rivets
  g.strokeStyle = "rgba(0,0,0,0.35)";
  g.lineWidth = 0.7;
  for (const px of hull.panels) {
    g.beginPath();
    g.moveTo(px * sx, -sy);
    g.lineTo(px * sx, sy);
    g.stroke();
  }
  g.fillStyle = "rgba(255,255,255,0.35)";
  for (const px of hull.panels)
    for (const py of [-0.22, 0.22]) {
      g.beginPath();
      g.arc(px * sx + 1.6, py * sy, Math.max(0.5, W * 0.018), 0, Math.PI * 2);
      g.fill();
    }
  g.restore();
  // Rim: a dark outline keeps rockets apart in a packed hangar; a thin light edge gives the metal a bevel.
  hullPath(g, hull, sx, sy);
  g.strokeStyle = "rgba(0,0,0,0.6)";
  g.lineWidth = 1.2;
  g.stroke();
  g.save();
  g.clip();
  hullPath(g, hull, sx, sy);
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 1.4;
  g.translate(0.4, 0.6);
  g.stroke();
  g.restore();

  // Halo fins (Nova)
  if (hull.halo) {
    g.strokeStyle = rgba(t.glow, 0.85);
    g.lineWidth = Math.max(1, W * 0.05);
    g.shadowColor = t.glow;
    g.shadowBlur = W * 0.25;
    g.beginPath();
    g.ellipse(-sx * 0.25, 0, sx * 0.16, sy * 0.78, 0, 0, Math.PI * 2);
    g.stroke();
    g.shadowBlur = 0;
  }

  // Canopy: dark glass with a tinted depth and a bright reflection.
  const [cx, cy, crx, cry] = hull.canopy;
  const rx = Math.min(crx * sx, cry * sy * 2.2);
  const ry = cry * sy;
  const cg = g.createLinearGradient(cx * sx, -ry, cx * sx, ry);
  cg.addColorStop(0, "#1b2f55");
  cg.addColorStop(0.55, "#070d1f");
  cg.addColorStop(1, mix(t.dark, "#000000", 0.3));
  g.fillStyle = cg;
  g.beginPath();
  g.ellipse(cx * sx, cy * sy, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.6)";
  g.lineWidth = 0.8;
  g.stroke();
  g.fillStyle = "rgba(190,240,255,0.75)";
  g.beginPath();
  g.ellipse(cx * sx + rx * 0.15, cy * sy - ry * 0.42, rx * 0.5, ry * 0.2, -0.12, 0, Math.PI * 2);
  g.fill();

  // Engines: dark nozzles with a hot core.
  for (const [ex, ey, er] of hull.engines) {
    const x = ex * sx;
    const y = ey * sy;
    const r = er * sy * 1.1;
    g.fillStyle = "#0b0f1a";
    g.beginPath();
    g.ellipse(x + r * 0.2, y, r * 0.55, r, 0, 0, Math.PI * 2);
    g.fill();
    const eg = g.createRadialGradient(x, y, 0, x, y, r * 1.1);
    eg.addColorStop(0, "#ffffff");
    eg.addColorStop(0.35, t.glow);
    eg.addColorStop(1, rgba(t.main, 0));
    g.fillStyle = eg;
    g.beginPath();
    g.ellipse(x, y, r * 0.5, r * 0.9, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Navigation lights
  for (const [lx, ly] of hull.lights) {
    const x = lx * sx;
    const y = ly * sy;
    const lg = g.createRadialGradient(x, y, 0, x, y, W * 0.12);
    lg.addColorStop(0, "#ffffff");
    lg.addColorStop(0.3, t.glow);
    lg.addColorStop(1, rgba(t.glow, 0));
    g.fillStyle = lg;
    g.beginPath();
    g.arc(x, y, W * 0.12, 0, Math.PI * 2);
    g.fill();
  }

}

/** A rocket sprite: `L` × `W` CSS px, pointing right. (Its direction chevrons are drawn live on top.) */
export function shipSprite(skin, colorIndex, L, W) {
  L = Math.round(L);
  W = Math.round(W);
  return cached(`ship|${skin}|${colorIndex}|${L}|${W}`, () => {
    const pad = Math.ceil(W * 0.2);
    const [c, g] = canvas(L + pad * 2, W + pad * 2);
    g.translate(pad + L / 2, pad + W / 2);
    paintShip(g, skin, colorIndex, L, W);
    return { img: c, cx: pad + L / 2, cy: pad + W / 2 };
  });
}

/**
 * One direction chevron, pointing right, `size` px long. "ready" (the way out is clear) is a glowing white
 * holographic chevron; "idle" (blocked) is a dark inlay with a light rim, so free rockets read at a glance.
 */
export function chevronSprite(kind, size) {
  size = Math.max(4, Math.round(size));
  return cached(`chev|${kind}|${size}`, () => {
    const pad = Math.ceil(size * 0.6);
    const [c, g] = canvas(size + pad * 2, size * 1.2 + pad * 2);
    g.translate(pad + size / 2, pad + size * 0.6);
    const s = size;
    g.beginPath();
    g.moveTo(s * 0.5, 0);
    g.lineTo(-s * 0.06, -s * 0.56);
    g.lineTo(-s * 0.5, -s * 0.56);
    g.lineTo(s * 0.06, 0);
    g.lineTo(-s * 0.5, s * 0.56);
    g.lineTo(-s * 0.06, s * 0.56);
    g.closePath();
    g.lineJoin = "round";
    if (kind === "ready") {
      g.shadowColor = "#7cf3ff";
      g.shadowBlur = s * 0.55;
      const fg = g.createLinearGradient(0, -s * 0.56, 0, s * 0.56);
      fg.addColorStop(0, "#ffffff");
      fg.addColorStop(0.5, "#e6fdff");
      fg.addColorStop(1, "#9cefff");
      g.fillStyle = fg;
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = "rgba(0,40,70,0.7)";
      g.lineWidth = Math.max(0.8, s * 0.07);
      g.stroke();
    } else {
      // blocked: a dark inlay with a bright rim, so the direction still reads on any hull color
      const fg = g.createLinearGradient(0, -s * 0.56, 0, s * 0.56);
      fg.addColorStop(0, "#2a3452");
      fg.addColorStop(1, "#0d1222");
      g.fillStyle = fg;
      g.fill();
      g.strokeStyle = "rgba(220,232,255,0.8)";
      g.lineWidth = Math.max(1, s * 0.09);
      g.stroke();
    }
    return { img: c, cx: pad + size / 2, cy: pad + size * 0.6 };
  });
}

/** The rocket's soft drop shadow (drawn first, offset down-right in screen space). */
export function shadowSprite(skin, L, W) {
  L = Math.round(L);
  W = Math.round(W);
  return cached(`shadow|${skin}|${L}|${W}`, () => {
    const hull = HULLS[skin] || HULLS.interceptor;
    const pad = Math.ceil(W * 0.5);
    const [c, g] = canvas(L + pad * 2, W + pad * 2);
    g.translate(pad + L / 2, pad + W / 2);
    g.filter = `blur(${Math.max(1.5, W * 0.1)}px)`;
    g.fillStyle = "rgba(0,0,0,0.55)";
    for (const wing of hull.wings)
      for (const m of [1, -1]) {
        polyPath(g, wing, L / 2, W / 2, m);
        g.fill();
      }
    hullPath(g, hull, L / 2, W / 2);
    g.fill();
    return { img: c, cx: pad + L / 2, cy: pad + W / 2 };
  });
}

/** A soft round light, for engine flames, muzzle flashes and explosions (drawn additively). */
export function glowSprite(color, r) {
  r = Math.max(2, Math.round(r));
  return cached(`glow|${color}|${r}`, () => {
    const [c, g] = canvas(r * 2, r * 2);
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, "rgba(255,255,255,0.95)");
    gr.addColorStop(0.18, rgba(color, 0.85));
    gr.addColorStop(0.5, rgba(color, 0.25));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, r * 2, r * 2);
    return { img: c, cx: r, cy: r };
  });
}

/** An enemy saucer seen from above at a slight angle. */
export function saucerSprite(colorIndex, r) {
  r = Math.max(4, Math.round(r));
  return cached(`saucer|${colorIndex}|${r}`, () => {
    const t = tones(colorIndex);
    const pad = Math.ceil(r * 0.45);
    const [c, g] = canvas(r * 2 + pad * 2, r * 1.5 + pad * 2);
    const x = pad + r;
    const y = pad + r * 0.75;
    // underglow
    const ug = g.createRadialGradient(x, y + r * 0.2, 0, x, y + r * 0.2, r * 1.3);
    ug.addColorStop(0, rgba(t.main, 0.55));
    ug.addColorStop(1, rgba(t.main, 0));
    g.fillStyle = ug;
    g.fillRect(0, 0, c.width, c.height);
    // body
    const bg = g.createRadialGradient(x - r * 0.35, y - r * 0.3, r * 0.1, x, y, r * 1.05);
    bg.addColorStop(0, t.light);
    bg.addColorStop(0.45, t.main);
    bg.addColorStop(0.85, t.dark);
    bg.addColorStop(1, t.deep);
    g.fillStyle = bg;
    g.beginPath();
    g.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.6)";
    g.lineWidth = 1.2;
    g.stroke();
    // inner plate
    const pg = g.createLinearGradient(x, y - r * 0.4, x, y + r * 0.4);
    pg.addColorStop(0, "#3a4566");
    pg.addColorStop(1, "#141a2c");
    g.fillStyle = pg;
    g.beginPath();
    g.ellipse(x, y + r * 0.02, r * 0.62, r * 0.36, 0, 0, Math.PI * 2);
    g.fill();
    // rim lights
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const lx = x + Math.cos(a) * r * 0.82;
      const ly = y + Math.sin(a) * r * 0.49;
      const lg = g.createRadialGradient(lx, ly, 0, lx, ly, r * 0.13);
      lg.addColorStop(0, "#ffffff");
      lg.addColorStop(0.4, t.glow);
      lg.addColorStop(1, rgba(t.glow, 0));
      g.fillStyle = lg;
      g.beginPath();
      g.arc(lx, ly, r * 0.13, 0, Math.PI * 2);
      g.fill();
    }
    // dome
    const dg = g.createRadialGradient(x - r * 0.12, y - r * 0.28, r * 0.02, x, y - r * 0.1, r * 0.42);
    dg.addColorStop(0, "#ffffff");
    dg.addColorStop(0.25, mix(t.glow, "#ffffff", 0.3));
    dg.addColorStop(0.7, rgba(t.main, 0.85));
    dg.addColorStop(1, rgba(t.dark, 0.9));
    g.fillStyle = dg;
    g.beginPath();
    g.ellipse(x, y - r * 0.12, r * 0.38, r * 0.32, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.45)";
    g.lineWidth = 0.8;
    g.stroke();
    return { img: c, cx: x, cy: y };
  });
}

/** A landing pad for a launch bay. */
export function padSprite(w, h) {
  w = Math.round(w);
  h = Math.round(h);
  return cached(`pad|${w}|${h}`, () => {
    const [c, g] = canvas(w + 8, h + 8);
    g.translate(4, 4);
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#1f2945");
    bg.addColorStop(1, "#0c1122");
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(0, 0, w, h, 12);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.08)";
    g.lineWidth = 1;
    g.stroke();
    g.strokeStyle = "rgba(0,0,0,0.6)";
    g.beginPath();
    g.roundRect(1.5, 1.5, w - 3, h - 3, 11);
    g.stroke();
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.38;
    for (const k of [1, 0.72, 0.44]) {
      g.strokeStyle = `rgba(140,170,255,${0.06 + (1 - k) * 0.08})`;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, r * k, 0, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = "rgba(140,170,255,0.12)";
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85);
      g.lineTo(cx + Math.cos(a) * r * 1.12, cy + Math.sin(a) * r * 1.12);
      g.stroke();
    }
    // hazard corners
    g.fillStyle = "rgba(255,194,58,0.55)";
    for (const [x, y, sx, sy] of [[5, 5, 1, 1], [w - 5, 5, -1, 1], [5, h - 5, 1, -1], [w - 5, h - 5, -1, -1]]) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 8 * sx, y);
      g.lineTo(x, y + 8 * sy);
      g.closePath();
      g.fill();
    }
    return { img: c, cx: w / 2 + 4, cy: h / 2 + 4 };
  });
}

/** The hangar floor: beveled steel plates per cell, rivets, a heavy frame with hazard stripes and edge lights. */
export function hangarTexture(cols, rows, cell) {
  return cached(`hangar|${cols}|${rows}|${cell}`, () => {
    const f = Math.max(8, Math.round(cell * 0.32));
    const w = cols * cell + f * 2;
    const h = rows * cell + f * 2;
    const [c, g] = canvas(w, h);
    // frame
    const fg = g.createLinearGradient(0, 0, 0, h);
    fg.addColorStop(0, "#2a3554");
    fg.addColorStop(0.5, "#161d33");
    fg.addColorStop(1, "#232c48");
    g.fillStyle = fg;
    g.beginPath();
    g.roundRect(0, 0, w, h, f);
    g.fill();
    // hazard stripes on the frame
    g.save();
    g.beginPath();
    g.roundRect(0, 0, w, h, f);
    g.roundRect(f * 0.55, f * 0.55, w - f * 1.1, h - f * 1.1, f * 0.6);
    g.clip("evenodd");
    g.globalAlpha = 0.22;
    g.fillStyle = "#ffc23a";
    for (let x = -h; x < w + h; x += f * 1.4) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + f * 0.7, 0);
      g.lineTo(x + f * 0.7 - h, h);
      g.lineTo(x - h, h);
      g.closePath();
      g.fill();
    }
    g.restore();
    // floor plates
    g.fillStyle = "#0a0f1f";
    g.fillRect(f, f, cols * cell, rows * cell);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const px = f + x * cell;
        const py = f + y * cell;
        const pg = g.createLinearGradient(px, py, px + cell, py + cell);
        const v = ((x * 7 + y * 13) % 5) * 0.006;
        pg.addColorStop(0, `rgba(70,90,140,${0.2 + v})`);
        pg.addColorStop(1, `rgba(20,28,50,${0.25 + v})`);
        g.fillStyle = pg;
        g.fillRect(px + 1, py + 1, cell - 2, cell - 2);
        g.strokeStyle = "rgba(255,255,255,0.05)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(px + 1.5, py + cell - 1.5);
        g.lineTo(px + 1.5, py + 1.5);
        g.lineTo(px + cell - 1.5, py + 1.5);
        g.stroke();
        g.strokeStyle = "rgba(0,0,0,0.45)";
        g.beginPath();
        g.moveTo(px + cell - 1.5, py + 1.5);
        g.lineTo(px + cell - 1.5, py + cell - 1.5);
        g.lineTo(px + 1.5, py + cell - 1.5);
        g.stroke();
        if (cell > 22) {
          g.fillStyle = "rgba(160,180,230,0.12)";
          for (const [rx, ry] of [[4, 4], [cell - 4, 4], [4, cell - 4], [cell - 4, cell - 4]]) {
            g.beginPath();
            g.arc(px + rx, py + ry, 0.9, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    // inner shadow at the floor edge
    const s = Math.max(6, cell * 0.4);
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [
      [0, f, 0, f + s, f, f, cols * cell, s],
      [0, f + rows * cell, 0, f + rows * cell - s, f, f + rows * cell - s, cols * cell, s],
      [f, 0, f + s, 0, f, f, s, rows * cell],
      [f + cols * cell, 0, f + cols * cell - s, 0, f + cols * cell - s, f, s, rows * cell],
    ]) {
      const sg = g.createLinearGradient(x0, y0, x1, y1);
      sg.addColorStop(0, "rgba(0,0,0,0.5)");
      sg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = sg;
      g.fillRect(rx, ry, rw, rh);
    }
    // edge light
    g.strokeStyle = "rgba(34,228,255,0.55)";
    g.lineWidth = 1.5;
    g.shadowColor = "#22e4ff";
    g.shadowBlur = 10;
    g.beginPath();
    g.roundRect(f - 2, f - 2, cols * cell + 4, rows * cell + 4, 4);
    g.stroke();
    return { img: c, cx: f, cy: f, frame: f };
  });
}

/** Deep space: gradient, nebula clouds, a lit planet and fixed faint stars. */
export function backdrop(W, H) {
  W = Math.round(W);
  H = Math.round(H);
  return cached(`bg|${W}|${H}`, () => {
    const [c, g] = canvas(W, H);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#060818");
    bg.addColorStop(0.45, "#0a0e26");
    bg.addColorStop(1, "#04050e");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "lighter";
    const clouds = [
      [0.15, 0.12, 0.7, "#5b23a8", 0.35],
      [0.85, 0.3, 0.6, "#0a7f99", 0.22],
      [0.4, 0.05, 0.4, "#a01585", 0.18],
      [0.7, 0.75, 0.8, "#2a1680", 0.2],
      [0.1, 0.9, 0.6, "#0a5f88", 0.16],
    ];
    for (const [x, y, r, col, a] of clouds) {
      const gr = g.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * Math.max(W, H));
      gr.addColorStop(0, rgba(col, a));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    }
    // faint fixed stars
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) {
      const a = rnd() * 0.5 + 0.1;
      g.fillStyle = `rgba(200,220,255,${a})`;
      const r = rnd() * 1.1 + 0.2;
      g.fillRect(rnd() * W, rnd() * H, r, r);
    }
    g.globalCompositeOperation = "source-over";
    // planet, top right
    const pr = Math.min(W, H) * 0.2;
    const px = W * 0.92;
    const py = H * 0.1;
    const atm = g.createRadialGradient(px, py, pr * 0.9, px, py, pr * 1.35);
    atm.addColorStop(0, "rgba(90,160,255,0.35)");
    atm.addColorStop(1, "rgba(90,160,255,0)");
    g.fillStyle = atm;
    g.beginPath();
    g.arc(px, py, pr * 1.35, 0, Math.PI * 2);
    g.fill();
    const pg = g.createRadialGradient(px - pr * 0.45, py + pr * 0.35, pr * 0.1, px, py, pr);
    pg.addColorStop(0, "#5b8cff");
    pg.addColorStop(0.5, "#2a3f9a");
    pg.addColorStop(1, "#0b0f2e");
    g.fillStyle = pg;
    g.beginPath();
    g.arc(px, py, pr, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = "rgba(255,255,255,0.08)";
    g.lineWidth = pr * 0.06;
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.ellipse(px, py + i * pr * 0.22, pr * 1.1, pr * 0.08, -0.25, 0, Math.PI * 2);
      g.stroke();
    }
    const term = g.createLinearGradient(px - pr, py + pr, px + pr, py - pr);
    term.addColorStop(0.35, "rgba(0,0,0,0)");
    term.addColorStop(0.75, "rgba(0,0,8,0.7)");
    g.fillStyle = term;
    g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    g.restore();
    return { img: c, cx: 0, cy: 0 };
  });
}
