import { findPath } from "./AStar.js";

// Treat the sketch as guidance, not as a collision-free movement path.
export function prepareTrace(grid, start, trace, destination) {
  if (!trace?.length || ![...trace, destination].every(p =>
    Number.isFinite(p.x) && Number.isFinite(p.z))) return null;
  const first = grid.toCell(start);
  if (!grid.walkable(first.x, first.z)) return null;
  const cells = [first], reachable = new Set([grid.index(first.x, first.z)]);
  for (let i = 0; i < cells.length; i++) {
    for (const cell of grid.neighbors(cells[i])) {
      const id = grid.index(cell.x, cell.z);
      if (!reachable.has(id)) { reachable.add(id); cells.push(cell); }
    }
  }
  const isReachable = p => {
    const c = grid.toCell(p);
    return grid.walkable(c.x, c.z) && reachable.has(grid.index(c.x, c.z));
  };
  let goal = destination;
  if (!isReachable(goal)) {
    goal = cells.map(c => grid.toWorld(c)).reduce((best, p) =>
      Math.hypot(p.x - destination.x, p.z - destination.z) <
      Math.hypot(best.x - destination.x, best.z - destination.z) ? p : best);
  }
  return { reference: [start, ...trace, goal], destination: goal,
    adjusted: goal !== destination, distances: new Map() };
}

export function findGuidedPath(grid, start, prepared, profile) {
  // A single search to the final goal. Distance from the sketch is only a
  // soft extra cost: samples are never mandatory stops, including sketch loops.
  const guidedGrid = Object.create(grid);
  guidedGrid.traversalPenalty = (cell, routeProfile) => {
    const id = grid.index(cell.x, cell.z);
    if (!prepared.distances.has(id)) {
      const p = grid.toWorld(cell);
      let distance = Infinity;
      for (let i = 1; i < prepared.reference.length; i++) {
        const a = prepared.reference[i - 1], b = prepared.reference[i];
        const dx = b.x - a.x, dz = b.z - a.z;
        const t = Math.max(0, Math.min(1,
          ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
        distance = Math.min(distance, Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz));
      }
      prepared.distances.set(id, Math.min(6, Math.max(0, distance - grid.cellSize) * 0.35));
    }
    return grid.traversalPenalty(cell, routeProfile) + prepared.distances.get(id);
  };
  const result = findPath(guidedGrid, start, prepared.destination, profile);
  if (!result) return null;
  result.mode = "Guided A*";
  result.adjustedDestination = prepared.adjusted;
  return result;
}
