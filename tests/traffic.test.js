import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Grid } from '../src/navigation/Grid.js';
import { TrafficSystem, preferDetour } from '../src/systems/TrafficSystem.js';

function soldier(x, z = 0) {
  return {position:new THREE.Vector3(x,0,z), velocity:new THREE.Vector3(),
    route:[new THREE.Vector3(10,0,z)], waypoint:0, arrived:false,
    state:'MOVING',unitType:'warrior',movementSpeed:4};
}
function corridor() {const g=new Grid(40,1);g.clearance.fill(2);return g;}

test('brief queues beat long detours; substantial time savings permit a detour',()=>{
  assert.equal(preferDetour(5,1,8),false);
  assert.equal(preferDetour(5,12,8),true);
  assert.equal(preferDetour(5,1,5.5),false);
});
test('narrow-area followers slow without stopping the leader; waiting is bounded',()=>{
  const a=soldier(-10),b=soldier(-9),traffic=new TrafficSystem(),grid=corridor();
  traffic.update([a,b],grid,0.1);
  assert.equal(a.trafficSpeed,0);
  assert.equal(b.trafficSpeed,null);
  for(let i=0;i<31;i++)traffic.update([a,b],grid,0.1);
  assert.equal(a.trafficSpeed,null,'release a stalled local queue');
  assert.ok(a.trafficRelease>0);
});
test('open terrain, opposing traffic, combat, and destination slots do not acquire queue locks',()=>{
  for(const scenario of ['open','opposing','combat','arrival']){
    const a=soldier(-10),b=soldier(-9),g=corridor();
    if(scenario==='open')g.clearance.fill(10);
    if(scenario==='opposing')b.route=[new THREE.Vector3(-20,0,0)];
    if(scenario==='combat')a.target=b;
    if(scenario==='arrival')a.route=[new THREE.Vector3(-7,0,0)];
    new TrafficSystem().update([a,b],g,0.1);
    assert.equal(a.trafficSpeed,null,scenario);
  }
});
test('crowded local route takes a cheaper detour and preserves its final destination',()=>{
  const g=corridor(),a=soldier(-10.5,0.5);
  a.route=Array.from({length:26},(_,i)=>new THREE.Vector3(-10.5+i,0,0.5));a.waypoint=1;
  const destination=a.route.at(-1);
  const others=Array.from({length:12},(_,i)=>soldier(-9.5+i,0.5));
  for(const b of others)b.route=[new THREE.Vector3(15.5,0,0.5)];
  a.trafficWait=1.6;
  new TrafficSystem().update([a,...others],g,0.1);
  assert.equal(a.trafficDecision,'detour');
  assert.equal(a.route.at(-1),destination);
  assert.ok(a.route.some(p=>p.z!==0.5),'uses another lane');
  for(let i=1;i<a.route.length;i++)assert.ok(g.segmentClear(a.route[i-1],a.route[i]));
});
