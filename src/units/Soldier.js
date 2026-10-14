import * as THREE from "three";
import { CONFIG, UNIT_TYPES } from "../config.js";

export class Soldier {
  constructor(scene, x, z, index, team = "blue", unitType = "warrior", leader = false) {
    const stats = UNIT_TYPES[unitType];
    this.position = new THREE.Vector3(x, 0, z);
    this.velocity = new THREE.Vector3();
    this.index = index;
    this.team = team;
    this.unitType = unitType;
    this.maxHealth = stats.health;
    this.health = stats.health;
    this.attackDamage = stats.damage;
    this.defense = stats.defense;
    this.movementSpeed = stats.speed;
    this.attackRange = CONFIG.attackRange;
    this.attackCooldown = CONFIG.attackCooldown;
    this.cooldown = 0;
    this.repathTimer = 0;
    this.targetUnseenTime = 0;
    this.pursuitDestination = null;
    this.state = "IDLE";
    this.target = null;
    this.route = [];
    this.waypoint = 0;
    this.arrived = true;
    this.orderDestination = null;
    this.selected = false;
    this.mesh = new THREE.Group();
    this.mesh.userData.soldier = this;
    const color = team === "blue" ? 0x447fe0 : 0xcb514e;
    const part = (geometry, color, x, y, z = 0) => {
      const m = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
      );
      m.position.set(x, y, z);
      m.castShadow = true;
      this.mesh.add(m);
      return m;
    };
    const guard = unitType === "guard",
      berserker = unitType === "berserker";
    part(
      new THREE.CapsuleGeometry(guard ? 0.38 : 0.29, 0.6, 3, 6),
      berserker ? 0x81715a : guard ? 0x59666b : 0x798180,
      0,
      0.9,
    );
    part(new THREE.BoxGeometry(0.19, 0.45, 0.22), 0x394441, -0.17, 0.25);
    part(new THREE.BoxGeometry(0.19, 0.45, 0.22), 0x394441, 0.17, 0.25);
    part(new THREE.IcosahedronGeometry(0.26, 0), 0xd9d0b6, 0, 1.55);
    // Tabard, shield emblem and shoulder trim carry the team color over armor.
    part(new THREE.BoxGeometry(guard ? 0.53 : 0.4, 0.55, 0.1), color, 0, 0.86, 0.3);
    part(new THREE.BoxGeometry(guard ? 0.95 : 0.76, 0.18, 0.35),
      berserker ? 0x6c533e : 0xa3a69c, 0, 1.24);
    part(new THREE.BoxGeometry(0.53, 0.12, 0.48), 0x514738, 0, 0.61);
    if (leader) {
      part(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 4), 0x665843, -0.42, 1.9, -0.22);
      part(new THREE.BoxGeometry(0.78, 0.5, 0.035), color, -0.06, 2.85, -0.22);
      part(new THREE.BoxGeometry(0.09, 0.38, 0.05), 0xd4c59b, -0.12, 2.85, -0.19);
    }
    if (!berserker)
      part(
        new THREE.SphereGeometry(0.29, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2),
        stats.accent,
        0,
        1.58,
      );
    else {
      part(new THREE.BoxGeometry(0.12, 0.22, 0.35), stats.accent, 0, 1.83);
      part(new THREE.BoxGeometry(0.86, 0.15, 0.34), stats.accent, 0, 1.15);
    }
    this.weapon = part(
      new THREE.BoxGeometry(0.09, berserker ? 1.1 : 0.8, 0.1),
      0xe0dfcf,
      0.46,
      0.95,
      0.18,
    );
    if (berserker) {
      const axeHead = part(
        new THREE.BoxGeometry(0.5, 0.32, 0.12),
        stats.accent,
        0.46,
        1.35,
        0.18,
      );
      this.weapon.add(axeHead);
      axeHead.position.set(0, 0.4, 0);
    } else {
      part(
        new THREE.BoxGeometry(guard ? 0.65 : 0.4, guard ? 0.85 : 0.5, 0.14),
        stats.accent,
        -0.28,
        0.85,
        0.35,
      );
      part(
        new THREE.BoxGeometry(0.11, guard ? 0.65 : 0.35, 0.02),
        color,
        -0.28,
        0.85,
        0.43,
      );
    }
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.59, 20),
      new THREE.MeshBasicMaterial({ color: 0x90c7ff, side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.06;
    this.ring.visible = false;
    this.mesh.add(this.ring);
    this.healthBar = new THREE.Group();
    const background = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.13),
      new THREE.MeshBasicMaterial({ color: 0x182322, depthTest: false }),
    );
    this.healthFill = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 0.09),
      new THREE.MeshBasicMaterial({
        color: team === "blue" ? 0x8fcebf : 0xe99281,
        depthTest: false,
      }),
    );
    this.healthFill.position.z = 0.01;
    this.healthBar.add(background, this.healthFill);
    this.healthBar.visible = false;
    scene.add(this.mesh, this.healthBar);
    this.sync();
  }
  get alive() {
    return this.health > 0;
  }
  takeDamage(amount) {
    if (!this.alive) return;
    this.health = Math.max(0, this.health - amount);
    if (!this.alive) {
      this.state = "DEAD";
      this.target = null;
      this.route = [];
      this.velocity.set(0, 0, 0);
      this.mesh.visible = false;
      this.healthBar.visible = false;
    }
  }
  sync() {
    this.mesh.position.copy(this.position);
    if (this.state !== "ATTACKING" && this.velocity.lengthSq() > 0.02)
      this.mesh.rotation.y = Math.atan2(this.velocity.x, this.velocity.z);
    const attacking = this.state === "ATTACKING";
    const swing = attacking
      ? Math.sin((1 - this.cooldown / this.attackCooldown) * Math.PI * 2)
      : 0;
    this.weapon.rotation.x = swing * 0.85;
    this.ring.visible = (this.selected || attacking) && this.alive;
    this.ring.material.color.setHex(attacking ? 0xffb65c : 0x90c7ff);
    this.healthBar.position
      .copy(this.position)
      .add(new THREE.Vector3(0, 2.25, 0));
    this.healthBar.visible =
      this.alive &&
      (this.selected || attacking || this.health < this.maxHealth);
    this.healthFill.scale.x = this.health / this.maxHealth;
    this.healthFill.position.x = -(1 - this.health / this.maxHealth) / 2;
  }
  dispose() {
    for (const root of [this.mesh, this.healthBar]) {
      root.removeFromParent();
      root.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) o.material.dispose();
      });
    }
  }
}
