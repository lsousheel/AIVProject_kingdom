import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Grid } from "../src/navigation/Grid.js";
import { findPath } from "../src/navigation/AStar.js";
import { Army } from "../src/units/Army.js";
import { CONFIG as C, OBSTACLES } from "../src/config.js";

test("A* returns optimal diagonal cost on an empty grid", () => {
  const g = new Grid(10, 1),
    p = findPath(g, { x: -4.5, z: -4.5 }, { x: 4.5, z: 4.5 });
  assert.ok(Math.abs(p.cost - 9 * Math.SQRT2) < 1e-8);
});
test("blocked endpoints, disconnected regions and diagonal corner cuts are rejected", () => {
  const g = new Grid(3, 1);
  g.blocked[g.index(1, 0)] = 1;
  g.blocked[g.index(0, 1)] = 1;
  assert.equal(
    findPath(g, g.toWorld({ x: 0, z: 0 }), g.toWorld({ x: 2, z: 2 })),
    null,
  );
  assert.equal(
    findPath(g, g.toWorld({ x: 0, z: 0 }), g.toWorld({ x: 1, z: 0 })),
    null,
  );
});
test("20 boids finish successive routes without entering blocked cells", () => {
  const grid = new Grid(C.worldSize, C.cellSize, OBSTACLES, C.soldierRadius),
    army = new Army(new THREE.Scene(), grid);
  for (const destination of [
    { x: 19, z: 0 },
    { x: -19, z: 18 },
    { x: 18, z: -22 },
  ]) {
    assert.ok(army.command(destination));
    let frames = 0;
    for (; frames < 7200; frames++) {
      army.update(1 / 60);
      for (const s of army.soldiers)
        assert.ok(grid.canStand(s.position), "soldier entered blocked cell");
      if (army.soldiers.every((s) => s.arrived)) break;
    }
    assert.equal(
      army.soldiers.filter((s) => s.arrived).length,
      C.armySize,
      `arrival at ${JSON.stringify(destination)}`,
    );
  }
  const routes = army.soldiers.map((s) => s.route);
  assert.equal(army.command({ x: -18, z: -40 }), null);
  assert.deepEqual(
    army.soldiers.map((s) => s.route),
    routes,
    "invalid commands preserve current route",
  );
});
