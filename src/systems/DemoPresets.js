// These endpoints exercise the real planner; no preset selects a crossing.
export const DEMO_PRESETS = {
  bridge: { label: 'Narrow bridge', start: { x: -33, z: 0 }, end: { x: -6, z: 0 }, focus: { x: -18, z: 0 }, composition: { berserker: 24 } },
  ruins: { label: 'Village alley', start: { x: -8, z: 0 }, end: { x: 27, z: 0 }, focus: { x: 10, z: 0 }, composition: { berserker: 24 } },
  field: { label: 'Open field', start: { x: -43, z: 22 }, end: { x: -42, z: -25 }, focus: { x: -42, z: 0 }, composition: { warrior: 16 } },
  forest: { label: 'Forest trail', start: { x: -8, z: -20 }, end: { x: 27, z: -25 }, focus: { x: 10, z: -30 }, composition: { warrior: 8 } },
  gate: { label: 'Castle approach', start: { x: 27, z: 0 }, end: { x: 43, z: 0 }, focus: { x: 35, z: 0 }, composition: { guard: 8 } },
  groups: { label: 'Run three groups', start: { x: -38, z: 0 }, end: { x: 38, z: 4 }, focus: { x: 0, z: 0 }, composition: { warrior: 6, berserker: 6, guard: 6 } },
};
