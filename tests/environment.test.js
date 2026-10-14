import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  CONFIG as C,
  OBSTACLES,
  TERRAIN_ZONES,
  PATH_PROFILES,
  BLUE_START,
  DEFAULT_COMPOSITION,
  BATTLEFIELD,
} from "../src/config.js";
import { Grid } from "../src/navigation/Grid.js";
import { findPath } from "../src/navigation/AStar.js";
import { Game } from "../src/systems/Game.js";
import { Battlefield } from "../src/world/Battlefield.js";
const worldGrid = () =>
  new Grid(C.worldSize, C.cellSize, OBSTACLES, C.soldierRadius, TERRAIN_ZONES);

test("river is blocked except at all three traversable crossings; closing one changes the chosen route", () => {
  const g = worldGrid();
  for (const c of BATTLEFIELD.crossings) {
    assert.ok(g.canStand(c));
    assert.ok(g.segmentClear({ x: -26, z: c.z }, { x: -10, z: c.z }), c.name);
  }
  for (const z of [-58, -40, -8, 9, 44, 58])
    assert.equal(g.canStand({ x: -18, z }), false);
  assert.equal(g.segmentClear({ x: -26, z: 9 }, { x: -10, z: 9 }), false);
  for (const o of [
    ...BATTLEFIELD.ruins,
    ...BATTLEFIELD.walls,
    BATTLEFIELD.castle,
  ])
    assert.equal(g.canStand(o), false);
  const original = findPath(
    g,
    BLUE_START,
    { x: 38, z: 4 },
    PATH_PROFILES.berserker,
  );
  assert.deepEqual(original.crossings, ["Wooden Bridge"]);
  for (let z = 0; z < g.count; z++)
    for (let x = 0; x < g.count; x++) {
      const p = g.toWorld({ x, z });
      if (Math.abs(p.x + 18) < 6 && Math.abs(p.z) < 4)
        g.blocked[g.index(x, z)] = 1;
    }
  g.computeClearance();
  const alternate = findPath(
    g,
    BLUE_START,
    { x: 38, z: 4 },
    PATH_PROFILES.berserker,
  );
  assert.ok(alternate);
  assert.ok(!alternate.crossings.includes("Wooden Bridge"));
  assert.ok(alternate.length > original.length);
});

test("discounted road heuristic matches Dijkstra cost and can favor a longer physical route", () => {
  const g = new Grid(36, 1, [], 0, [
    {
      terrain: "road",
      cost: 0.6,
      points: [
        [-14, 0],
        [-14, -6],
        [14, -6],
        [14, 0],
      ],
      width: 2,
    },
  ]);
  const p = { label: "Cost test", terrainWeight: 1, heuristicWeight: 1 };
  const a = findPath(g, { x: -14, z: 0 }, { x: 14, z: 0 }, p);
  const d = findPath(
    g,
    { x: -14, z: 0 },
    { x: 14, z: 0 },
    { ...p, heuristicWeight: 0 },
  );
  assert.ok(Math.abs(a.cost - d.cost) < 1e-8);
  assert.ok(a.length > 28);
  assert.ok(a.cost < 28);
  assert.ok(a.terrainTypes.includes("road"));
});

for (const region of ["bridge", "ruins"])
  test(`${region} swarm lab completes with collision checks, separation and restored preparation`, () => {
    const g = new Game(new THREE.Scene(), worldGrid());
    g.composition = { ...DEFAULT_COMPOSITION };
    g.formation = "wide";
    g.deploy();
    const original = g.blue.active.map((s) => s.position.toArray());
    const defenders = g.red.active.map((s) => s.position.toArray());
    assert.ok(g.startDemo(region));
    assert.equal(g.start(), false);
    assert.equal(g.deploy(), false);
    const initialWidth =
      Math.max(...g.blue.active.map((s) => s.position.z)) -
      Math.min(...g.blue.active.map((s) => s.position.z));
    let bridgeWidth = 0,
      bridgeSamples = 0,
      minSpacing = Infinity;
    const stationary = g.blue.active[0].position.clone();
    g.paused = true;
    g.update(1);
    assert.ok(g.blue.active[0].position.equals(stationary));
    g.paused = false;
    for (let i = 0; i < 7200 && !g.blue.active.every((s) => s.arrived); i++) {
      g.update(1 / 60);
      for (const s of g.blue.active) {
        assert.ok(g.grid.canStand(s.position));
        assert.equal(s.health, s.maxHealth);
      }
      const crossing = g.blue.active.filter(
        (s) => Math.abs(s.position.x + 18) < 3,
      );
      if (crossing.length > 2) {
        bridgeSamples++;
        bridgeWidth = Math.max(
          bridgeWidth,
          Math.max(...crossing.map((s) => s.position.z)) -
            Math.min(...crossing.map((s) => s.position.z)),
        );
        for (let a = 0; a < crossing.length; a++)
          for (let b = a + 1; b < crossing.length; b++)
            minSpacing = Math.min(
              minSpacing,
              crossing[a].position.distanceTo(crossing[b].position),
            );
      }
    }
    assert.ok(
      g.blue.active.every((s) => s.arrived),
      "all 24 agents arrive",
    );
    const finalWidth =
      Math.max(...g.blue.active.map((s) => s.position.z)) -
      Math.min(...g.blue.active.map((s) => s.position.z));
    if (region === "bridge") {
      assert.ok(bridgeSamples > 60);
      assert.ok(bridgeWidth < initialWidth * 0.6, "group compresses");
      assert.ok(finalWidth > bridgeWidth * 1.5, "group expands after exit");
      assert.ok(
        minSpacing >= C.soldierRadius * 2 - 0.03,
        "no overlapping bodies on bridge",
      );
      console.log("Bridge compression:", {
        initialWidth,
        bridgeWidth,
        finalWidth,
        minSpacing,
      });
    }
    assert.deepEqual(
      g.red.active.map((s) => s.position.toArray()),
      defenders,
    );
    g.exitDemo();
    assert.equal(g.phase, "PREPARATION");
    assert.deepEqual(g.composition, DEFAULT_COMPOSITION);
    assert.equal(g.formation, "wide");
    assert.deepEqual(
      g.blue.active.map((s) => s.position.toArray()),
      original,
    );
  });

test("procedural environment builds and batches static regions without rendering dependencies", () => {
  const scene = new THREE.Scene(),
    field = new Battlefield(scene);
  field.animate(0);
  field.animate(3);
  let meshes = 0,
    triangles = 0;
  scene.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      triangles +=
        ((o.geometry.index?.count ?? o.geometry.attributes.position.count) /
          3) *
        (o.count ?? 1);
    }
  });
  assert.ok(field.ground.geometry.attributes.position.count > 1000);
  assert.ok(meshes < 180, "static scene remains batched");
  console.log("Environment meshes:", meshes, "triangles:", triangles);
});
