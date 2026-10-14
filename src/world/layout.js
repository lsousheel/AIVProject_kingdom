// One environment description drives rendering, occupancy and terrain costs.
export const TERRAIN_COSTS = {
  ground: 1,
  road: 0.78,
  forest: 1.5,
  rubble: 1.4,
  wood: 1.35,
  stone: 0.85,
  ford: 1.65,
};
export const BATTLEFIELD = {
  river: { x: -18, width: 9, from: -240, to: 240 },
  crossings: [
    {
      name: "Stone Bridge",
      terrain: "stone",
      x: -18,
      z: -17,
      width: 13,
      depth: 12,
    },
    {
      name: "Wooden Bridge",
      terrain: "wood",
      x: -18,
      z: 0,
      width: 13,
      depth: 6,
    },
    {
      name: "Southern Ford",
      terrain: "ford",
      x: -18,
      z: 27,
      width: 14,
      depth: 22,
    },
  ],
  roads: [
    {
      points: [
        [-62, 0],
        [-38, 0],
        [-29, -17],
        [-8, -17],
        [19, -17],
        [28, -9],
        [38, 0],
        [47, 0],
      ],
      width: 6,
    },
    {
      points: [
        [-35, 0],
        [-24, 0],
        [-10, 0],
        [3, 0],
        [21, 0],
        [29, 0],
      ],
      width: 3,
    },
    {
      points: [
        [-36, 8],
        [-30, 27],
        [-8, 27],
        [14, 30],
        [29, 27],
        [43, 25],
        [44, 9],
      ],
      width: 7,
    },
    {
      points: [
        [-7, -17],
        [-3, -32],
        [12, -34],
        [27, -26],
        [30, -12],
      ],
      width: 3,
    },
  ],
  forestZones: [
    { x: 9, z: -34, width: 36, depth: 22, terrain: "forest", color: 0x526a49 },
  ],
  roughZones: [
    { x: 8, z: 0, width: 22, depth: 16, terrain: "rubble", color: 0x91866b },
  ],
  ruins: [
    { x: 0, z: -6, width: 2, depth: 10 },
    { x: 5, z: -10, width: 10, depth: 2 },
    { x: 11, z: -7, width: 2, depth: 8 },
    { x: 20, z: -8, width: 2, depth: 10 },
    { x: 3, z: 6, width: 12, depth: 2 },
    { x: 9, z: 11, width: 2, depth: 10 },
    { x: 18, z: 9, width: 2, depth: 8 },
    { x: 23, z: 12, width: 10, depth: 2 },
  ],
  walls: [
    { x: 35, z: -24, width: 2.5, depth: 36 },
    { x: 35, z: 12, width: 2.5, depth: 12 },
    { x: 35, z: 43, width: 2.5, depth: 20 },
    { x: 46, z: -42, width: 22, depth: 2.5 },
    { x: 48, z: 34, width: 8, depth: 2 },
  ],
  rocks: [
    { x: 27, z: -42, width: 5, depth: 6 },
    { x: 28, z: 17, width: 3, depth: 3 },
    { x: 44, z: -19, width: 4, depth: 5 },
    { x: 4, z: 40, width: 5, depth: 4 },
  ],
  trees: [
    [-5, -28],
    [-5, -37],
    [0, -40],
    [4, -29],
    [6, -39],
    [13, -27],
    [17, -31],
    [19, -40],
    [24, -36],
    [-1, -46],
    [11, -46],
  ],
  castle: { kind: "castle", x: 53, z: 0, width: 10, depth: 18, team: "red" },
};

// Deep-water segments end at crossing edges. Grid inflation leaves a safe bank
// margin for a soldier; crossing decks extend across those same footprints.
const riverBlocks = [];
let edge = -60;
for (const crossing of [...BATTLEFIELD.crossings].sort((a, b) => a.z - b.z)) {
  const next = crossing.z - crossing.depth / 2;
  riverBlocks.push({
    kind: "water",
    x: BATTLEFIELD.river.x,
    z: (edge + next) / 2,
    width: BATTLEFIELD.river.width,
    depth: next - edge,
  });
  edge = crossing.z + crossing.depth / 2;
}
riverBlocks.push({
  kind: "water",
  x: BATTLEFIELD.river.x,
  z: (edge + 60) / 2,
  width: BATTLEFIELD.river.width,
  depth: 60 - edge,
});
export const ENVIRONMENT_OBSTACLES = [
  BATTLEFIELD.castle,
  ...riverBlocks,
  ...BATTLEFIELD.ruins.map((o) => ({ ...o, kind: "ruin" })),
  ...BATTLEFIELD.walls.map((o) => ({ ...o, kind: "wall" })),
  ...BATTLEFIELD.rocks.map((o) => ({ ...o, kind: "rock" })),
  ...BATTLEFIELD.trees.map(([x, z]) => ({
    kind: "tree",
    x,
    z,
    width: 2.5,
    depth: 2.5,
  })),
];
export const ENVIRONMENT_TERRAIN = [
  ...BATTLEFIELD.forestZones,
  ...BATTLEFIELD.roughZones,
  ...BATTLEFIELD.roads.map((o) => ({ ...o, terrain: "road" })),
  ...BATTLEFIELD.crossings.map((o) => ({ ...o, crossing: o.name })),
].map((o) => ({ ...o, cost: TERRAIN_COSTS[o.terrain] }));

export function containsTerrain(zone, p) {
  if (!zone.points)
    return (
      Math.abs(p.x - zone.x) <= zone.width / 2 &&
      Math.abs(p.z - zone.z) <= zone.depth / 2
    );
  return zone.points.slice(1).some((b, i) => {
    const a = zone.points[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / (dx * dx + dz * dz),
      ),
    );
    return (
      Math.hypot(p.x - a[0] - t * dx, p.z - a[1] - t * dz) <= zone.width / 2
    );
  });
}
