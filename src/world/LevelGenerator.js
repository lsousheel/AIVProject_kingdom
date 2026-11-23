import { CONFIG, OBSTACLES, TERRAIN_ZONES, BLUE_START } from '../config.js';
import { Grid } from '../navigation/Grid.js';
import { DEMO_PRESETS } from '../systems/DemoPresets.js';

export function levelGrid(extra = []) {
  return new Grid(CONFIG.worldSize, CONFIG.cellSize, [...OBSTACLES, ...extra],
    CONFIG.soldierRadius, TERRAIN_ZONES);
}

// Fixed seed and density reproduce the same additions to the original battlefield.
export function generateLevel(seed, density = 'scattered') {
  if (!Number.isInteger(seed) || seed < 0 || seed > 999999)
    throw new Error('Use a seed from 0 to 999999.');
  if (!['scattered', 'fortified'].includes(density)) throw new Error('Unknown layout.');
  let state = seed + 1;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const targets = [BLUE_START, { x: 38, z: 4 },
    ...Object.values(DEMO_PRESETS).flatMap(p => [p.start, p.end])];
  const obstacles = [];
  let grid = levelGrid();
  for (let attempt = 0; attempt < 160 && obstacles.length < (density === 'fortified' ? 16 : 8); attempt++) {
    const horizontal = random() > .5;
    const length = 3 + Math.floor(random() * 4);
    const o = { kind: 'wall', x: -5 + Math.floor(random() * 27),
      z: -42 + Math.floor(random() * 85),
      width: horizontal ? length : 1.5, depth: horizontal ? 1.5 : length };
    // Keep original structures, demo endpoints and deployment/defender areas clear.
    if (targets.some(p => Math.abs(p.x-o.x) < o.width/2+5 && Math.abs(p.z-o.z) < o.depth/2+5)) continue;
    if ([...OBSTACLES, ...obstacles].some(p =>
      Math.abs(p.x-o.x) < (p.width+o.width)/2+3 &&
      Math.abs(p.z-o.z) < (p.depth+o.depth)/2+3)) continue;
    const candidate = levelGrid([...obstacles, o]);
    if (!reachable(candidate, targets)) continue;
    obstacles.push(o);
    grid = candidate;
  }
  return { seed, density, obstacles, grid };
}

function reachable(grid, targets) {
  const start = grid.toCell(targets[0]), queue = [start];
  const visited = new Set([grid.index(start.x, start.z)]);
  for (let i=0; i<queue.length; i++) {
    for (const next of grid.neighbors(queue[i])) {
      const key = grid.index(next.x, next.z);
      if (!visited.has(key)) { visited.add(key); queue.push(next); }
    }
  }
  return targets.every(p => {
    const cell = grid.toCell(p);
    return grid.canStand(p) && visited.has(grid.index(cell.x, cell.z));
  });
}
