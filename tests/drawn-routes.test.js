import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Game } from "../src/systems/Game.js";
import { Army } from "../src/units/Army.js";
import { Grid } from "../src/navigation/Grid.js";
import { CONFIG, OBSTACLES, TERRAIN_ZONES, DEFAULT_COMPOSITION } from "../src/config.js";
import { prepareTrace, findGuidedPath } from "../src/navigation/GuidedPath.js";
import { PATH_PROFILES } from "../src/config.js";

test("the reference chooses an obstacle side without replaying sketch loops", () => {
  const grid = new Grid(60, 1.5, [{ x: 0, z: 0, width: 6, depth: 10 }]);
  const start = { x: -15, z: 0 }, goal = { x: 15, z: 0 };
  for (const sign of [-1, 1]) {
    const trace = [start, { x: -8, z: sign * 12 }, { x: 8, z: sign * 12 },
      { x: -8, z: sign * 12 }, { x: 8, z: sign * 12 }, goal];
    const plan = findGuidedPath(grid, start, prepareTrace(grid, start, trace, goal), PATH_PROFILES.warrior);
    const crossing = plan.waypoints.filter(p => Math.abs(p.x) < 4);
    assert.ok(crossing.every(p => p.z * sign > 5), "sketch influences obstacle side");
    const ids = plan.waypoints.map(p => JSON.stringify(grid.toCell(p)));
    assert.equal(new Set(ids).size, ids.length, "does not replay back-and-forth strokes");
  }
});

test("changing troops and formation immediately creates the visible army without Deploy", () => {
  const game = new Game(new THREE.Scene(), new Grid(CONFIG.worldSize, CONFIG.cellSize,
    OBSTACLES, CONFIG.soldierRadius, TERRAIN_ZONES));
  game.composition = { ...DEFAULT_COMPOSITION };
  game.invalidateDeployment();
  assert.equal(game.blue.active.length, 30);
  for (const formation of ["line", "wide", "block"]) {
    game.formation = formation;
    game.invalidateDeployment();
    assert.equal(game.blue.formation, formation);
    assert.equal(game.blue.active.length, 30);
    assert.ok(game.blue.active.every(s => s.mesh.visible && game.grid.canStand(s.position)));
  }
  assert.ok(game.start());
  assert.deepEqual(game.blue.paths, {});
});

test("a sketch is a soft reference, not mandatory bends, and moves only the selected class", () => {
  const grid = new Grid(120, 1.5);
  const army = new Army(new THREE.Scene(), grid, {
    start: { x: -20, z: 0 }, composition: { warrior: 1, guard: 1 },
  });
  const trace = [{ x: -20, z: 0 }, { x: -20, z: 12 }, { x: 0, z: 12 }, { x: 0, z: -10 }];
  const guard = army.members("guard")[0], guardPosition = guard.position.clone();
  assert.ok(army.command(trace.at(-1), "warrior", { attackMove: false, trace }));
  assert.equal(army.paths.warrior.mode, "Guided A*");
  assert.ok(army.paths.warrior.expanded > 0);
  const soldier = army.members("warrior")[0];
  const distances = trace.map(() => Infinity);
  for (let i = 0; i < 6000 && !soldier.arrived; i++) {
    army.update(1 / 60);
    trace.forEach((p, j) => distances[j] = Math.min(distances[j],
      Math.hypot(p.x - soldier.position.x, p.z - soldier.position.z)));
    assert.ok(grid.canStand(soldier.position));
  }
  assert.ok(soldier.arrived);
  assert.ok(distances.at(-1) < 1.8, "reaches the destination");
  assert.ok(distances.slice(1, -1).some(d => d > 2), "can skip unnecessary sketch bends");
  const cells = army.path.waypoints.map(p => JSON.stringify(grid.toCell(p)));
  assert.equal(new Set(cells).size, cells.length, "route never loops through an earlier cell");
  assert.ok(guard.position.equals(guardPosition));
  assert.deepEqual(guard.route, []);
});

test("A* detours a sketch through a wall and soldiers reach the destination", () => {
  const grid = new Grid(60, 1.5, [{ x: 0, z: 0, width: 4, depth: 4 }]);
  const army = new Army(new THREE.Scene(), grid, {
    start: { x: -12, z: 0 }, composition: { warrior: 2 },
  });
  assert.ok(army.command({ x: -12, z: 10 }));
  assert.ok(army.command({ x: 12, z: 0 }, "all", {
    attackMove: false,
    trace: [{ x: -12, z: 0 }, { x: 0, z: 0 }, { x: 12, z: 0 }],
  }));
  assert.ok(army.path.waypoints.some(p => Math.abs(p.z) > 3));
  for (let i = 0; i < 6000 && !army.active.every(s => s.arrived); i++) {
    army.update(1 / 60);
    assert.ok(army.active.every(s => grid.canStand(s.position)));
  }
  assert.ok(army.active.every(s => s.arrived && s.position.x > 9));
});

test("a sketch across the river uses a real crossing and adjusts an obstructed endpoint", () => {
  const grid = new Grid(CONFIG.worldSize, CONFIG.cellSize, OBSTACLES,
    CONFIG.soldierRadius, TERRAIN_ZONES);
  const army = new Army(new THREE.Scene(), grid, {
    start: { x: -38, z: 10 }, composition: { warrior: 1 },
  });
  assert.ok(army.command({ x: -5, z: 10 }, "all", {
    attackMove: false, trace: [{ x: -38, z: 10 }, { x: -18, z: 10 }, { x: -5, z: 10 }],
  }));
  assert.ok(army.path.crossings.length > 0);
  for (let i = 0; i < 9000 && !army.active[0].arrived; i++) {
    army.update(1 / 60);
    assert.ok(grid.canStand(army.active[0].position));
  }
  assert.ok(army.active[0].arrived);
  assert.ok(army.command({ x: -18, z: 10 }, "all", {
    trace: [{ x: -5, z: 10 }, { x: -18, z: 10 }],
  }));
  assert.equal(army.path.adjustedDestination, true);
  assert.ok(grid.canStand(army.active[0].orderDestination));
});
