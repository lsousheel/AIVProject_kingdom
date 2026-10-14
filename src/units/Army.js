import * as THREE from "three";
import { Soldier } from "./Soldier.js";
import { findPath } from "../navigation/AStar.js";
import { prepareTrace, findGuidedPath } from "../navigation/GuidedPath.js";
import { updateBoids } from "../systems/BoidsSystem.js";
import { formationPositions } from "../systems/DeploymentSystem.js";
import { CONFIG, BLUE_START, PATH_PROFILES } from "../config.js";
import { groupMetrics } from '../navigation/PresentationMetrics.js';

export class Army {
  constructor(scene, grid, options = {}) {
    this.grid = grid;
    this.scene = scene;
    this.team = options.team ?? "blue";
    this.start = options.start ?? BLUE_START;
    this.formation = options.formation ?? "block";
    this.composition = options.composition ?? { warrior: CONFIG.armySize };
    const types = Object.entries(this.composition).flatMap(([type, count]) =>
      Array(count).fill(type),
    );
    this.initialPositions = options.defenseLayout
      ? Object.entries(this.composition).flatMap(([type, count]) =>
          formationPositions(
            count,
            options.defenseLayout[type],
            options.defenseLayout[type].formation,
          ),
        )
      : formationPositions(types.length, this.start, this.formation);
    this.soldiers = types.map((type, i) => {
      const p = this.initialPositions[i],
        s = new Soldier(scene, p.x, p.z, i, this.team, type, i === 0 || types[i - 1] !== type);
      s.groupId = type;
      s.homePosition = s.position.clone();
      return s;
    });
    this.path = null;
    this.paths = {};
    this.routeRevision = 0;
    this.selected = false;
    this.selectedGroup = null;
    this.runs = {};
    this.metricsTimer = 0;
  }
  get active() {
    return this.soldiers.filter((s) => s.alive);
  }
  members(group = "all") {
    return this.active.filter((s) => group === "all" || s.unitType === group);
  }
  get center() {
    return this.centerOf(this.active);
  }
  centerOf(soldiers) {
    return soldiers
      .reduce((p, s) => p.add(s.position), new THREE.Vector3())
      .divideScalar(soldiers.length || 1);
  }
  setSelected(selected, group = "all") {
    this.selected = selected;
    this.selectedGroup = selected ? group : null;
    for (const s of this.soldiers) {
      s.selected = selected && (group === "all" || s.unitType === group);
      s.sync();
    }
  }
  command(
    destination,
    group = this.selectedGroup ?? "all",
    { attackMove = true, trace = null } = {},
  ) {
    const active = this.members(group);
    if (!active.length) return null;
    const prepared = trace ? prepareTrace(this.grid, active[0].position, trace, destination) : null;
    if (trace && !prepared) return null;
    if (prepared) destination = prepared.destination;
    const end = this.grid.toCell(destination);
    if (!this.grid.walkable(end.x, end.z)) return null;
    const stationary = this.active.filter((s) => !active.includes(s));
    const slots = [];
    for (let r = 0; r < 16 && slots.length < active.length; r++)
      for (let z = -r; z <= r; z++)
        for (let x = -r; x <= r; x++) {
          if (
            Math.max(Math.abs(x), Math.abs(z)) !== r ||
            !this.grid.walkable(end.x + x, end.z + z)
          )
            continue;
          const p = this.grid.toWorld({ x: end.x + x, z: end.z + z });
          if (
            this.grid.segmentClear(this.grid.toWorld(end), p) &&
            stationary.every(
              (s) => Math.hypot(p.x - s.position.x, p.z - s.position.z) > 1,
            )
          )
            slots.push(p);
        }
    if (slots.length < active.length) return null;
    const plannedPaths = {},
      routes = [];
    for (const type of Object.keys(PATH_PROFILES)) {
      const members = active.filter((s) => s.unitType === type);
      if (!members.length) continue;
      const profile = PATH_PROFILES[type],
        center = this.centerOf(members);
      // Keep a safe anchor in actual walkable space, even if a centroid is in a wall.
      const anchor = members.reduce((a, b) =>
        a.position.distanceToSquared(center) <
        b.position.distanceToSquared(center)
          ? a
          : b,
      );
      const path = trace
        ? findGuidedPath(this.grid, anchor.position, prepared, profile)
        : findPath(this.grid, anchor.position, destination, profile);
      if (!path) return null;
      plannedPaths[type] = path;
      for (const s of members) {
        let join = 0;
        if (trace) {
          let nearest = Infinity;
          path.waypoints.forEach((p, i) => {
            const distance = Math.hypot(p.x - s.position.x, p.z - s.position.z);
            if (distance < nearest && this.grid.segmentClear(s.position, p)) {
              nearest = distance;
              join = i;
            }
          });
        }
        const connector = findPath(
          this.grid,
          s.position,
          path.waypoints[join],
          profile,
        );
        const arrival = findPath(
          this.grid,
          path.waypoints.at(-1),
          slots[routes.length],
          profile,
        );
        if (!connector || !arrival) return null;
        routes.push({
          soldier: s,
          waypoints: [
            ...connector.waypoints,
            ...path.waypoints.slice(join + 1),
            ...arrival.waypoints.slice(1),
          ],
        });
      }
    }
    // Commit only after every requested group's complete plan is valid.
    for (const { soldier: s, waypoints } of routes) {
      s.route = waypoints.map((p) => new THREE.Vector3(p.x, 0, p.z));
      s.waypoint = 0;
      s.arrived = false;
      s.orderDestination = s.route.at(-1).clone();
      s.progressPosition = s.position.clone();
      s.progressTimer = 0;
      s.recoveryTime = 0;
      s.repairCooldown = 0;
      s.moveOnly = !attackMove;
      s.tracedRoute = false;
      s.target = null;
      s.targetUnseenTime = 0;
      s.pursuitDestination = null;
      s.repathTimer = 0;
      s.state = "MOVING";
    }
    Object.assign(this.paths, plannedPaths);
    for (const type of Object.keys(plannedPaths)) this.runs[type] = {
      elapsed: 0, finished: false, samples: 0, spreadSum: 0, minMeanNearest: null,
    };
    this.path = Object.values(plannedPaths)[0];
    this.routeRevision++;
    return this.path;
  }
  update(dt) {
    updateBoids(this.active, this.grid, dt);
    this.metricsTimer += dt;
    for (const [type, run] of Object.entries(this.runs)) {
      if (run.finished) continue;
      run.elapsed += dt;
      const members = this.members(type);
      run.finished = members.length > 0 && members.every(s => s.arrived);
      if (this.metricsTimer >= 0.25 || run.finished) {
        const metrics = groupMetrics(this, this.grid, type);
        if (metrics) {
          run.spreadSum += metrics.spread;
          run.samples++;
          if (metrics.nearest != null) run.minMeanNearest = Math.min(run.minMeanNearest ?? Infinity, metrics.nearest);
        }
      }
    }
    if (this.metricsTimer >= 0.25) this.metricsTimer = 0;
  }
  reset() {
    this.runs = {};
    this.soldiers.forEach((s, i) => {
      const p = this.initialPositions[i];
      s.position.set(p.x, 0, p.z);
      s.velocity.set(0, 0, 0);
      s.health = s.maxHealth;
      s.mesh.visible = true;
      s.route = [];
      s.waypoint = 0;
      s.arrived = true;
      s.state = "IDLE";
      s.target = null;
      s.targetUnseenTime = 0;
      s.pursuitDestination = null;
      s.moveOnly = false;
      s.tracedRoute = false;
      s.orderDestination = null;
      s.cooldown = 0;
      s.repathTimer = 0;
      s.progressTimer = 0;
      s.recoveryTime = 0;
      s.repairCooldown = 0;
      s.progressPosition = null;
      s.debugForces = null;
      s.sync();
    });
    this.path = null;
    this.paths = {};
    this.routeRevision++;
  }
  dispose() {
    this.soldiers.forEach((s) => s.dispose());
  }
}
