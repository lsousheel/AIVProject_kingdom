import { BATTLEFIELD, PATH_PROFILES } from '../config.js';
import { containsTerrain } from '../world/layout.js';

export const PROFILE_EXPLANATIONS = {
  warrior: 'Balances distance, terrain cost and obstacle clearance.',
  berserker: 'Prioritizes direct travel and accepts tight passages. Weighted A* (1.65) trades optimal cost for fewer expansions.',
  guard: 'Penalizes narrow passages and prefers open movement, accepting longer routes.',
};

export function routeProgress(points, position) {
  let total = 0, bestDistance = Infinity, along = 0;
  for (let i = 1; i < (points?.length ?? 0); i++) {
    const a = points[i-1], b = points[i], dx = b.x-a.x, dz = b.z-a.z;
    const length = Math.hypot(dx,dz);
    if (!length) continue;
    const t = Math.max(0,Math.min(1,((position.x-a.x)*dx+(position.z-a.z)*dz)/(length*length)));
    const distance = Math.hypot(position.x-a.x-t*dx,position.z-a.z-t*dz);
    if (distance < bestDistance) { bestDistance=distance; along=total+t*length; }
    total += length;
  }
  return total ? along/total : 0;
}

export function groupMetrics(army, grid, type = 'all') {
  const units = army?.members(type) ?? [];
  if (!units.length) return null;
  const center = army.centerOf(units);
  const types = [...new Set(units.map(s => s.unitType))];
  const mean = fn => units.reduce((sum, s) => sum + fn(s), 0) / units.length;
  const crossing = BATTLEFIELD.crossings.find(z => containsTerrain(z, center));
  const region = crossing?.name ?? (center.x > 28 ? 'Castle approach'
    : BATTLEFIELD.forestZones.some(z => containsTerrain(z, center)) ? 'Forest'
    : BATTLEFIELD.roughZones.some(z => containsTerrain(z, center)) ? 'Ruins' : 'Open field / road');
  // 70% quorum: a fast leader cannot report progress on behalf of the group.
  // Actual movement keeps each soldier's independent, collision-safe cursor.
  const fractions = units.map(s => army.paths[s.unitType]
    ? s.arrived ? 1 : routeProgress(army.paths[s.unitType].waypoints,s.position) : 0).sort((a,b) => a-b);
  const nearest = units.length < 2 ? null : mean(s => Math.min(...units.filter(o => o !== s).map(o => s.position.distanceTo(o.position))));
  return { units: units.length, region, speed: mean(s => s.velocity.length()),
    neighbors: mean(s => s.debugNeighbors ?? 0), spread: mean(s => s.position.distanceTo(center)),
    nearest, progress: fractions[units.length - Math.ceil(units.length * 0.7)],
    profile: types.length === 1 ? PATH_PROFILES[types[0]].label : 'Mixed',
    cost: types.length === 1 ? army.paths[types[0]]?.cost : null };
}
