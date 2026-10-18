// Pilot progression: XP, levels, ranks, rewards and hull unlocks. No DOM, so the checks can run it in Node.
//
// XP to go from level L to L+1 is 100 + 150·(L−1)^1.3: 100, 250, 469, 729, 1009 … 2710 at level 10.
// A win pays a base that grows with the sector, plus stars, a first-clear bonus, the boss bonus and the best
// combo, all multiplied by the win streak (×1.1 per win in a row, up to ×1.5). Early levels come after one
// sector each; by level 10 a level takes about five sectors, so there is always a bar close to filling.

export const SKINS = [
  { id: "interceptor", name: "Interceptor", level: 1, blurb: "Swept-wing striker. Standard issue." },
  { id: "falcon", name: "Falcon", level: 3, blurb: "Forward-swept wings, twin engines." },
  { id: "phantom", name: "Phantom", level: 6, blurb: "Faceted stealth delta." },
  { id: "titan", name: "Titan", level: 10, blurb: "Armored gunship with side pods." },
  { id: "nova", name: "Nova", level: 16, blurb: "Needle hull with plasma fins." },
];

export const RANKS = [
  { level: 1, name: "Cadet" },
  { level: 3, name: "Pilot" },
  { level: 6, name: "Ace" },
  { level: 10, name: "Captain" },
  { level: 16, name: "Commander" },
  { level: 25, name: "Admiral" },
  { level: 40, name: "Legend" },
];

const BOOST_CYCLE = ["radar", "undo", "bay"];

export function xpToNext(level) {
  return Math.round((100 + 150 * Math.pow(level - 1, 1.3)) / 10) * 10;
}

/** Adds XP; returns the new { level, xp } and the levels reached on the way (for the level-up screen). */
export function addXp(pilot, amount) {
  let { level, xp } = pilot;
  xp += Math.max(0, Math.round(amount));
  const gained = [];
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    gained.push(level);
  }
  return { level, xp, gained };
}

export function streakMultiplier(streak) {
  return 1 + 0.1 * Math.min(5, Math.max(0, streak - 1));
}

/** XP for a cleared sector, with the parts listed for the win screen. `streak` counts this win. */
export function winXp({ sector, stars, firstClear, boss, maxCombo, streak }) {
  const base = 100 + 8 * sector;
  const parts = [{ label: "Sector cleared", xp: base }];
  parts.push({ label: `${stars} star${stars === 1 ? "" : "s"}`, xp: 40 * stars });
  if (firstClear) parts.push({ label: "First clear", xp: Math.round(base / 2) });
  if (boss) parts.push({ label: "Boss destroyed", xp: 150 });
  if (maxCombo > 1) parts.push({ label: `Combo x${maxCombo}`, xp: 10 * maxCombo });
  const sum = parts.reduce((a, p) => a + p.xp, 0);
  const mult = streakMultiplier(streak);
  return { parts, mult, total: Math.round(sum * mult) };
}

/** A lost sector still pays for the share of the wave destroyed, so every run moves the bar. */
export function lossXp({ sector, cleared }) {
  return Math.round((20 + 2 * sector) * Math.min(1, Math.max(0, cleared)) * 2);
}

export function rankFor(level) {
  let i = 0;
  while (i + 1 < RANKS.length && level >= RANKS[i + 1].level) i++;
  return { ...RANKS[i], next: RANKS[i + 1] || null };
}

/** What reaching `level` gives: one booster (rotating), one of each every 5th level, and any hull unlocked. */
export function levelRewards(level) {
  const boost = { [BOOST_CYCLE[level % BOOST_CYCLE.length]]: 1 };
  if (level % 5 === 0) for (const k of BOOST_CYCLE) boost[k] = (boost[k] || 0) + 1;
  const skin = SKINS.find((s) => s.level === level) || null;
  const rank = RANKS.find((r) => r.level === level) || null;
  return { boost, skin, rank };
}

/** The next hull still locked at `level`, to show as the goal on the menu. */
export function nextUnlock(level) {
  return SKINS.find((s) => s.level > level) || null;
}
