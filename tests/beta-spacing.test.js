import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Game } from '../src/systems/Game.js';
import { Grid } from '../src/navigation/Grid.js';
import { updateBoids } from '../src/systems/BoidsSystem.js';
import { CONFIG } from '../src/config.js';

test('class spacing changes local steering while keeping the same march order', () => {
  const game = new Game(new THREE.Scene(), new Grid(120, 1.5));
  game.composition = { warrior: 2, guard: 1 };
  assert.ok(game.deploy());
  assert.equal(game.setRankSpacing(true), false);
  game.start();
  game.blue.setSelected(true, 'warrior');
  assert.ok(game.command({ x: -10, z: 0 }));
  const [a,b] = game.blue.members('warrior');
  const path = a.route;
  // Sample at identical positions between the standard and loose spacing radii.
  b.position.copy(a.position);
  b.position.z += CONFIG.separationRadius * 1.25;
  updateBoids([a,b], game.grid, 0);
  assert.equal(a.debugForces.separation.length(), 0);
  assert.ok(game.setRankSpacing(true));
  updateBoids([a,b], game.grid, 0);
  assert.ok(a.debugForces.separation.length() > 0);
  assert.equal(a.route, path);
  assert.ok(!game.blue.members('guard')[0].looseRanks);
  assert.ok(game.setRankSpacing(false));
  updateBoids([a,b], game.grid, 0);
  assert.equal(a.debugForces.separation.length(), 0);
});
