// The Star Pass: a free season reward track fed by stars. No DOM, so the checks can run it in Node.
//
// Pass stars are the sum of the best stars earned in each sector, so replaying a sector for a better rating
// also moves the pass. Tier k unlocks at 3k + ⌊k²/10⌋ stars (3, 6, 9, 13, 17 … 40 at tier 10, 180 at tier 30):
// the first tiers come about one per sector, later ones ask for 3-star runs. Every reward is claimed by hand.

export const SEASON = { id: 1, name: "Nebula Run", tiers: 30 };

/** Engine-trail cosmetics. "plasma" (the rocket's own color) is owned from the start. */
export const TRAILS = [
  { id: "plasma", name: "Plasma", blurb: "Burns in the rocket's own color.", tier: 0 },
  { id: "ion", name: "Ion Stream", blurb: "Electric blue exhaust.", tier: 5 },
  { id: "solar", name: "Solar Flare", blurb: "White-gold fire.", tier: 15 },
  { id: "void", name: "Void Wake", blurb: "Violet with a dark core.", tier: 25 },
  { id: "nova", name: "Nova Spectrum", blurb: "Every color at once.", tier: 30 },
];

const BOOSTS = ["radar", "shuffle", "undo", "bay"];

/** Stars needed to unlock tier `k`. */
export function tierStars(k) {
  return 3 * k + Math.floor((k * k) / 10);
}

/** How many tiers `stars` have unlocked. */
export function tierFor(stars) {
  let k = 0;
  while (k < SEASON.tiers && stars >= tierStars(k + 1)) k++;
  return k;
}

/**
 * What tier `k` gives, as { boost: {kind: n}, xp, trail }. Every 10th tier is a milestone (two of each booster
 * and a big XP drop); tiers 5, 15, 25 and 30 carry a trail; the rest rotate through boosters and XP, growing
 * a little as the season goes on.
 */
export function tierReward(k) {
  const r = { boost: {}, xp: 0, trail: null, milestone: k % 10 === 0 };
  const trail = TRAILS.find((t) => t.tier === k);
  if (trail) r.trail = trail.id;
  if (r.milestone) {
    for (const b of BOOSTS) r.boost[b] = 2;
    r.xp = 300 * (k / 10);
  } else if (!trail) {
    // rotate over the regular tiers only (every 5th tier is a trail or a milestone): four boosters, then XP
    const j = (k - 1 - Math.floor(k / 5)) % 5;
    if (j === 4) r.xp = 100 + 10 * k;
    else r.boost[BOOSTS[j]] = 1 + Math.floor(k / 12);
  }
  return r;
}

/** Tiers unlocked by `stars` but not yet in `claimed`. */
export function claimable(stars, claimed) {
  const have = new Set(claimed);
  const out = [];
  for (let k = 1; k <= tierFor(stars); k++) if (!have.has(k)) out.push(k);
  return out;
}

/** Trails owned given the claimed tiers. */
export function ownedTrails(claimed) {
  const have = new Set(claimed);
  return TRAILS.filter((t) => t.tier === 0 || have.has(t.tier)).map((t) => t.id);
}

/** Progress inside the current tier, for the bar: { tier, from, to, frac }. */
export function tierProgress(stars) {
  const tier = tierFor(stars);
  if (tier >= SEASON.tiers) return { tier, from: tierStars(tier), to: tierStars(tier), frac: 1 };
  const from = tier ? tierStars(tier) : 0;
  const to = tierStars(tier + 1);
  return { tier, from, to, frac: (stars - from) / (to - from) };
}
