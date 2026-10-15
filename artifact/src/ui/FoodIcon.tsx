/* eslint-disable @typescript-eslint/no-unused-vars -- every drawing has the same (c, a, d, l) signature and uses the ones it needs */
import type { ReactNode } from "react";
import type { Look, Shape } from "../../../lib/catalog";

// Small flat pictures for the ingredient list: one drawing per shape, recoloured per ingredient. They are
// drawn on a 48 x 48 grid with a main colour (c), an accent (a: leaves, bones, lids), and shades worked out from c.

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
function tint(hex: string, t: number): string {
  // t > 0 lightens towards white, t < 0 darkens towards black
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => clamp(t >= 0 ? v + (255 - v) * t : v * (1 + t)));
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

type Draw = (c: string, a: string, d: string, l: string) => ReactNode;
const line = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

const DRAW: Record<Shape, Draw> = {
  round: (c, a, d, l) => (
    <>
      <ellipse cx="24" cy="28" rx="15" ry="14" fill={c} />
      <ellipse cx="18" cy="22" rx="4.5" ry="2.6" fill={l} opacity=".55" transform="rotate(-35 18 22)" />
      <path d="M24 15l-6-3 4-1 2-5 2 5 4 1z" fill={a} />
    </>
  ),
  bulb: (c, a, d) => (
    <>
      <path d="M24 6c2 7 12 11 12 22a12 12 0 0 1-24 0c0-11 10-15 12-22z" fill={c} />
      <path d="M24 12c-5 8-5 20 0 28M24 12c5 8 5 20 0 28" stroke={d} strokeWidth="1.5" {...line} />
      <path d="M21 41l-1 3M24 41v3M27 41l1 3" stroke={a} strokeWidth="1.6" {...line} />
    </>
  ),
  carrot: (c, a, d) => (
    <>
      <path d="M33 12c4 0 5 4 2 7L13 41c-3 2-6 1-5-2l21-24c1-2 2-3 4-3z" fill={c} />
      <path d="M27 20l4 2M22 26l4 2M17 32l4 2" stroke={d} strokeWidth="1.6" {...line} />
      <path d="M35 11c2-6 6-8 9-7-1 4-4 7-8 8zM32 9c-1-5 1-8 5-9 1 4-1 7-4 10z" fill={a} />
    </>
  ),
  long: (c, a, d, l) => (
    <g transform="rotate(-28 24 24)">
      <rect x="4" y="17" width="40" height="14" rx="7" fill={c} />
      <rect x="9" y="20" width="28" height="3" rx="1.5" fill={l} opacity=".6" />
      <circle cx="9" cy="24" r="3.5" fill={a} />
      <circle cx="30" cy="27" r="1" fill={d} />
      <circle cx="36" cy="25" r="1" fill={d} />
    </g>
  ),
  eggplant: (c, a, d, l) => (
    <>
      <path d="M31 9c10 4 11 18 4 27-6 7-16 6-22 1-4-4-3-8 1-9 7-1 9-9 11-15 1-3 4-5 6-4z" fill={c} />
      <path d="M18 34c4 0 9-4 11-9" stroke={l} strokeWidth="2" opacity=".5" {...line} />
      <path d="M25 11l6-6 5 7-5 3z" fill={a} />
    </>
  ),
  leaf: (c, a, d, l) => (
    <>
      <path d="M6 42C3 18 24 4 44 6c0 20-12 38-38 36z" fill={c} />
      <path d="M8 40c10-9 20-19 30-28" stroke={a === c ? l : a} strokeWidth="2" opacity=".8" {...line} />
      <path d="M18 31l-1-8M26 24l0-8M14 36l-6-2M24 28l8 0" stroke={d} strokeWidth="1.3" opacity=".6" {...line} />
    </>
  ),
  sprig: (c, a, d) => (
    <>
      <path d="M24 45V8" stroke={d} strokeWidth="2" {...line} />
      {[34, 25, 16].map((y) => (
        <g key={y}>
          <ellipse cx="17" cy={y} rx="7" ry="3.6" fill={c} transform={`rotate(-30 17 ${y})`} />
          <ellipse cx="31" cy={y} rx="7" ry="3.6" fill={c} transform={`rotate(30 31 ${y})`} />
        </g>
      ))}
      <ellipse cx="24" cy="8" rx="3.6" ry="6" fill={c} />
    </>
  ),
  head: (c, a, d, l) => (
    <>
      <circle cx="24" cy="25" r="18" fill={c} />
      <path d="M8 24c6-8 26-8 32 0M24 7c-7 11-7 24 0 36M24 7c7 11 7 24 0 36" stroke={a} strokeWidth="1.6" {...line} />
      <ellipse cx="17" cy="17" rx="4" ry="2.4" fill={l} opacity=".45" transform="rotate(-35 17 17)" />
    </>
  ),
  floret: (c, a, d, l) => (
    <>
      <path d="M19 31l-2 12h14l-2-12z" fill={a} />
      <circle cx="15" cy="23" r="8" fill={c} />
      <circle cx="26" cy="17" r="9.5" fill={c} />
      <circle cx="34" cy="25" r="7.5" fill={c} />
      <circle cx="23" cy="28" r="9" fill={c} />
      <circle cx="22" cy="14" r="2.4" fill={l} opacity=".5" />
      <circle cx="31" cy="22" r="2" fill={l} opacity=".5" />
    </>
  ),
  pod: (c, a, d, l) => (
    <g transform="rotate(-25 24 24)">
      <rect x="3" y="16" width="42" height="16" rx="8" fill={c} />
      <rect x="8" y="18.5" width="28" height="3" rx="1.5" fill={l} opacity=".5" />
      {[12, 20, 28, 36].map((x) => (
        <circle key={x} cx={x} cy="26" r="3.6" fill={a} />
      ))}
      <path d="M45 24c2 0 3-1 3-3" stroke={d} strokeWidth="2" {...line} />
    </g>
  ),
  bell: (c, a, d, l) => (
    <>
      <path d="M13 18c-4 10-3 23 11 24 14-1 15-14 11-24-4-4-8 0-11 0s-7-4-11 0z" fill={c} />
      <path d="M19 22c-2 6-1 12 5 16M29 22c2 6 1 12-5 16" stroke={d} strokeWidth="1.5" opacity=".5" {...line} />
      <path d="M24 18c0-6 2-9 6-10" stroke={a} strokeWidth="3.6" {...line} />
      <ellipse cx="17" cy="24" rx="2" ry="4" fill={l} opacity=".5" />
    </>
  ),
  chili: (c, a) => (
    <>
      <path d="M10 11c20-3 34 11 30 31-6-8-10-14-16-20-4-4-9-5-14-7z" fill={c} />
      <path d="M5 9c3-3 8-2 10 2l-5 4c-3-1-6-3-5-6z" fill={a} />
    </>
  ),
  mushroom: (c, a, d, l) => (
    <>
      <rect x="18" y="25" width="12" height="15" rx="5" fill={a} />
      <path d="M6 28C5 10 43 10 42 28z" fill={c} />
      <circle cx="16" cy="21" r="2" fill={l} opacity=".7" />
      <circle cx="28" cy="18" r="2.4" fill={l} opacity=".7" />
      <circle cx="35" cy="24" r="1.6" fill={l} opacity=".7" />
    </>
  ),
  root: (c, a, d) => (
    <>
      <path d="M8 27c-2-11 12-17 23-14 11 3 12 15 6 21-7 8-25 8-29-7z" fill={c} />
      <ellipse cx="18" cy="22" rx="2" ry="1.2" fill={a} />
      <ellipse cx="30" cy="31" rx="2" ry="1.2" fill={a} />
      <ellipse cx="25" cy="18" rx="1.5" ry="1" fill={a} />
      <path d="M10 22c4-4 10-6 16-6" stroke={d} strokeWidth="1.2" opacity=".4" {...line} />
    </>
  ),
  corn: (c, a, d) => (
    <>
      <g transform="rotate(-25 24 24)">
        <ellipse cx="24" cy="21" rx="9" ry="18" fill={c} />
        <path d="M18 8v26M24 4v34M30 8v26M12 16h24M12 22h24M12 28h24" stroke={d} strokeWidth="1.2" opacity=".5" {...line} />
      </g>
      <path d="M14 34C10 38 16 46 24 44c-4-4-5-7-10-10zM34 34c4 4-2 12-10 10 4-4 5-7 10-10z" fill={a} />
    </>
  ),
  pumpkin: (c, a, d, l) => (
    <>
      <ellipse cx="24" cy="29" rx="16" ry="13" fill={c} />
      <ellipse cx="14" cy="29" rx="7" ry="13" fill={l} opacity=".3" />
      <ellipse cx="34" cy="29" rx="7" ry="13" fill={d} opacity=".25" />
      <rect x="21.5" y="9" width="5" height="9" rx="2" fill={a} />
    </>
  ),
  lemon: (c, a, d, l) => (
    <>
      <path d="M4 27c0-9 9-14 15-14 8-5 14 3 17 7 6 3 9 9 5 12-4 3-9 2-14 3-9 2-23 3-23-8z" fill={c} transform="rotate(-8 24 24)" />
      <ellipse cx="18" cy="21" rx="5" ry="2.4" fill={l} opacity=".55" transform="rotate(-20 18 21)" />
      <path d="M38 14c3-2 6-1 7 1-3 1-5 1-7-1z" fill={a} />
    </>
  ),
  artichoke: (c, a, d, l) => (
    <>
      <rect x="21" y="36" width="6" height="9" rx="2" fill={a} />
      <path d="M24 5c8 6 15 12 14 22-1 9-7 12-14 12S11 36 10 27C9 17 16 11 24 5z" fill={c} />
      <path d="M12 24q12 9 24 0M13 31q11 8 22 0M24 8c-4 8-4 16 0 24M24 8c4 8 4 16 0 24" stroke={d} strokeWidth="1.4" opacity=".6" {...line} />
      <ellipse cx="17" cy="17" rx="2" ry="5" fill={l} opacity=".4" transform="rotate(25 17 17)" />
    </>
  ),
  stalks: (c, a) => (
    <>
      {[[11, 10], [20, 5], [29, 10]].map(([x, y]) => (
        <g key={x}>
          <rect x={x} y={y} width="8" height={38 - y} rx="4" fill={c} />
          <rect x={x} y="31" width="8" height="12" rx="4" fill={a} />
        </g>
      ))}
    </>
  ),
  jar: (c, a, d) => (
    <>
      <rect x="11" y="14" width="26" height="29" rx="6" fill="#dfe8ec" opacity=".85" />
      <rect x="13" y="22" width="22" height="19" rx="4" fill={c} />
      <rect x="12" y="8" width="24" height="8" rx="3" fill={a} />
      <rect x="15" y="25" width="4" height="12" rx="2" fill="#ffffff" opacity=".35" />
    </>
  ),
  steak: (c, a, d, l) => (
    <>
      <path d="M7 23C6 12 21 7 32 9c11 2 13 13 9 21-4 9-19 13-27 8C8 34 7 28 7 23z" fill={a} />
      <path d="M10 23c0-8 12-12 21-10 8 2 9 10 6 17-3 7-15 10-21 6-4-3-6-8-6-13z" fill={c} />
      <ellipse cx="20" cy="20" rx="5" ry="1.6" fill={l} opacity=".5" transform="rotate(-20 20 20)" />
      <ellipse cx="29" cy="27" rx="4" ry="1.4" fill={l} opacity=".45" transform="rotate(20 29 27)" />
      <circle cx="16" cy="29" r="1.6" fill={l} opacity=".5" />
    </>
  ),
  ribs: (c, a) => (
    <>
      {[10, 19, 28, 37].map((x) => (
        <g key={x}>
          <rect x={x - 2} y="18" width="5" height="22" rx="2.5" fill={a} />
          <circle cx={x + 0.5} cy="41" r="3.2" fill={a} />
        </g>
      ))}
      <rect x="5" y="8" width="38" height="16" rx="7" fill={c} />
      <rect x="9" y="11" width="22" height="3" rx="1.5" fill="#ffffff" opacity=".25" />
    </>
  ),
  chop: (c, a, d, l) => (
    <>
      <rect x="21" y="30" width="6" height="12" rx="3" fill={a} />
      <circle cx="22" cy="43" r="3.4" fill={a} />
      <circle cx="26" cy="43" r="3.4" fill={a} />
      <path d="M8 16c6-8 24-9 31 0 5 8 0 18-13 19-9 1-22-8-18-19z" fill={c} />
      <ellipse cx="20" cy="18" rx="6" ry="2" fill={l} opacity=".5" transform="rotate(-15 20 18)" />
      <path d="M12 24c4 5 12 8 22 4" stroke={d} strokeWidth="1.6" opacity=".4" {...line} />
    </>
  ),
  cubes: (c, a, d, l) => (
    <>
      <rect x="6" y="24" width="18" height="18" rx="4" fill={d} />
      <rect x="25" y="22" width="17" height="17" rx="4" fill={c} />
      <rect x="14" y="7" width="19" height="19" rx="4" fill={tint(c, 0.15)} />
      <rect x="17" y="10" width="8" height="3" rx="1.5" fill={l} opacity=".6" />
      <rect x="28" y="25" width="7" height="3" rx="1.5" fill={l} opacity=".55" />
    </>
  ),
  mince: (c, a, d, l) => (
    <>
      <ellipse cx="24" cy="39" rx="19" ry="4" fill="#dfe3e5" />
      <path d="M5 39C6 24 16 14 26 15c11 1 17 12 17 24z" fill={c} />
      <path d="M13 33c3-3 5-3 7 0M22 26c3-3 6-2 7 1M28 34c2-3 5-3 7-1M17 21c2-2 4-2 5 0" stroke={d} strokeWidth="1.6" opacity=".6" {...line} />
      <ellipse cx="17" cy="23" rx="4" ry="2" fill={l} opacity=".35" transform="rotate(-30 17 23)" />
    </>
  ),
  shank: (c, a, d, l) => (
    <>
      <rect x="20" y="32" width="9" height="11" rx="3" fill={a} />
      <circle cx="21.5" cy="44" r="3.6" fill={a} />
      <circle cx="28" cy="44" r="3.6" fill={a} />
      <path d="M9 17c6-9 24-9 30-1 6 9 0 21-11 22-10 1-23-8-19-21z" fill={c} />
      <ellipse cx="24" cy="25" rx="6" ry="5" fill={l} opacity=".4" />
      <ellipse cx="24" cy="25" rx="3" ry="2.4" fill={a} />
    </>
  ),
  roast: (c, a, d, l) => (
    <>
      <ellipse cx="24" cy="26" rx="18" ry="14" fill={c} />
      <path d="M15 13c-2 8-2 16 0 25M24 12v28M33 13c2 8 2 16 0 25" stroke={a} strokeWidth="2.2" {...line} />
      <ellipse cx="17" cy="18" rx="5" ry="2.4" fill={l} opacity=".4" transform="rotate(-25 17 18)" />
    </>
  ),
  organ: (c, a, d, l) => (
    <>
      <path d="M6 26C5 15 19 9 30 13c11 4 15 14 8 22-6 7-21 7-27 0-3-3-5-6-5-9z" fill={c} />
      <ellipse cx="20" cy="19" rx="6" ry="2.4" fill={l} opacity=".4" transform="rotate(-20 20 19)" />
      <path d="M16 27c3 3 9 4 14 1" stroke={a === c ? d : a} strokeWidth="2" opacity=".6" {...line} />
    </>
  ),
  sausage: (c, a, d, l) => (
    <>
      <g transform="rotate(-18 24 24)">
        <rect x="4" y="12" width="40" height="11" rx="5.5" fill={c} />
        <rect x="4" y="27" width="40" height="11" rx="5.5" fill={tint(c, -0.1)} />
        <rect x="9" y="14.5" width="26" height="2.4" rx="1.2" fill={l} opacity=".5" />
        <rect x="9" y="29.5" width="26" height="2.4" rx="1.2" fill={l} opacity=".4" />
        <path d="M3 17.5h-2M3 32.5h-2" stroke={d} strokeWidth="1.6" {...line} />
      </g>
    </>
  ),
  tongue: (c, a, d, l) => (
    <>
      <g transform="rotate(-18 24 24)">
        <ellipse cx="24" cy="25" rx="19" ry="10" fill={c} />
        {[[14, 22], [20, 27], [27, 22], [33, 27], [24, 20], [18, 30], [30, 31]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="1.1" fill={d} opacity=".45" />
        ))}
        <ellipse cx="22" cy="20" rx="9" ry="2" fill={l} opacity=".4" />
      </g>
    </>
  ),
  bacon: (c, a, d) => (
    <>
      <path d="M4 12c8-6 12 6 20 0 7-5 13 0 20-2v10c-7 2-13-3-20 2-8 6-12-6-20 0z" fill={c} />
      <path d="M4 16c8-6 12 6 20 0 7-5 13 0 20-2" stroke={a} strokeWidth="3" {...line} />
      <path d="M4 30c8-6 12 6 20 0 7-5 13 0 20-2v10c-7 2-13-3-20 2-8 6-12-6-20 0z" fill={c} />
      <path d="M4 34c8-6 12 6 20 0 7-5 13 0 20-2" stroke={a} strokeWidth="3" {...line} />
    </>
  ),
  oxtail: (c, a) => (
    <>
      {[[13, 30, 10], [27, 26, 8.5], [38, 22, 6.5]].map(([x, y, r]) => (
        <g key={x}>
          <circle cx={x} cy={y} r={r} fill={c} />
          <circle cx={x} cy={y} r={r * 0.4} fill={a} />
        </g>
      ))}
    </>
  ),
  bone: (c) => (
    <>
      <g transform="rotate(-35 24 24)">
        <rect x="9" y="19.5" width="30" height="9" rx="4" fill={c} />
        <circle cx="9" cy="18" r="5" fill={c} />
        <circle cx="9" cy="30" r="5" fill={c} />
        <circle cx="39" cy="18" r="5" fill={c} />
        <circle cx="39" cy="30" r="5" fill={c} />
      </g>
    </>
  ),
  bird: (c, a, d, l) => (
    <>
      <path d="M8 40l6-6M40 40l-6-6" stroke={c} strokeWidth="6" {...line} />
      <circle cx="8" cy="41" r="3" fill={a} />
      <circle cx="40" cy="41" r="3" fill={a} />
      <ellipse cx="24" cy="26" rx="16" ry="14" fill={c} />
      <ellipse cx="24" cy="23" rx="10" ry="8" fill={tint(c, 0.25)} />
      <path d="M9 22c-3-2-5 1-4 4M39 22c3-2 5 1 4 4" stroke={d} strokeWidth="3" {...line} />
      <ellipse cx="19" cy="19" rx="4" ry="2" fill={l} opacity=".5" transform="rotate(-30 19 19)" />
    </>
  ),
  drumstick: (c, a, d, l) => (
    <>
      <path d="M22 28L10 40" stroke={a} strokeWidth="5" {...line} />
      <circle cx="8" cy="41" r="3.6" fill={a} />
      <circle cx="12" cy="43" r="3.4" fill={a} />
      <ellipse cx="30" cy="19" rx="15" ry="12" transform="rotate(-35 30 19)" fill={c} />
      <ellipse cx="27" cy="13" rx="6" ry="2.2" fill={l} opacity=".5" transform="rotate(-35 27 13)" />
    </>
  ),
  wing: (c, a, d, l) => (
    <>
      <path d="M7 30c2-12 14-20 27-20 7 0 9 6 5 10-4 4-9 2-13 6-4 4-3 12-12 12-5 0-8-4-7-8z" fill={c} />
      <path d="M34 10c3 0 6 1 6 4" stroke={d} strokeWidth="1.6" opacity=".5" {...line} />
      <circle cx="9" cy="35" r="4" fill={a} />
      <ellipse cx="22" cy="16" rx="7" ry="2.2" fill={l} opacity=".45" transform="rotate(-25 22 16)" />
    </>
  ),
  fillet: (c, a, d, l) => (
    <>
      <path d="M6 28c0-13 15-19 28-14 11 4 10 19-3 23-11 3-25 2-25-9z" fill={c} />
      <path d="M12 26c6-6 16-8 24-4M12 32c7-2 14-2 20 1" stroke={l} strokeWidth="1.6" opacity=".55" {...line} />
      <ellipse cx="18" cy="19" rx="6" ry="2" fill={l} opacity=".5" transform="rotate(-18 18 19)" />
    </>
  ),
  fish: (c, a, d, l) => (
    <>
      <path d="M4 24c8-12 24-13 33-3l7-9v26l-7-9C28 38 12 36 4 24z" fill={c} />
      <path d="M12 26c8 6 17 6 25-2" stroke={a} strokeWidth="3" opacity=".7" {...line} />
      <path d="M27 14c3 3 4 6 4 9" stroke={d} strokeWidth="1.6" opacity=".5" {...line} />
      <circle cx="11" cy="22" r="2.6" fill="#ffffff" />
      <circle cx="11" cy="22" r="1.2" fill="#1c1c1e" />
    </>
  ),
  shrimp: (c, a, d) => (
    <>
      <path d="M36 11C21 6 9 16 13 28c2 7 10 11 19 8" stroke={c} strokeWidth="10" {...line} />
      <path d="M12 21c4-3 9-4 14-3M14 29c4 2 9 2 13 0M20 35c3 1 6 0 8-1" stroke={d} strokeWidth="1.5" opacity=".45" {...line} />
      <path d="M31 36l7 6-1-9zM31 36l8-1 0 5" fill={a} />
      <circle cx="37" cy="12" r="1.8" fill="#1c1c1e" />
      <path d="M38 9c4-3 6-3 8-2M39 12c4 0 6 1 7 3" stroke={a} strokeWidth="1.4" {...line} />
    </>
  ),
  rings: (c) => (
    <>
      {[[15, 17], [33, 17], [24, 33]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="8" stroke={c} strokeWidth="5.5" fill="none" />
      ))}
    </>
  ),
  crab: (c, a, d) => (
    <>
      <path d="M8 34l8-8M40 34l-8-8M10 41l8-9M38 41l-8-9" stroke={c} strokeWidth="3.4" {...line} />
      <ellipse cx="24" cy="28" rx="15" ry="10" fill={c} />
      <circle cx="9" cy="14" r="6.5" fill={a} />
      <circle cx="39" cy="14" r="6.5" fill={a} />
      <path d="M13 19l5 5M35 19l-5 5" stroke={c} strokeWidth="3.4" {...line} />
      <circle cx="20" cy="22" r="1.8" fill="#1c1c1e" />
      <circle cx="28" cy="22" r="1.8" fill="#1c1c1e" />
      <path d="M14 28c4 3 16 3 20 0" stroke={d} strokeWidth="1.4" opacity=".5" {...line} />
    </>
  ),
  can: (c, a, d) => (
    <>
      <rect x="8" y="14" width="32" height="26" rx="4" fill={c} />
      <ellipse cx="24" cy="14" rx="16" ry="5" fill={tint(c, 0.3)} />
      <ellipse cx="24" cy="40" rx="16" ry="4" fill={d} opacity=".5" />
      <rect x="8" y="22" width="32" height="10" fill={a} />
      <circle cx="24" cy="27" r="3" fill="#ffffff" opacity=".85" />
    </>
  ),
  egg: (c, a, d, l) => (
    <>
      <ellipse cx="24" cy="27" rx="13" ry="16" fill={c} />
      <ellipse cx="19" cy="20" rx="3.4" ry="5.5" fill={l} opacity=".6" transform="rotate(20 19 20)" />
    </>
  ),
  bottle: (c, a, d, l) => (
    <>
      <rect x="19" y="3" width="10" height="9" rx="2" fill={a} />
      <path d="M20 12h8l1 5c4 2 6 5 6 9v13c0 3-2 5-5 5H18c-3 0-5-2-5-5V26c0-4 2-7 6-9z" fill={c} />
      <rect x="16" y="26" width="16" height="12" rx="2" fill="#ffffff" opacity=".7" />
      <rect x="18" y="29" width="12" height="3" rx="1.5" fill={a} opacity=".6" />
      <rect x="17" y="18" width="3" height="7" rx="1.5" fill={l} opacity=".5" />
    </>
  ),
  carton: (c, a, d) => (
    <>
      <path d="M10 14L24 5l14 9z" fill={a} />
      <rect x="10" y="14" width="28" height="29" rx="2" fill={c} />
      <rect x="10" y="24" width="28" height="10" fill={a} opacity=".85" />
      <circle cx="24" cy="29" r="3" fill="#ffffff" />
    </>
  ),
  cup: (c, a, d, l) => (
    <>
      <path d="M9 15h30l-4 27H13z" fill={c} />
      <ellipse cx="24" cy="15" rx="15" ry="4" fill={tint(c, 0.4)} stroke={a} strokeWidth="2" />
      <rect x="12" y="24" width="24" height="8" fill={a} opacity=".8" />
    </>
  ),
  wedge: (c, a, d) => (
    <>
      <path d="M5 34l36-14v18H5z" fill={c} />
      <path d="M5 34L41 20l-5-7-31 13z" fill={tint(c, 0.35)} />
      <circle cx="16" cy="35" r="2.2" fill={a} opacity=".7" />
      <circle cx="28" cy="31" r="2.6" fill={a} opacity=".7" />
      <circle cx="34" cy="36" r="1.8" fill={a} opacity=".7" />
    </>
  ),
  block: (c, a, d) => (
    <>
      <path d="M9 21l9-9h22l-9 9z" fill={tint(c, 0.4)} />
      <rect x="9" y="21" width="22" height="17" rx="1" fill={c} />
      <path d="M31 21l9-9v17l-9 9z" fill={d} />
      <rect x="9" y="27" width="22" height="5" fill={a} opacity=".7" />
    </>
  ),
  heap: (c, a, d) => (
    <>
      <ellipse cx="24" cy="40" rx="20" ry="5" fill={a} opacity=".6" />
      <path d="M5 40C8 14 40 14 43 40z" fill={c} />
      <circle cx="19" cy="30" r="1.6" fill={a} />
      <circle cx="28" cy="26" r="1.6" fill={a} />
      <circle cx="31" cy="34" r="1.6" fill={a} />
      <circle cx="15" cy="35" r="1.6" fill={a} />
      <circle cx="24" cy="35" r="1.4" fill={a} />
    </>
  ),
  beans: (c, a) => (
    <>
      {[[14, 18, -25], [30, 14, 30], [22, 28, 10], [36, 30, -40], [11, 35, 35], [28, 40, -10]].map(([x, y, r]) => (
        <g key={`${x}${y}`} transform={`rotate(${r} ${x} ${y})`}>
          <ellipse cx={x} cy={y} rx="7" ry="4.6" fill={c} />
          <ellipse cx={x - 2} cy={y - 1.4} rx="3" ry="1.2" fill={a} opacity=".8" />
        </g>
      ))}
    </>
  ),
  sack: (c, a, d) => (
    <>
      <path d="M12 13h24l5 28c0 2-2 4-4 4H11c-2 0-4-2-4-4z" fill={c} />
      <path d="M12 13c-2-3 0-6 3-6h18c3 0 5 3 3 6z" fill={d} opacity=".45" />
      <rect x="14" y="10" width="20" height="4" rx="2" fill={a} />
      <circle cx="24" cy="29" r="6" fill={a} opacity=".35" />
    </>
  ),
  loaf: (c, a, d) => (
    <>
      <path d="M5 31C5 16 16 9 24 9c9 0 20 7 19 22v8H5z" fill={c} />
      <path d="M15 20l4 6M24 17l4 7M33 20l4 6" stroke={a} strokeWidth="2.6" {...line} />
    </>
  ),
  pasta: (c) => (
    <>
      <path d="M6 14c10-9 20 6 36-3M6 24c10-9 20 6 36-3M6 34c10-9 20 6 36-3" stroke={c} strokeWidth="4" {...line} />
    </>
  ),
  cube: (c, a, d, l) => (
    <>
      <path d="M24 5l16 8-16 8-16-8z" fill={l} />
      <path d="M8 13l16 8v20L8 33z" fill={c} />
      <path d="M40 13l-16 8v20l16-8z" fill={d} />
    </>
  ),
};

export const SHAPE_DRAWINGS = DRAW;

/** A small picture of an ingredient (decorative; the name is always written next to it). */
export function FoodIcon({ look, size = 40 }: { look: Look; size?: number }) {
  const c = look.color;
  const a = look.accent ?? tint(c, -0.25);
  return (
    <svg className="food-icon" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {DRAW[look.shape](c, a, tint(c, -0.25), tint(c, 0.4))}
    </svg>
  );
}
