import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { generateLevel, levelGrid } from '../src/world/LevelGenerator.js';
import { Game } from '../src/systems/Game.js';
import { findPath } from '../src/navigation/AStar.js';
import { PATH_PROFILES, DEFAULT_COMPOSITION, BLUE_START } from '../src/config.js';

test('generated levels are reproducible and preserve routes, spawns and original grid', () => {
  for (const seed of [0,42,12345,999999]) {
    const level = generateLevel(seed, 'fortified');
    assert.ok(level.obstacles.length >= 8);
    assert.deepEqual(level.obstacles, generateLevel(seed, 'fortified').obstacles);
    assert.notDeepEqual(level.obstacles, generateLevel(seed+ (seed===999999 ? -1 : 1)).obstacles);
    const game = new Game(new THREE.Scene(), level.grid);
    game.composition = {...DEFAULT_COMPOSITION};
    assert.ok(game.deploy());
    assert.ok([...game.blue.active,...game.red.active].every(s=>level.grid.canStand(s.position)));
    for (const profile of Object.values(PATH_PROFILES))
      assert.ok(findPath(level.grid, BLUE_START, {x:38,z:4},profile));
    for (const obstacle of level.obstacles) assert.equal(level.grid.canStand(obstacle), false);
    game.blue.dispose();game.red.dispose();
  }
  assert.deepEqual(levelGrid().blocked, levelGrid().blocked);
  assert.throws(()=>generateLevel(-1));
  assert.throws(()=>generateLevel(1.5));
  assert.throws(()=>generateLevel(1,'invalid'));
});

test('generated battlefield supports a complete moving army and reset', () => {
  const {grid} = generateLevel(42);
  const game = new Game(new THREE.Scene(),grid);
  game.composition = {...DEFAULT_COMPOSITION};
  game.deploy();game.start();
  assert.ok(game.command({x:23,z:10}));
  // Exercise normal movement without advancing opposing AI/combat.
  for (let i=0;i<9000 && !game.blue.active.every(s=>s.arrived);i++) {
    game.blue.update(1/60);
    assert.ok(game.blue.active.every(s=>grid.canStand(s.position)));
  }
  assert.ok(game.blue.active.every(s=>s.arrived));
  game.reset();
  assert.equal(game.phase,'PREPARATION');
  assert.equal(game.grid,grid);
  game.red.dispose();
});
