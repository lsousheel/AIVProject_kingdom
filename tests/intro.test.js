import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { briefingScenes, troopBriefing } from '../src/intro/IntroContent.js';
import { IntroCameraTransition, easeInOutCubic } from '../src/intro/IntroCameraTransition.js';
import { UNIT_TYPES } from '../src/config.js';

test('five briefing scenes explain both pillars and use the current troop config', () => {
  const scenes=briefingScenes();
  assert.equal(scenes.length,5);
  assert.match(scenes[1].content,/PATHFINDING & NAVIGATION/);
  assert.match(scenes[1].content,/SWARM & BOIDS MODELING/);
  assert.match(scenes[1].content,/WHERE/);
  assert.match(scenes[1].content,/HOW/);
  for(const troop of troopBriefing()) for(const key of ['health','damage','defense','speed'])
    assert.equal(troop[key],UNIT_TYPES[troop.type][key]);
  assert.match(scenes[3].content,/formation appears immediately/);
  assert.match(scenes[3].content,/left-drag/);
});

function camera() {
  return { focus:new THREE.Vector3(-30,0,14), smoothFocus:new THREE.Vector3(-30,0,14),
    zoom:.48, smoothZoom:.48, keys:new Set(['KeyW']), update() {} };
}
test('cinematic camera starts high and lands exactly at preparation overview', () => {
  const r=camera(), transition=new IntroCameraTransition(r);
  transition.prepare(true);
  assert.equal(r.keys.size,0);
  assert.equal(r.zoom,2);
  let previous=r.zoom;
  for(let i=0;i<239;i++) {
    assert.equal(transition.update(1/60),false);
    assert.ok(r.zoom<=previous); previous=r.zoom;
  }
  assert.equal(transition.update(.1),true);
  assert.equal(r.zoom,1.2);
  assert.deepEqual(r.focus.toArray(),[4,0,0]);
  assert.deepEqual(r.smoothFocus.toArray(),r.focus.toArray());
});
test('replaying in an active game restores its camera target, including reduced motion', () => {
  const r=camera(), transition=new IntroCameraTransition(r);
  transition.prepare(false);
  assert.equal(transition.update(.3,.3),true);
  assert.ok(Math.abs(r.zoom-.48)<1e-12);
  assert.deepEqual(r.focus.toArray(),[-30,0,14]);
  assert.equal(easeInOutCubic(0),0);
  assert.equal(easeInOutCubic(1),1);
});
