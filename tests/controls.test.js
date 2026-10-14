import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Game } from "../src/systems/Game.js";
import { Grid } from "../src/navigation/Grid.js";
import { Army } from "../src/units/Army.js";
import { CombatSystem } from "../src/systems/CombatSystem.js";
import {
  CONFIG as C,
  OBSTACLES,
  TERRAIN_ZONES,
  DEFAULT_COMPOSITION,
} from "../src/config.js";

test("Start War holds the placed formation until the player chooses an attack destination", () => {
  const grid = new Grid(
    C.worldSize,
    C.cellSize,
    OBSTACLES,
    C.soldierRadius,
    TERRAIN_ZONES,
  );
  const game = new Game(new THREE.Scene(), grid);
  game.composition = { ...DEFAULT_COMPOSITION };
  assert.ok(game.deploy({ x: -40, z: 5 }));
  assert.equal(game.blue.active.length, 30);
  const positions = game.blue.active.map(s => s.position.clone());
  assert.ok(game.start());
  assert.equal(game.placementArmed, false);
  assert.deepEqual(game.blue.paths, {});
  for (let i = 0; i < 180; i++) game.update(1 / 60);
  game.blue.active.forEach((s, i) => {
    assert.ok(s.position.equals(positions[i]), "holds the chosen formation");
    assert.ok(s.arrived);
  });
  assert.ok(game.command({ x: 38, z: 4 }, { attackMove: true }));
  assert.deepEqual(Object.keys(game.blue.paths).sort(), [
    "berserker",
    "guard",
    "warrior",
  ]);
  assert.ok(game.blue.active.every((s) => !s.arrived && !s.moveOnly));
  let reacted = false,
    damaged = false;
  for (let i = 0; i < 7200 && game.phase === "BATTLE"; i++) {
    game.update(1 / 60);
    reacted ||= game.red.routeRevision > 0;
    damaged ||= game.blue.soldiers.some((s) => s.health < s.maxHealth);
  }
  assert.ok(reacted, "Red reacts without another player order");
  assert.ok(damaged, "combat occurs after the chosen attack order");
  assert.notEqual(game.phase, "BATTLE", "default battle resolves");
});

test("selected class can disengage while other classes keep their orders and combat resumes on arrival", () => {
  const grid = new Grid(80, 1.5),
    scene = new THREE.Scene();
  const blue = new Army(scene, grid, {
    start: { x: 0, z: 0 },
    composition: { warrior: 1, guard: 1 },
  });
  const red = new Army(scene, grid, {
    team: "red",
    start: { x: 1.5, z: 0 },
    composition: { warrior: 1 },
  });
  const combat = new CombatSystem(grid),
    soldier = blue.members("warrior")[0],
    guard = blue.members("guard")[0];
  red.active[0].position.copy(soldier.position).add(new THREE.Vector3(0, 0, 1));
  combat.update(blue, red, 1 / 60);
  assert.equal(soldier.state, "ATTACKING");
  const guardRoute = guard.route;
  blue.setSelected(true, "warrior");
  assert.ok(blue.command({ x: -12, z: 0 }, "warrior", { attackMove: false }));
  const route = soldier.route,
    position = soldier.position.clone(),
    health = soldier.health;
  combat.update(blue, red, 1);
  assert.equal(soldier.state, "MOVING");
  assert.equal(soldier.target, null);
  assert.equal(soldier.route, route, "combat must not replace the move order");
  assert.equal(guard.route, guardRoute, "unselected class keeps its route");
  assert.ok(
    soldier.health < health,
    "retreating soldiers can still take damage",
  );
  for (let i = 0; i < 60; i++) blue.update(1 / 60);
  assert.ok(
    soldier.position.distanceTo(position) > 1,
    "soldier actually moves out of combat",
  );
  soldier.arrived = true;
  red.active[0].position.copy(soldier.position).add(new THREE.Vector3(1, 0, 0));
  combat.update(blue, red, 1 / 60);
  assert.equal(soldier.moveOnly, false);
  assert.equal(soldier.state, "ATTACKING");
});
