import * as THREE from 'three';
import { CONFIG, PATH_PROFILES } from '../config.js';
import { findPath } from '../navigation/AStar.js';

// Local travel-time estimate, not a promise of globally optimal arrival time.
export function preferDetour(directSeconds, waitSeconds, detourSeconds) {
  return detourSeconds + 1 < (directSeconds + waitSeconds) * 0.8;
}

export class TrafficSystem {
  constructor() { this.cooldown = 0; this.cursor = 0; }
  update(soldiers, grid, dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    // Snapshot before steering. Only follow a leader going the same way;
    // opposing/idle soldiers must not create mutual waiting dependencies.
    for (const s of soldiers) {
      s.trafficSpeed = null;
      s.trafficDecision = 'moving';
      s.trafficRelease = Math.max(0, (s.trafficRelease ?? 0) - dt);
      s.trafficQueued = s.trafficQueued ?? 0;
      const target = s.route[s.waypoint];
      const cell = grid.toCell(s.position);
      if (!target || s.arrived || s.target || s.state === 'ATTACKING' || s.trafficRelease > 0 ||
          s.position.distanceTo(s.route.at(-1)) < CONFIG.arrivalSteeringRadius ||
          grid.clearance[grid.index(cell.x, cell.z)] > 3) {
        s.trafficWait = 0; s.trafficQueued = 0; continue;
      }
      const direction = new THREE.Vector3().subVectors(target, s.position).normalize();
      let leader = null, gap = Infinity;
      for (const other of soldiers) {
        if (other === s || other.arrived || other.target || other.state === 'ATTACKING') continue;
        const goal = other.route[other.waypoint];
        if (!goal) continue;
        const heading = new THREE.Vector3().subVectors(goal, other.position).normalize();
        const offset = new THREE.Vector3().subVectors(other.position, s.position);
        const ahead = offset.dot(direction);
        const lateral = offset.clone().addScaledVector(direction, -ahead).length();
        if (ahead > 0.1 && ahead < 2.4 && lateral < CONFIG.soldierRadius * 2 &&
            heading.dot(direction) > 0.7 && ahead < gap && grid.segmentClear(s.position, other.position)) {
          gap = ahead; leader = other;
        }
      }
      if (!leader) { s.trafficWait = 0; s.trafficQueued = 0; continue; }
      s.trafficQueued += dt;
      // A local queue is temporary, never a permanent lock. Let existing
      // collision-aware recovery resolve bent or crossing queues after 3s.
      if (s.trafficQueued > 3) {
        s.trafficRelease = 4; s.trafficQueued = 0; s.trafficWait = 0; continue;
      }
      const speed = s.movementSpeed ?? CONFIG.speed;
      const leaderSpeed = Math.max(0, leader.velocity.dot(direction));
      s.trafficSpeed = Math.min(speed, Math.max(0, leaderSpeed + (gap - 1.2) * 2));
      s.trafficWait = s.trafficSpeed < speed * 0.5 ? (s.trafficWait ?? 0) + dt : 0;
      s.trafficDecision = 'following';
    }
    // At most one bounded local A* search per army per second. Round-robin
    // selection and a savings threshold discourage repeated route switching.
    if (this.cooldown > 0 || !soldiers.length) return;
    for (let n = 0; n < soldiers.length; n++) {
      const index = (this.cursor + n) % soldiers.length, s = soldiers[index];
      if ((s.trafficWait ?? 0) < 1.5) continue;
      this.cursor = (index + 1) % soldiers.length; this.cooldown = 1;
      s.trafficWait = 0;
      let join = s.waypoint, distance = s.position.distanceTo(s.route[join]);
      while (join + 1 < s.route.length && distance < 18) {
        distance += s.route[join].distanceTo(s.route[join + 1]); join++;
      }
      // Keep the destination slot and the rest of the player's route intact.
      const end = s.route[join], occupied = new Set();
      for (const other of soldiers) {
        if (other === s || other.position.distanceTo(s.position) > 20) continue;
        const c = grid.toCell(other.position); occupied.add(grid.index(c.x, c.z));
      }
      const local = Object.create(grid);
      local.walkable = (x,z) => grid.walkable(x,z) &&
        Math.hypot(grid.toWorld({x,z}).x-s.position.x, grid.toWorld({x,z}).z-s.position.z) <= 26;
      local.traversalPenalty = (c,p) => grid.traversalPenalty(c,p) + (occupied.has(grid.index(c.x,c.z)) ? 12 : 0);
      const path = findPath(local, s.position, end, PATH_PROFILES[s.unitType]);
      if (!path) return;
      const queued = new Set();
      for (const p of s.route.slice(s.waypoint, join+1)) {
        const c=grid.toCell(p), id=grid.index(c.x,c.z); if(occupied.has(id)) queued.add(id);
      }
      const speed=s.movementSpeed ?? CONFIG.speed;
      const alternateDelay=path.waypoints.reduce((sum,p)=>{const c=grid.toCell(p);return sum+(occupied.has(grid.index(c.x,c.z))?1.2:0);},0);
      if (!preferDetour(distance/speed, queued.size*1.2, path.length/speed+alternateDelay)) return;
      s.route=[...path.waypoints.map(p=>new THREE.Vector3(p.x,0,p.z)), ...s.route.slice(join+1)];
      s.waypoint=Math.min(1,s.route.length-1);
      s.trafficSpeed=null; s.trafficDecision='detour';
      s.progressTimer=0; s.progressPosition=s.position.clone();
      return;
    }
  }
}
