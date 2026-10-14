import { CONFIG, DEPLOYMENT_ZONES, UNIT_TYPES } from "../config.js";

export function compositionTotal(composition) {
  return Object.values(composition).reduce((sum, count) => sum + count, 0);
}
export function validComposition(composition, max = CONFIG.maxPlayerUnits) {
  return (
    Object.keys(composition).every((type) => type in UNIT_TYPES) &&
    Object.values(composition).every(
      (count) => Number.isInteger(count) && count >= 0,
    ) &&
    compositionTotal(composition) > 0 &&
    compositionTotal(composition) <= max
  );
}
export function formationPositions(count, center, formation = "block") {
  const columns =
    formation === "line"
      ? 1
      : formation === "wide"
        ? 3
        : Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const spacing = formation === "line" ? 1.1 : CONFIG.formationSpacing;
  return Array.from({ length: count }, (_, i) => ({
    x: center.x + ((i % columns) - (columns - 1) / 2) * spacing,
    z: center.z + (Math.floor(i / columns) - (rows - 1) / 2) * spacing,
  }));
}
export function validateDeployment(
  grid,
  composition,
  center,
  formation = "block",
  team = "blue",
) {
  if (!validComposition(composition))
    return { ok: false, reason: "Choose between 1 and 30 units." };
  if (!["block", "line", "wide"].includes(formation))
    return { ok: false, reason: "Unknown formation." };
  const positions = formationPositions(
    compositionTotal(composition),
    center,
    formation,
  );
  const zone = DEPLOYMENT_ZONES[team],
    radius = CONFIG.soldierRadius;
  const fits = positions.every(
    (p) =>
      Math.abs(p.x - zone.x) + radius <= zone.width / 2 &&
      Math.abs(p.z - zone.z) + radius <= zone.depth / 2 &&
      grid.canStand(p),
  );
  return fits
    ? { ok: true, positions }
    : {
        ok: false,
        reason:
          "The entire formation must fit on clear ground inside the Blue deployment zone.",
      };
}
