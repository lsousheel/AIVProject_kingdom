import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  CONFIG as C,
  OBSTACLES,
  TERRAIN_ZONES,
  PATH_PROFILES,
  BOID_PROFILES,
  DEFAULT_COMPOSITION,
  RED_DEFENSE,
  RED_COMPOSITION,
  BLUE_START,
} from "../src/config.js";
import { Grid } from "../src/navigation/Grid.js";
import { findPath } from "../src/navigation/AStar.js";
import { Army } from "../src/units/Army.js";
import { Game } from "../src/systems/Game.js";
const grid = () =>
  new Grid(C.worldSize, C.cellSize, OBSTACLES, C.soldierRadius, TERRAIN_ZONES);

test("same endpoints produce three meaningful routes with a direct aggressive and safer guard route", () => {
  const g = grid();
  const paths = Object.fromEntries(
    Object.entries(PATH_PROFILES).map(([type, p]) => [
      type,
      findPath(g, BLUE_START, { x: 38, z: 4 }, p),
    ]),
  );
  const { warrior, berserker, guard } = paths;
  assert.ok(berserker.length < warrior.length);
  assert.ok(warrior.length < guard.length);
  assert.ok(guard.meanClearance > warrior.meanClearance);
  const minClearance = (p) =>
    Math.min(
      ...p.waypoints.map((w) => {
        const c = g.toCell(w);
        return g.clearance[g.index(c.x, c.z)];
      }),
    );
  assert.ok(minClearance(guard) > minClearance(berserker));
  assert.deepEqual(warrior.crossings, ["Stone Bridge"]);
  assert.deepEqual(berserker.crossings, ["Wooden Bridge"]);
  assert.deepEqual(guard.crossings, ["Southern Ford"]);
  assert.ok(berserker.expanded < warrior.expanded);
  for (const p of Object.values(paths)) {
    const type = Object.keys(paths).find((t) => paths[t] === p),
      profile = PATH_PROFILES[type];
    const expected = p.waypoints
      .slice(1)
      .reduce(
        (sum, w, i) =>
          sum +
          Math.hypot(w.x - p.waypoints[i].x, w.z - p.waypoints[i].z) *
            (1 + g.traversalPenalty(g.toCell(w), profile)),
        0,
      );
    assert.ok(
      Math.abs(expected - p.cost) < 1e-6,
      "weighted cost matches route",
    );
    for (let i = 1; i < p.waypoints.length; i++)
      assert.ok(g.segmentClear(p.waypoints[i - 1], p.waypoints[i]));
  }
  console.log(
    "Profile comparison:",
    Object.fromEntries(
      Object.entries(paths).map(([type, p]) => [
        type,
        {
          length: +p.length.toFixed(1),
          expanded: p.expanded,
          clearance: +p.meanClearance.toFixed(2),
        },
      ]),
    ),
  );
});

test("class-specific order leaves other groups orders unchanged; arrival slots are unique", () => {
  const army = new Army(new THREE.Scene(), grid(), {
    composition: DEFAULT_COMPOSITION,
  });
  army.setSelected(true);
  assert.ok(army.command({ x: 38, z: 4 }));
  assert.deepEqual(
    Object.keys(army.paths).sort(),
    Object.keys(PATH_PROFILES).sort(),
  );
  assert.equal(
    new Set(army.active.map((s) => s.orderDestination.toArray().join(",")))
      .size,
    30,
  );
  const warriorOrders = army.members("warrior").map((s) => s.route);
  const guardOrders = army.members("guard").map((s) => s.route);
  army.setSelected(true, "berserker");
  assert.ok(army.command({ x: -25, z: 12 }));
  assert.deepEqual(
    army.members("warrior").map((s) => s.route),
    warriorOrders,
  );
  assert.deepEqual(
    army.members("guard").map((s) => s.route),
    guardOrders,
  );
  assert.equal(army.active.filter((s) => s.selected).length, 10);
  const before = army.active.map((s) => s.route);
  assert.equal(army.command({ x: 200, z: 0 }), null);
  assert.deepEqual(
    army.active.map((s) => s.route),
    before,
  );
});

test("each type retains profile-specific Boids weights without joining another route group", () => {
  const g = new Grid(120, 1.5),
    army = new Army(new THREE.Scene(), g, { composition: DEFAULT_COMPOSITION });
  army.command({ x: 30, z: 0 });
  for (let i = 0; i < 240; i++) army.update(1 / 60);
  for (const [type, profile] of Object.entries(BOID_PROFILES)) {
    const members = army.members(type),
      center = army.centerOf(members);
    assert.ok(
      members.every((s) => s.position.distanceTo(center) < 15),
      type + " cohesion",
    );
    assert.ok(members.some((s) => s.debugForces));
    for (const s of members)
      if (s.debugForces) {
        assert.equal(s.debugWeights.target, C.targetWeight * profile.target);
        assert.equal(
          s.debugWeights.cohesion,
          C.cohesionWeight * profile.cohesion,
        );
      }
  }
});

test("fixed defenders are walkable, class-positioned, and hold before and after distant battle start", () => {
  const game = new Game(new THREE.Scene(), grid());
  assert.equal(game.composition.warrior, 0);
  assert.equal(game.deploy(), false);
  for (const [type, home] of Object.entries(RED_DEFENSE)) {
    const members = game.red.members(type);
    assert.equal(members.length, RED_COMPOSITION[type]);
    assert.ok(members.every((s) => game.grid.canStand(s.position)));
    assert.ok(
      members.every(
        (s) => Math.hypot(s.position.x - home.x, s.position.z - home.z) < 6,
      ),
    );
  }
  const positions = game.red.active.map((s) => s.position.toArray());
  for (let i = 0; i < 60; i++) game.update(1 / 60);
  assert.deepEqual(
    game.red.active.map((s) => s.position.toArray()),
    positions,
  );
  game.composition = { ...DEFAULT_COMPOSITION };
  game.deploy();
  game.start();
  for (let i = 0; i < 300; i++) game.update(1 / 60);
  assert.deepEqual(
    game.red.active.map((s) => s.position.toArray()),
    positions,
  );
  game.reset();
  assert.deepEqual(
    game.red.active.map((s) => s.position.toArray()),
    positions,
  );
});

test("comparison previews route costs without moving troops or starting war", () => {
  const game = new Game(new THREE.Scene(), grid());
  game.composition = { ...DEFAULT_COMPOSITION };
  game.deploy();
  const before = game.blue.active.map((s) => s.position.toArray());
  game.compareRoutes();
  game.update(10);
  assert.equal(game.phase, "PREPARATION");
  assert.equal(Object.keys(game.previewPaths).length, 3);
  assert.equal(Object.keys(game.blue.paths).length, 0);
  assert.deepEqual(
    game.blue.active.map((s) => s.position.toArray()),
    before,
  );
});
