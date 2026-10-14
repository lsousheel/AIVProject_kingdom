import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Army } from "../src/units/Army.js";
import { Grid } from "../src/navigation/Grid.js";
import { EnemySystem } from "../src/systems/EnemySystem.js";
import { CombatSystem } from "../src/systems/CombatSystem.js";
import { CONFIG } from "../src/config.js";

function armies() {
  const grid = new Grid(120, 1.5), scene = new THREE.Scene();
  const blue = new Army(scene, grid, {
    start: { x: 16, z: 3 }, composition: { warrior: 1 },
  });
  const red = new Army(scene, grid, {
    team: "red", start: { x: 30, z: 3 }, composition: { warrior: 2 },
  });
  return { grid, blue, red };
}

test("defenders keep a moving formation's route until its target moves significantly", () => {
  const { blue, red } = armies(), enemy = new EnemySystem();
  enemy.update(red, blue, 1 / 60);
  assert.equal(red.routeRevision, 1);
  const route = red.active[0].route;
  for (let i = 0; i < 120; i++) red.update(1 / 60);
  const waypoint = red.active[0].waypoint;
  blue.active[0].position.z += 0.5;
  enemy.update(red, blue, CONFIG.enemyOrderInterval);
  assert.equal(red.routeRevision, 1);
  assert.equal(red.active[0].route, route);
  assert.equal(red.active[0].waypoint, waypoint, "no return to formation anchor");
  blue.active[0].position.z += 5;
  enemy.update(red, blue, CONFIG.enemyOrderInterval);
  assert.equal(red.routeRevision, 2, "moving invaders still get a response");
});

test("pursuit keeps progress for stationary targets and replans for moving targets", () => {
  const { grid, blue, red } = armies(), combat = new CombatSystem(grid);
  const pursuer = red.active[0], target = blue.active[0];
  pursuer.position.copy(target.position).add(new THREE.Vector3(8, 0, 0));
  combat.update(blue, red, 1 / 60);
  const route = pursuer.route;
  assert.ok(
    route[pursuer.waypoint].clone().sub(pursuer.position)
      .dot(target.position.clone().sub(pursuer.position)) > 0,
    "pursuit starts forward instead of returning to the rounded start cell",
  );
  for (let i = 0; i < 120; i++) {
    combat.update(blue, red, 1 / 60);
    red.update(1 / 60);
  }
  assert.equal(pursuer.route, route, "stationary pursuit does not restart periodically");
  assert.ok(pursuer.position.distanceTo(target.position) < 8);
  target.position.z += 4;
  combat.update(blue, red, CONFIG.engagementRepathInterval);
  assert.notEqual(pursuer.route, route);
  assert.ok(pursuer.route.at(-1).equals(target.position));
});

test("brief occlusion preserves pursuit but never allows attacks through a wall", () => {
  const { grid, blue, red } = armies(), combat = new CombatSystem(grid);
  const pursuer = red.active[0], target = blue.active[0];
  pursuer.position.copy(target.position).add(new THREE.Vector3(1, 0, 0));
  combat.update(blue, red, 1 / 60);
  assert.equal(pursuer.target, target);
  const health = target.health;
  // Simulate a corner occluding the line of sight, independent of cell rounding.
  grid.segmentClear = () => false;
  pursuer.cooldown = 0;
  combat.update(blue, red, CONFIG.targetSightGrace / 2);
  assert.equal(pursuer.target, target);
  assert.equal(target.health, health);
  combat.update(blue, red, CONFIG.targetSightGrace);
  assert.equal(pursuer.target, null, "persistent occlusion releases the target");
  assert.equal(target.health, health);
});
