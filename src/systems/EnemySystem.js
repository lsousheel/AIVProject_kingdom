import { CONFIG, RED_DEFENSE } from "../config.js";

export class EnemySystem {
  constructor() {
    this.timer = 0;
    this.orders = new Map();
  }
  update(red, blue, dt) {
    this.timer -= dt;
    if (this.timer > 0 || !red.active.length || !blue.active.length) return;
    this.timer = CONFIG.enemyOrderInterval;
    // Defenders keep their preset roles; groups react independently to invaders.
    for (const [type, home] of Object.entries(RED_DEFENSE)) {
      const defenders = red.members(type);
      if (!defenders.length) continue;
      if (
        defenders.some(
          (s) => s.state === "ATTACKING" || s.state === "SEEKING_ENEMY",
        )
      )
        continue;
      const intruders = blue.active.filter(
        (s) =>
          s.position.x > 12 &&
          Math.hypot(s.position.x - home.x, s.position.z - home.z) < 26,
      );
      const previous = this.orders.get(type);
      if (intruders.length) {
        const center = red.centerOf(defenders);
        // Keep a valid target instead of switching between equally close units.
        const target = intruders.includes(previous?.target)
          ? previous.target
          : intruders.reduce((a, b) =>
              a.position.distanceToSquared(center) <
              b.position.distanceToSquared(center)
                ? a
                : b,
            );
        // Reissuing a group route pulls soldiers back through its shared anchor.
        // Only replace it when the destination meaningfully changes.
        if (
          previous?.target === target &&
          target.position.distanceTo(previous.destination) <
            CONFIG.enemyRetargetDistance
        )
          continue;
        if (red.command(target.position, type))
          this.orders.set(type, {
            target,
            destination: target.position.clone(),
          });
      } else if (
        defenders.every((s) => s.arrived) &&
        Math.hypot(
          red.centerOf(defenders).x - home.x,
          red.centerOf(defenders).z - home.z,
        ) > 8
      ) {
        if (red.command(home, type)) this.orders.delete(type);
      } else {
        this.orders.delete(type);
      }
    }
  }
}
