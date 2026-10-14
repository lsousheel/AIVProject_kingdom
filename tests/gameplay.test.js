import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  CONFIG as C,
  OBSTACLES,
  UNIT_TYPES,
  BLUE_START,
  RED_START,
  DEFAULT_COMPOSITION,
  TERRAIN_ZONES,
  RED_COMPOSITION,
} from "../src/config.js";
import { Grid } from "../src/navigation/Grid.js";
import { Army } from "../src/units/Army.js";
import { Soldier } from "../src/units/Soldier.js";
import { Game } from "../src/systems/Game.js";
import { CombatSystem, battleOutcome } from "../src/systems/CombatSystem.js";
import {
  validComposition,
  validateDeployment,
  formationPositions,
} from "../src/systems/DeploymentSystem.js";

const worldGrid = () =>
  new Grid(C.worldSize, C.cellSize, OBSTACLES, C.soldierRadius, TERRAIN_ZONES);

test("composition rejects negative, fractional, empty, unknown and over-budget units", () => {
  for (const composition of [
    { warrior: -1 },
    { warrior: 31 },
    { warrior: 1.5 },
    { warrior: 0 },
    { wizard: 1 },
  ])
    assert.equal(validComposition(composition), false);
  assert.ok(validComposition(DEFAULT_COMPOSITION));
});
test("all formations fit at staging and reject partial or outside deployment", () => {
  const grid = worldGrid();
  for (const formation of ["block", "line", "wide"]) {
    assert.ok(
      validateDeployment(grid, DEFAULT_COMPOSITION, BLUE_START, formation).ok,
    );
    assert.equal(
      validateDeployment(
        grid,
        DEFAULT_COMPOSITION,
        { x: -28, z: 17 },
        formation,
      ).ok,
      false,
    );
    assert.equal(
      validateDeployment(grid, DEFAULT_COMPOSITION, RED_START, formation).ok,
      false,
    );
  }
  assert.equal(formationPositions(30, BLUE_START, "line").length, 30);
});
test("unit types share architecture, inherit stats, and expose different procedural models", () => {
  const scene = new THREE.Scene();
  for (const [type, stats] of Object.entries(UNIT_TYPES)) {
    const unit = new Soldier(scene, 0, 0, 0, "red", type);
    assert.equal(unit.health, stats.health);
    assert.equal(unit.movementSpeed, stats.speed);
    assert.equal(unit.attackDamage, stats.damage);
    assert.equal(unit.defense, stats.defense);
    assert.equal(unit.team, "red");
    assert.ok(unit.mesh.children.length > 5);
    unit.dispose();
  }
  assert.equal(scene.children.length, 0);
});
test("both mixed armies complete class-profile routes without entering blocked cells", () => {
  for (const [team, start, end] of [
    ["blue", BLUE_START, { x: 35, z: 4 }],
    ["red", RED_START, { x: -35, z: 4 }],
  ]) {
    const grid = worldGrid(),
      army = new Army(new THREE.Scene(), grid, {
        team,
        start,
        composition: DEFAULT_COMPOSITION,
      });
    assert.ok(army.command(end));
    assert.ok(
      army.paths.berserker.crossings.length > 0,
      "route uses a valid crossing",
    );
    for (let i = 0; i < 12000 && !army.active.every((s) => s.arrived); i++) {
      army.update(1 / 60);
      for (const s of army.active) assert.ok(grid.canStand(s.position));
    }
    assert.equal(
      army.active.filter((s) => s.arrived).length,
      30,
      team + " arrival",
    );
  }
});
test("open-field boids stay grouped, separated and aligned while moving", () => {
  const grid = new Grid(120, 1.5),
    army = new Army(new THREE.Scene(), grid, {
      start: { x: -30, z: 0 },
      composition: DEFAULT_COMPOSITION,
    });
  army.command({ x: 30, z: 0 });
  for (let i = 0; i < 360; i++) army.update(1 / 60);
  const center = army.center,
    velocity = army.active
      .reduce((v, s) => v.add(s.velocity), new THREE.Vector3())
      .normalize();
  const spread = Math.max(
    ...army.active.map((s) => s.position.distanceTo(center)),
  );
  const alignment =
    army.active.reduce(
      (sum, s) => sum + s.velocity.clone().normalize().dot(velocity),
      0,
    ) / 30;
  let minimum = Infinity;
  for (let i = 0; i < 30; i++)
    for (let j = i + 1; j < 30; j++)
      minimum = Math.min(
        minimum,
        army.soldiers[i].position.distanceTo(army.soldiers[j].position),
      );
  assert.ok(spread < 18, "group spread " + spread);
  assert.ok(alignment > 0.7, "alignment " + alignment);
  assert.ok(minimum > 0.5, "separation " + minimum);
  assert.ok(army.active.some((s) => s.debugForces?.cohesion.lengthSq() > 0));
  assert.ok(army.active.some((s) => s.debugForces?.alignment.lengthSq() > 0));
});
test("combat applies defense and cooldown, freezes attackers, and excludes the dead", () => {
  const grid = new Grid(30, 1.5),
    scene = new THREE.Scene();
  const blue = new Army(scene, grid, {
    start: { x: 0, z: 0 },
    composition: { warrior: 1 },
  });
  const red = new Army(scene, grid, {
    team: "red",
    start: { x: 1.5, z: 0 },
    composition: { warrior: 1 },
  });
  const combat = new CombatSystem(grid),
    b = blue.active[0],
    r = red.active[0];
  combat.update(blue, red, 1 / 60);
  assert.equal(r.health, 90);
  assert.equal(b.health, 90);
  const position = b.position.clone();
  blue.update(1 / 60);
  assert.ok(b.position.equals(position));
  assert.equal(b.state, "ATTACKING");
  combat.update(blue, red, 0.5);
  assert.equal(r.health, 90);
  combat.update(blue, red, 0.51);
  assert.equal(r.health, 80);
  r.takeDamage(1000);
  assert.equal(red.active.length, 0);
  assert.equal(r.state, "DEAD");
  assert.equal(r.mesh.visible, false);
  assert.equal(r.healthBar.visible, false);
  red.update(1 / 60);
  assert.equal(r.health, 0);
  assert.equal(battleOutcome(blue, red), "VICTORY");
  b.takeDamage(1000);
  assert.equal(battleOutcome(blue, red), "DRAW");
});
test("battle states lock deployment, support pause, defeat, and clean reset", () => {
  const game = new Game(new THREE.Scene(), worldGrid());
  assert.equal(game.start(), false);
  assert.equal(game.command({ x: 10, z: 4 }), null);
  game.composition = { ...DEFAULT_COMPOSITION };
  assert.ok(game.deploy());
  assert.ok(game.start());
  assert.equal(game.deploy(), false);
  game.paused = true;
  game.update(1);
  assert.equal(game.elapsed, 0);
  game.paused = false;
  for (const s of game.blue.active) s.takeDamage(1000);
  game.update(1 / 60);
  assert.equal(game.phase, "DEFEAT");
  game.reset();
  assert.equal(game.phase, "PREPARATION");
  assert.equal(game.blue, null);
  assert.equal(
    game.red.active.length,
    Object.values(RED_COMPOSITION).reduce((a, b) => a + b, 0),
  );
  assert.equal(game.elapsed, 0);
  assert.equal(game.paused, false);
});
test("complete 30-vs-34 battle engages and terminates with a valid result", () => {
  const game = new Game(new THREE.Scene(), worldGrid());
  game.composition = { ...DEFAULT_COMPOSITION };
  game.deploy();
  game.start();
  game.command({ x: 30, z: 4 }, { attackMove: true });
  const start = performance.now();
  let sawDamage = false;
  for (let i = 0; i < 18000 && game.phase === "BATTLE"; i++) {
    game.update(1 / 60);
    if (game.blue.soldiers.some((s) => s.health < s.maxHealth))
      sawDamage = true;
    if (i % 60 === 0)
      for (const army of [game.blue, game.red])
        for (const s of army.active) assert.ok(game.grid.canStand(s.position));
  }
  assert.ok(sawDamage);
  assert.ok(game.red.path);
  assert.ok(
    ["VICTORY", "DEFEAT", "DRAW"].includes(game.phase),
    "battle did not terminate",
  );
  console.log(
    "Full battle:",
    game.elapsed.toFixed(1),
    "simulated seconds;",
    Math.round(performance.now() - start),
    "ms CPU;",
    game.phase,
  );
  const survivor = game.blue.active[0] ?? game.red.active[0];
  const position = survivor?.position.clone();
  game.update(1);
  if (survivor)
    assert.ok(survivor.position.equals(position), "outcome freezes simulation");
});

test("a southern staging and flank order can win a full battle", () => {
  const game = new Game(new THREE.Scene(), worldGrid());
  game.composition = { warrior: 0, berserker: 30, guard: 0 };
  game.deploy({ x: -38, z: 12 });
  game.start();
  game.command({ x: 42, z: 25 }, { attackMove: true });
  for (let i = 0; i < 18000 && game.phase === "BATTLE"; i++)
    game.update(1 / 60);
  assert.equal(game.phase, "VICTORY");
  assert.equal(game.red.active.length, 0);
  assert.ok(game.blue.active.length > 0);
});
