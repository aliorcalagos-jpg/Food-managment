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
  BAYS,
} from "../web/logic.js";

test("levels 1-150 are solvable within their bay budget", () => {
  for (let n = 1; n <= 150; n++) {
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

test("later levels start with ships blocked and grow", () => {
  const first = generateLevel(1);
  const later = generateLevel(20);
  assert.ok(later.ships.length > first.ships.length);
  const occ = occupancy(later.ships, later.cfg.cols, later.cfg.rows);
  const blocked = later.ships.filter((s) => blocker(s, occ, later.cfg.cols, later.cfg.rows)).length;
  assert.ok(blocked >= later.ships.length * 0.4);
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
