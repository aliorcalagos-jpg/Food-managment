// Checks the Star Pass. Run: node --test sifiship/test/pass.check.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { SEASON, TRAILS, tierStars, tierFor, tierReward, claimable, ownedTrails, tierProgress } from "../web/pass.js";

test("tiers cost more stars as the season goes on", () => {
  assert.equal(tierStars(1), 3);
  assert.equal(tierStars(10), 40);
  assert.equal(tierStars(30), 180);
  for (let k = 2; k <= SEASON.tiers; k++) assert.ok(tierStars(k) - tierStars(k - 1) >= tierStars(k - 1) - tierStars(k - 2));
});

test("stars map to tiers, capped at the season length", () => {
  assert.equal(tierFor(0), 0);
  assert.equal(tierFor(2), 0);
  assert.equal(tierFor(3), 1);
  assert.equal(tierFor(39), 9);
  assert.equal(tierFor(40), 10);
  assert.equal(tierFor(10000), SEASON.tiers);
  const p = tierProgress(20);
  assert.equal(p.tier, 5);
  assert.ok(p.frac >= 0 && p.frac < 1);
  assert.equal(tierProgress(10000).frac, 1);
});

test("every tier gives something; milestones and trails sit where promised", () => {
  for (let k = 1; k <= SEASON.tiers; k++) {
    const r = tierReward(k);
    const boosts = Object.values(r.boost).reduce((a, b) => a + b, 0);
    assert.ok(boosts > 0 || r.xp > 0 || r.trail, `tier ${k} is empty`);
  }
  assert.ok(tierReward(10).milestone && tierReward(20).milestone && tierReward(30).milestone);
  for (const t of TRAILS.filter((t) => t.tier > 0)) assert.equal(tierReward(t.tier).trail, t.id);
  // every booster turns up on regular tiers, several times over the season
  for (const b of ["radar", "shuffle", "undo", "bay"]) {
    const regular = [];
    for (let k = 1; k <= SEASON.tiers; k++) if (!tierReward(k).milestone && tierReward(k).boost[b]) regular.push(k);
    assert.ok(regular.length >= 4, `${b} on tiers ${regular}`);
  }
});

test("claiming: only unlocked, unclaimed tiers; trails follow claims", () => {
  assert.deepEqual(claimable(13, []), [1, 2, 3, 4]);
  assert.deepEqual(claimable(13, [1, 3]), [2, 4]);
  assert.deepEqual(ownedTrails([]), ["plasma"]);
  assert.deepEqual(ownedTrails([1, 2, 5]), ["plasma", "ion"]);
});
