import { ENVIRONMENT_OBSTACLES, ENVIRONMENT_TERRAIN } from "./world/layout.js";
export { BATTLEFIELD, TERRAIN_COSTS } from "./world/layout.js";
export const CONFIG = {
  worldSize: 120,
  terrainSize: 480,
  cellSize: 1.5,
  armySize: 20,
  maxPlayerUnits: 30,
  soldierRadius: 0.38,
  speed: 4,
  acceleration: 12,
  neighborRadius: 4.5,
  separationRadius: 1.5,
  separationWeight: 2.4,
  cohesionWeight: 0.35,
  alignmentWeight: 0.65,
  targetWeight: 2.2,
  waypointRadius: 0.65,
  arrivalSteeringRadius: 6,
  obstacleProbeTime: 0.35,
  stallCheckInterval: 2,
  stallDistance: 0.5,
  recoveryDuration: 2,
  attackRange: 1.7,
  attackCooldown: 1,
  detectionRadius: 12,
  enemyOrderInterval: 4,
  enemyRetargetDistance: 4,
  engagementRepathInterval: 1.2,
  targetSightGrace: 0.6,
  formationSpacing: 1.7,
  cameraPanSpeed: 35,
};
export const UNIT_TYPES = {
  warrior: {
    label: "Warrior",
    health: 100,
    damage: 15,
    speed: 4,
    defense: 5,
    accent: 0xc6d1d5,
  },
  berserker: {
    label: "Berserker",
    health: 70,
    damage: 25,
    speed: 4.7,
    defense: 2,
    accent: 0xe8b472,
  },
  guard: {
    label: "Guard",
    health: 160,
    damage: 9,
    speed: 3.2,
    defense: 10,
    accent: 0x9fbba9,
  },
};
export const BLUE_START = { x: -38, z: 0 };
export const RED_START = { x: 38, z: 0 };
export const DEFAULT_COMPOSITION = { warrior: 10, berserker: 10, guard: 10 };
export const EMPTY_COMPOSITION = { warrior: 0, berserker: 0, guard: 0 };
export const RED_COMPOSITION = { warrior: 12, berserker: 8, guard: 14 };
export const RED_CASTLE = { x: 53, z: 0 };
// Fixed defensive groups: screen, gate guard and a southern flanking reserve.
export const RED_DEFENSE = {
  warrior: { x: 30, z: 3, formation: "wide" },
  berserker: { x: 42, z: 25, formation: "block" },
  guard: { x: 43, z: 0, formation: "wide" },
};
export const PATH_PROFILES = {
  warrior: {
    label: "Balanced",
    heuristicWeight: 1,
    terrainWeight: 1,
    clearanceWeight: 1.7,
    clearanceRadius: 5,
    color: 0xe7c875,
  },
  berserker: {
    label: "Aggressive",
    heuristicWeight: 1.65,
    terrainWeight: 0.05,
    clearanceWeight: 0,
    clearanceRadius: 0,
    color: 0xf18e69,
  },
  guard: {
    label: "Safe",
    heuristicWeight: 1,
    terrainWeight: 1,
    clearanceWeight: 9,
    clearanceRadius: 9,
    color: 0x75d1c1,
  },
};
// Multipliers on the existing Boids weights, not separate movement algorithms.
export const BOID_PROFILES = {
  warrior: { separation: 1, cohesion: 1, alignment: 1, target: 1 },
  berserker: { separation: 0.95, cohesion: 0.75, alignment: 0.9, target: 1.15 },
  guard: { separation: 1.1, cohesion: 1.15, alignment: 1.1, target: 0.95 },
};
export const TERRAIN_ZONES = ENVIRONMENT_TERRAIN;
export const DEPLOYMENT_ZONES = {
  blue: { x: -38, z: 0, width: 20, depth: 36 },
  red: { x: 38, z: 0, width: 20, depth: 36 },
};
// One footprint definition drives both obstacle geometry and navigation occupancy.
export const OBSTACLES = ENVIRONMENT_OBSTACLES;
