// Checks pilot progression. Run: node --test sifiship/test/progress.check.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { xpToNext, addXp, winXp, lossXp, rankFor, levelRewards, nextUnlock, streakMultiplier, SKINS } from "../web/progress.js";

test("each level needs more XP than the one before", () => {
  assert.equal(xpToNext(1), 100);
  for (let l = 2; l < 80; l++) assert.ok(xpToNext(l) > xpToNext(l - 1));
});

test("adding XP rolls over levels and reports each one reached", () => {
  const r = addXp({ level: 1, xp: 50 }, 100 + 250 + 10);
  assert.deepEqual(r.gained, [2, 3]);
  assert.equal(r.level, 3);
  assert.equal(r.xp, 50 + 360 - 100 - 250);
});

test("a first win reaches level 2 at once; streaks, stars and bosses pay more", () => {
  const first = winXp({ sector: 1, stars: 1, firstClear: true, boss: false, maxCombo: 1, streak: 1 });
  assert.ok(first.total >= xpToNext(1));
  const better = winXp({ sector: 1, stars: 3, firstClear: true, boss: false, maxCombo: 3, streak: 4 });
  assert.ok(better.total > first.total);
  assert.equal(better.mult, streakMultiplier(4));
  const boss = winXp({ sector: 10, stars: 1, firstClear: true, boss: true, maxCombo: 1, streak: 1 });
  assert.ok(boss.parts.some((p) => p.label === "Boss destroyed"));
  assert.equal(streakMultiplier(1), 1);
  assert.equal(streakMultiplier(20), 1.5);
});

test("losses pay for the share of the wave destroyed", () => {
  assert.equal(lossXp({ sector: 5, cleared: 0 }), 0);
  assert.ok(lossXp({ sector: 5, cleared: 0.5 }) > 0);
  assert.ok(lossXp({ sector: 5, cleared: 1 }) > lossXp({ sector: 5, cleared: 0.5 }));
});

test("ranks, rewards and hull unlocks line up with levels", () => {
  assert.equal(rankFor(1).name, "Cadet");
  assert.equal(rankFor(10).name, "Captain");
  assert.equal(rankFor(99).next, null);
  const r5 = levelRewards(5);
  assert.ok(Object.values(r5.boost).reduce((a, b) => a + b, 0) >= 4, "every 5th level gives one of each extra");
  for (const s of SKINS.slice(1)) assert.equal(levelRewards(s.level).skin.id, s.id);
  assert.equal(nextUnlock(1).id, "falcon");
  assert.equal(nextUnlock(99), null);
});
