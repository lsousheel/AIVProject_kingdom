import * as THREE from "three";
import { CONFIG as C, BOID_PROFILES, PATH_PROFILES } from "../config.js";
import { findPath } from "../navigation/AStar.js";

export function updateBoids(soldiers, grid, dt) {
  // Snapshot forces first: updates must not depend on soldier iteration order.
  const forces = soldiers.map((s) => {
    s.debugForces = null;
    s.debugNeighbors = 0;
    s.debugSteering = new THREE.Vector3();
    if (s.state === "ATTACKING") return new THREE.Vector3();
    const speed = s.movementSpeed ?? C.speed;
    const profile = BOID_PROFILES[s.unitType] ?? BOID_PROFILES.warrior;
    const weights = {
      separation: C.separationWeight * profile.separation,
      cohesion: C.cohesionWeight * profile.cohesion,
      alignment: C.alignmentWeight * profile.alignment,
      target: C.targetWeight * profile.target,
    };
    s.debugWeights = weights;
    const separation = new THREE.Vector3(),
      center = new THREE.Vector3(),
      alignment = new THREE.Vector3();
    let count = 0;
    for (const other of soldiers) {
      if (other === s) continue;
      const d = s.position.distanceTo(other.position);
      if (
        d < C.neighborRadius &&
        grid.segmentClear(s.position, other.position)
      ) {
        // Cohesion/alignment stay inside the route group. Separation still
        // sees all teammates so groups do not stack when routes intersect.
        if (other.unitType === s.unitType) {
          center.add(other.position);
          alignment.add(other.velocity);
          count++;
        }
        if (d < C.separationRadius && d > 0.001)
          separation.addScaledVector(
            new THREE.Vector3().subVectors(s.position, other.position),
            1 / (d * d),
          );
      }
    }
    const cohesion = count
      ? center
          .divideScalar(count)
          .sub(s.position)
          .multiplyScalar(1 / C.neighborRadius)
      : center;
    s.debugNeighbors = count;
    if (count)
      alignment
        .divideScalar(count)
        .sub(s.velocity)
        .multiplyScalar(1 / speed);
    while (
      s.waypoint < s.route.length &&
      s.position.distanceTo(s.route[s.waypoint]) < C.waypointRadius
    )
      s.waypoint++;
    s.arrived = s.waypoint >= s.route.length;
    if (s.arrived) {
      s.state = "IDLE";
      return new THREE.Vector3();
    }
    // Local forces can balance out at a bottleneck or behind an arrived group.
    // Detect lack of progress and briefly prioritize the existing global route.
    s.progressTimer = (s.progressTimer ?? 0) + dt;
    s.recoveryTime = Math.max(0, (s.recoveryTime ?? 0) - dt);
    s.progressPosition ??= s.position.clone();
    if (s.progressTimer >= C.stallCheckInterval) {
      if (s.position.distanceTo(s.progressPosition) < C.stallDistance)
        s.recoveryTime = C.recoveryDuration;
      s.progressPosition.copy(s.position);
      s.progressTimer = 0;
    }
    // An individual advances its own waypoint; a fast leader cannot skip a
    // waypoint for its group. Bound failed repair searches instead of running
    // A* on every frame while local steering is temporarily obstructed.
    s.repairCooldown = Math.max(0, (s.repairCooldown ?? 0) - dt);
    if (
      s.repairCooldown === 0 &&
      !grid.segmentClear(s.position, s.route[s.waypoint])
    ) {
      s.repairCooldown = 0.5;
      const repair = findPath(
        grid,
        s.position,
        s.tracedRoute ? s.route[s.waypoint] : s.route.at(-1),
        PATH_PROFILES[s.unitType],
      );
      if (repair) {
        const remaining = s.tracedRoute ? s.route.slice(s.waypoint) : [];
        s.route = [...repair.waypoints.map((p) => new THREE.Vector3(p.x, 0, p.z)), ...remaining];
        s.waypoint = Math.min(1, s.route.length - 1);
      }
    }
    // Short visible lookahead reduces grid zigzags; never steer through a wall.
    let target = s.route[s.waypoint];
    const lookaheadEnd = Math.min(s.route.length, s.waypoint + (s.tracedRoute ? 1 : 3));
    for (let i = s.waypoint + 1; i < lookaheadEnd; i++) {
      if (grid.segmentClear(s.position, s.route[i])) {
        target = s.route[i];
        s.waypoint = i;
      } else break;
    }
    const direction = new THREE.Vector3()
      .subVectors(target, s.position)
      .normalize();
    s.debugForces = {
      separation: separation.clone(),
      cohesion: cohesion.clone(),
      alignment: alignment.clone(),
      target: direction.clone(),
    };
    const desired = direction
      .clone()
      .multiplyScalar(weights.target)
      .addScaledVector(separation, weights.separation)
      .addScaledVector(cohesion, weights.cohesion)
      .addScaledVector(alignment, weights.alignment)
      .normalize()
      .multiplyScalar(speed);
    if (
      s.tracedRoute || s.recoveryTime > 0 ||
      s.position.distanceTo(s.route.at(-1)) < C.arrivalSteeringRadius
    )
      desired
        .copy(direction)
        .multiplyScalar(Math.min(speed, s.position.distanceTo(target) * 3));
    // Near obstacles the route takes priority over social steering.
    const probe = s.position
      .clone()
      .addScaledVector(desired, C.obstacleProbeTime);
    if (!grid.segmentClear(s.position, probe))
      desired.copy(direction).multiplyScalar(speed);
    const steering = desired.sub(s.velocity).clampLength(0, C.acceleration);
    s.debugSteering.copy(steering);
    return steering;
  });
  soldiers.forEach((s, i) => {
    if (s.arrived || s.state === "ATTACKING") {
      s.velocity.set(0, 0, 0);
      s.sync();
      return;
    }
    s.velocity
      .addScaledVector(forces[i], dt)
      .clampLength(0, s.movementSpeed ?? C.speed);
    const next = s.position.clone().addScaledVector(s.velocity, dt);
    if (grid.segmentClear(s.position, next)) s.position.copy(next);
    else s.velocity.set(0, 0, 0);
    s.sync();
  });
  // Small positional separation prevents visible overlap without a physics engine.
  for (let i = 0; i < soldiers.length; i++)
    for (let j = i + 1; j < soldiers.length; j++) {
      const a = soldiers[i],
        b = soldiers[j],
        delta = a.position.clone().sub(b.position),
        d = delta.length(),
        min = C.soldierRadius * 2;
      if (d >= min) continue;
      if (d < 0.001) delta.set(1, 0, 0);
      else delta.divideScalar(d);
      for (const [s, sign] of [
        [a, 1],
        [b, -1],
      ]) {
        if (s.state === "ATTACKING") continue;
        const p = s.position
          .clone()
          .addScaledVector(delta, (sign * (min - d)) / 2);
        if (grid.segmentClear(s.position, p)) s.position.copy(p);
        s.sync();
      }
    }
}
