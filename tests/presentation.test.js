import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Grid } from '../src/navigation/Grid.js';
import { Game } from '../src/systems/Game.js';
import { Army } from '../src/units/Army.js';
import { findPath } from '../src/navigation/AStar.js';
import { groupMetrics } from '../src/navigation/PresentationMetrics.js';
import { CONFIG as C, OBSTACLES, TERRAIN_ZONES, PATH_PROFILES } from '../src/config.js';
const grid = () => new Grid(C.worldSize,C.cellSize,OBSTACLES,C.soldierRadius,TERRAIN_ZONES);

test('A* exposes real terminal frontier, expansion history and measured search time', () => {
  const g = grid(), p = findPath(g,{x:-38,z:0},{x:38,z:4},PATH_PROFILES.warrior);
  assert.ok(p.computationMs >= 0 && Number.isFinite(p.computationMs));
  assert.equal(p.visited.length,p.expanded);
  assert.ok(p.frontier.length > 0);
  assert.ok(p.frontier.every(w=>g.canStand(w)));
  const ids = new Set(p.visited.map(w=>JSON.stringify(w)));
  assert.ok(p.frontier.every(w=>!ids.has(JSON.stringify(w))));
});

for(const preset of ['field','forest','gate','groups']) test(`${preset} demo reaches destination safely and restores preparation`, () => {
  const game = new Game(new THREE.Scene(),grid());
  game.composition={warrior:3,berserker:2,guard:3}; game.deploy(); game.compareRoutes();
  const before=game.blue.active.map(s=>s.position.toArray()), preview=game.previewPaths;
  const red=game.red.active.map(s=>s.position.toArray());
  assert.ok(game.startDemo(preset));
  assert.ok(game.blue.active.every(s=>game.grid.canStand(s.position)));
  for(let i=0;i<12000&&!game.blue.active.every(s=>s.arrived);i++) {
    game.update(1/60);
    assert.ok(game.blue.active.every(s=>game.grid.canStand(s.position)));
  }
  assert.ok(game.blue.active.every(s=>s.arrived));
  assert.ok(Object.values(game.blue.runs).every(r=>r.finished&&r.elapsed>0&&r.samples>0));
  assert.deepEqual(game.red.active.map(s=>s.position.toArray()),red);
  game.exitDemo();
  assert.equal(game.phase,'PREPARATION');
  assert.deepEqual(game.blue.active.map(s=>s.position.toArray()),before);
  assert.equal(game.previewPaths,preview);
  assert.ok(game.start());
});

test('Boids inspection reflects neighbors, force directions and final acceleration', () => {
  const g=new Grid(120,1.5), army=new Army(new THREE.Scene(),g,{composition:{warrior:2}});
  const [a,b]=army.active;
  a.position.set(-20,0,0); b.position.set(-19,0,0); b.velocity.set(0,0,1);
  assert.ok(army.command({x:10,z:0})); army.update(1/60);
  assert.equal(a.debugNeighbors,1);
  assert.ok(a.debugForces.separation.x<0);
  assert.ok(a.debugForces.cohesion.x>0);
  assert.ok(a.debugForces.alignment.z>0);
  assert.ok(a.debugForces.target.x>0);
  assert.ok(a.debugSteering.length()<=C.acceleration+1e-8);
  const strong=a.debugForces.separation.length();
  b.position.copy(a.position).add(new THREE.Vector3(3,0,0)); army.update(1/60);
  assert.ok(a.debugForces.separation.length()<strong);
});

test('group progress requires quorum; one leader cannot advance the rest', () => {
  const g=new Grid(120,1.5), army=new Army(new THREE.Scene(),g,{composition:{warrior:10}});
  army.command({x:20,z:0});
  army.active[0].waypoint=army.active[0].route.length;
  for (const s of army.active) s.position.set(army.paths.warrior.waypoints[0].x,0,army.paths.warrior.waypoints[0].z);
  army.active[0].arrived=true;
  assert.equal(groupMetrics(army,g,'warrior').progress,0);
  for(const s of army.active.slice(0,7)) s.arrived=true;
  assert.equal(groupMetrics(army,g,'warrior').progress,1);
});

for (const type of Object.keys(PATH_PROFILES)) test(`${type} selected command moves only that class with its own profile`, () => {
  const g = new Grid(120,1.5), army = new Army(new THREE.Scene(),g,{composition:{warrior:3,berserker:3,guard:3}});
  army.setSelected(true,type);
  const others=army.active.filter(s=>s.unitType!==type), before=others.map(s=>s.position.toArray());
  assert.ok(army.command({x:10,z:0}));
  assert.equal(army.paths[type].mode,PATH_PROFILES[type].label);
  for(let i=0;i<60;i++) army.update(1/60);
  assert.deepEqual(others.map(s=>s.position.toArray()),before);
  assert.ok(army.members(type).every(s=>s.velocity.length()>0));
});
