// Checks the level generator: every level builds, its intended launch order clears the hangar and the wave,
// and the wave holds exactly the shots the ships carry. Run: node --test sifiship/test/logic.check.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateLevel,
  orderClears,
  simulate,
  occupancy,
  blocker,
  exitPath,
  pickShooter,
  radarHint,
  difficulty,
  BAYS,
} from "../web/logic.js";

test("sectors 1-80 are solvable within their bay budget", () => {
  for (let n = 1; n <= 80; n++) {
    const { cfg, ships, queue, order } = generateLevel(n);
    assert.ok(orderClears(ships, order, cfg.cols, cfg.rows), `level ${n}: order blocked`);
    const run = simulate(ships, queue, order, cfg.solutionBays);
    assert.ok(run.ok, `level ${n}: wave not cleared`);
    assert.ok(run.peak <= cfg.solutionBays && cfg.solutionBays <= BAYS);
    const shots = ships.reduce((sum, s) => sum + s.cap, 0);
    assert.equal(queue.length, shots, `level ${n}: wave size`);
    const used = new Set(ships.map((s) => s.color));
    assert.equal(used.size, cfg.colors, `level ${n}: colors`);
  }
});

test("a level is the same every time", () => {
  assert.deepEqual(generateLevel(7), generateLevel(7));
});

test("dense hangars: about 60 rockets from sector 1, more and more blocked later", () => {
  const first = generateLevel(1);
  assert.ok(first.ships.length >= 60, `sector 1 has ${first.ships.length} rockets`);
  for (let n = 1; n <= 40; n++) assert.ok(generateLevel(n).ships.length >= 56, `sector ${n}`);
  const share = (l) => {
    const occ = occupancy(l.ships, l.cfg.cols, l.cfg.rows);
    return l.ships.filter((s) => blocker(s, occ, l.cfg.cols, l.cfg.rows)).length / l.ships.length;
  };
  assert.ok(share(generateLevel(40)) > share(first));
  // The growth term never falls; the 5-sector cycle makes every 5th sector a breather.
  for (let n = 2; n <= 60; n++) assert.ok(difficulty(n).t > difficulty(n - 1).t);
  assert.ok(difficulty(5).e < difficulty(4).e && difficulty(15).e < difficulty(14).e);
  assert.ok(difficulty(10).e > difficulty(9).e, "boss sector is a peak");
});

test("radar picks a free rocket of the first color the bays do not cover", () => {
  const ships = [
    { id: 0, x: 0, y: 1, len: 2, dir: "up", color: 1, cap: 4 }, // blocked by ship 1
    { id: 1, x: 0, y: 0, len: 2, dir: "right", color: 1, cap: 4 },
    { id: 2, x: 3, y: 2, len: 2, dir: "down", color: 2, cap: 4 },
  ];
  const queue = [0, 0, 1, 1, 2];
  // Color 0 is covered by a docked ship, so the next need is color 1: ship 1 is free, ship 0 is not.
  const bays = [{ color: 0, ammo: 2, ready: true }, null];
  assert.equal(radarHint(ships, queue, 0, bays, 5, 5).id, 1);
  assert.equal(radarHint(ships, queue, 4, [null], 5, 5).id, 2);
});

test("exit path runs from the nose to the edge", () => {
  const ship = { id: 0, x: 1, y: 2, len: 2, dir: "right" };
  assert.deepEqual(exitPath(ship, 5, 5), [
    [3, 2],
    [4, 2],
  ]);
  assert.deepEqual(exitPath({ ...ship, dir: "up" }, 5, 5), [
    [1, 1],
    [1, 0],
  ]);
});

test("the matching ship with fewest shots fires; ships still flying in do not", () => {
  const bays = [
    { color: 1, ammo: 4, ready: true },
    { color: 1, ammo: 2, ready: true },
    { color: 1, ammo: 1, ready: false },
    null,
  ];
  assert.equal(pickShooter(bays, 1), 1);
  assert.equal(pickShooter(bays, 2), -1);
});
