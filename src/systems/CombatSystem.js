import * as THREE from "three";
import { CONFIG, PATH_PROFILES } from "../config.js";
import { findPath } from "../navigation/AStar.js";

export class CombatSystem {
  constructor(grid) {
    this.grid = grid;
  }
  setRoute(s, destination) {
    const path = findPath(
      this.grid,
      s.position,
      destination,
      PATH_PROFILES[s.unitType],
    );
    if (!path) return false;
    s.tracedRoute = false;
    s.route = path.waypoints.map((p) => new THREE.Vector3(p.x, 0, p.z));
    // Include the actual destination, and avoid walking back to the start cell
    // center when the next segment is already visible from the soldier.
    const endpoint = new THREE.Vector3(destination.x, 0, destination.z);
    if (this.grid.segmentClear(s.route.at(-1), endpoint)) s.route.push(endpoint);
    s.waypoint =
      s.route.length > 1 && this.grid.segmentClear(s.position, s.route[1])
        ? 1
        : 0;
    s.arrived = false;
    return true;
  }
  update(blue, red, dt) {
    // Snapshot active units and collect damage before applying it: neither team
    // gets a first-update advantage, and simultaneous deaths are well defined.
    const blueUnits = blue.active,
      redUnits = red.active,
      hits = [];
    for (const [allies, enemies] of [
      [blueUnits, redUnits],
      [redUnits, blueUnits],
    ])
      for (const s of allies) {
        s.cooldown = Math.max(0, s.cooldown - dt);
        s.repathTimer -= dt;
        // Explicit player movement must be able to disengage from a fight.
        // The army still receives damage; only automatic pursuit is suspended.
        if (s.moveOnly && !s.arrived) {
          s.target = null;
          s.targetUnseenTime = 0;
          s.pursuitDestination = null;
          s.state = "MOVING";
          continue;
        }
        s.moveOnly = false;
        let target = s.target;
        const visible = (t) => this.grid.segmentClear(s.position, t.position);
        let targetVisible = target?.alive && visible(target);
        s.targetUnseenTime = targetVisible
          ? 0
          : (s.targetUnseenTime ?? 0) + dt;
        if (
          !target?.alive ||
          s.position.distanceTo(target.position) >
            CONFIG.detectionRadius * 1.5 ||
          (!targetVisible && s.targetUnseenTime > CONFIG.targetSightGrace)
        ) {
          target = null;
          let nearest = CONFIG.detectionRadius;
          for (const enemy of enemies) {
            const distance = s.position.distanceTo(enemy.position);
            if (distance < nearest && visible(enemy)) {
              target = enemy;
              nearest = distance;
            }
          }
          targetVisible = target !== null;
        }
        if (!target) {
          if (
            s.target ||
            s.state === "ATTACKING" ||
            s.state === "SEEKING_ENEMY"
          ) {
            s.target = null;
            s.pursuitDestination = null;
            s.state = "MOVING";
            if (!s.orderDestination || !this.setRoute(s, s.orderDestination)) {
              s.route = [];
              s.arrived = true;
              s.state = "IDLE";
            }
          }
          continue;
        }
        const changed = target !== s.target;
        if (changed) s.targetUnseenTime = 0;
        s.target = target;
        const distance = s.position.distanceTo(target.position);
        if (distance <= s.attackRange && targetVisible) {
          s.state = "ATTACKING";
          s.velocity.set(0, 0, 0);
          s.debugForces = null;
          s.mesh.rotation.y = Math.atan2(
            target.position.x - s.position.x,
            target.position.z - s.position.z,
          );
          if (s.cooldown <= 0) {
            hits.push({
              target,
              damage: Math.max(1, s.attackDamage - target.defense),
            });
            s.cooldown = s.attackCooldown;
          }
        } else {
          s.state = "SEEKING_ENEMY";
          const targetMoved =
            !s.pursuitDestination ||
            target.position.distanceTo(s.pursuitDestination) >=
              this.grid.cellSize * 0.75;
          if (
            targetVisible &&
            (changed ||
              (s.repathTimer <= 0 && (targetMoved || s.arrived)))
          ) {
            if (this.setRoute(s, target.position))
              s.pursuitDestination = target.position.clone();
            s.repathTimer = CONFIG.engagementRepathInterval;
          }
        }
      }
    for (const { target, damage } of hits) target.takeDamage(damage);
    for (const s of [...blueUnits, ...redUnits]) s.sync();
  }
}

export function battleOutcome(blue, red) {
  if (!blue.active.length && !red.active.length) return "DRAW";
  if (!red.active.length) return "VICTORY";
  if (!blue.active.length) return "DEFEAT";
  return null;
}
