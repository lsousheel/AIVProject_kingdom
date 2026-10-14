// g = accumulated terrain/clearance cost; h = distance * minimum step multiplier.
// A Map frontier keeps the custom implementation easy to explain at this scale.
export function findPath(
  grid,
  startWorld,
  endWorld,
  profile = { label: "Standard", heuristicWeight: 1 },
) {
  const startedAt = performance.now();
  const start = grid.toCell(startWorld),
    end = grid.toCell(endWorld);
  if (!grid.walkable(start.x, start.z) || !grid.walkable(end.x, end.z))
    return null;
  const key = (c) => grid.index(c.x, c.z),
    startId = key(start),
    endId = key(end);
  const open = new Map([[startId, start]]),
    closed = new Set(),
    parent = new Map();
  const g = new Map([[startId, 0]]);
  const minimumCost = 1 + (profile.terrainWeight || 0) * grid.minimumTerrain;
  const h = (c) => minimumCost * Math.hypot(c.x - end.x, c.z - end.z);
  let expanded = 0;
  const visited = [];
  while (open.size) {
    let current,
      best = Infinity;
    for (const c of open.values()) {
      // Weighted A* (w > 1) trades shortest-cost guarantees for a greedier search.
      const f = g.get(key(c)) + (profile.heuristicWeight ?? 1) * h(c);
      if (f < best) {
        best = f;
        current = c;
      }
    }
    const id = key(current);
    if (id === endId) {
      const cells = [current];
      let cursor = id;
      while (parent.has(cursor)) {
        const p = parent.get(cursor);
        cells.push(p);
        cursor = key(p);
      }
      const waypoints = cells.reverse().map((c) => grid.toWorld(c));
      const length = waypoints
        .slice(1)
        .reduce(
          (sum, p, i) =>
            sum + Math.hypot(p.x - waypoints[i].x, p.z - waypoints[i].z),
          0,
        );
      const meanClearance =
        cells.reduce((sum, c) => sum + grid.clearance[key(c)], 0) /
        cells.length;
      return {
        waypoints,
        terrainTypes: [...new Set(cells.map((c) => grid.terrainTypes[key(c)]))],
        crossings: [
          ...new Set(cells.map((c) => grid.crossings[key(c)]).filter(Boolean)),
        ],
        length,
        meanClearance,
        mode: profile.label,
        expanded,
        visited,
        frontier: [...open.entries()].filter(([key]) => key !== id).map(([, c]) => grid.toWorld(c)),
        computationMs: performance.now() - startedAt,
        cost: g.get(id) * grid.cellSize,
      };
    }
    open.delete(id);
    closed.add(id);
    expanded++;
    visited.push(grid.toWorld(current));
    for (const next of grid.neighbors(current)) {
      const nextId = key(next);
      const tentative =
        g.get(id) + next.cost * (1 + grid.traversalPenalty(next, profile));
      if (tentative < (g.get(nextId) ?? Infinity)) {
        // Reopening allows improved paths even with a weighted/inconsistent h.
        closed.delete(nextId);
        parent.set(nextId, current);
        g.set(nextId, tentative);
        open.set(nextId, next);
      }
    }
  }
  return null;
}
