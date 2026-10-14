import { containsTerrain } from "../world/layout.js";
export class Grid {
  constructor(
    size,
    cellSize,
    obstacles = [],
    clearance = 0,
    terrainZones = [],
  ) {
    this.size = size;
    this.cellSize = cellSize;
    this.count = Math.ceil(size / cellSize);
    this.blocked = new Uint8Array(this.count * this.count);
    for (let z = 0; z < this.count; z++)
      for (let x = 0; x < this.count; x++) {
        const p = this.toWorld({ x, z });
        // Conservative cell/obstacle intersection plus soldier-radius clearance.
        const margin = cellSize / 2 + clearance;
        this.blocked[this.index(x, z)] = obstacles.some(
          (o) =>
            Math.abs(p.x - o.x) <= o.width / 2 + margin &&
            Math.abs(p.z - o.z) <= o.depth / 2 + margin,
        )
          ? 1
          : 0;
      }
    this.terrain = new Float32Array(this.blocked.length);
    this.terrainTypes = Array(this.blocked.length).fill("ground");
    this.crossings = Array(this.blocked.length).fill(null);
    for (let z = 0; z < this.count; z++)
      for (let x = 0; x < this.count; x++) {
        const p = this.toWorld({ x, z }),
          id = this.index(x, z);
        for (const zone of terrainZones)
          if (containsTerrain(zone, p)) {
            this.terrain[id] =
              zone.cost != null ? zone.cost - 1 : (zone.penalty ?? 0);
            this.terrainTypes[id] = zone.terrain ?? "rough";
            this.crossings[id] = zone.crossing ?? null;
          }
      }
    this.minimumTerrain = Math.min(0, ...this.terrain);
    this.computeClearance();
  }
  computeClearance() {
    // Two-pass chamfer transform: approximate distance to the nearest blocked
    // cell center (axial 1, diagonal sqrt(2)), converted into world units.
    const n = this.count,
      d = new Float32Array(this.blocked.length);
    for (let i = 0; i < d.length; i++) d[i] = this.blocked[i] ? 0 : Infinity;
    for (const step of [1, -1]) {
      for (let z = step > 0 ? 0 : n - 1; z >= 0 && z < n; z += step)
        for (let x = step > 0 ? 0 : n - 1; x >= 0 && x < n; x += step) {
          const i = this.index(x, z);
          for (const [dx, dz, cost] of [
            [-step, 0, 1],
            [0, -step, 1],
            [-step, -step, Math.SQRT2],
            [step, -step, Math.SQRT2],
          ]) {
            const nx = x + dx,
              nz = z + dz;
            if (nx >= 0 && nz >= 0 && nx < n && nz < n)
              d[i] = Math.min(d[i], d[this.index(nx, nz)] + cost);
          }
        }
    }
    this.clearance = Float32Array.from(d, (value) => value * this.cellSize);
  }
  traversalPenalty(cell, profile) {
    const id = this.index(cell.x, cell.z),
      radius = profile.clearanceRadius || 0;
    const proximity = radius ? Math.max(0, 1 - this.clearance[id] / radius) : 0;
    return (
      (profile.terrainWeight || 0) * this.terrain[id] +
      (profile.clearanceWeight || 0) * proximity * proximity
    );
  }
  index(x, z) {
    return z * this.count + x;
  }
  walkable(x, z) {
    return (
      x >= 0 &&
      z >= 0 &&
      x < this.count &&
      z < this.count &&
      !this.blocked[this.index(x, z)]
    );
  }
  toCell(p) {
    return {
      x: Math.floor((p.x + this.size / 2) / this.cellSize),
      z: Math.floor((p.z + this.size / 2) / this.cellSize),
    };
  }
  toWorld(c) {
    return {
      x: (c.x + 0.5) * this.cellSize - this.size / 2,
      z: (c.z + 0.5) * this.cellSize - this.size / 2,
    };
  }
  canStand(p) {
    const c = this.toCell(p);
    return this.walkable(c.x, c.z);
  }
  neighbors(c) {
    const result = [];
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        if (!this.walkable(c.x + dx, c.z + dz)) continue;
        // Never cut diagonally through the corner of a blocked cell.
        if (
          dx &&
          dz &&
          (!this.walkable(c.x + dx, c.z) || !this.walkable(c.x, c.z + dz))
        )
          continue;
        result.push({ x: c.x + dx, z: c.z + dz, cost: Math.hypot(dx, dz) });
      }
    return result;
  }
  segmentClear(a, b) {
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (this.cellSize * 0.15)),
    );
    let previous = this.toCell(a);
    for (let i = 0; i <= steps; i++) {
      const c = this.toCell({
        x: a.x + ((b.x - a.x) * i) / steps,
        z: a.z + ((b.z - a.z) * i) / steps,
      });
      if (!this.walkable(c.x, c.z)) return false;
      if (
        c.x !== previous.x &&
        c.z !== previous.z &&
        (!this.walkable(c.x, previous.z) || !this.walkable(previous.x, c.z))
      )
        return false;
      previous = c;
    }
    return true;
  }
}
