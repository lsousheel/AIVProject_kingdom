import * as THREE from "three";
import { OBSTACLES, DEPLOYMENT_ZONES } from "../config.js";
import {
  createBanner,
  createCastle,
  createNaturalObstacle,
  createWall,
} from "./EnvironmentFactory.js";
import { createTerrain } from "./Terrain.js";
import { createRegions, createRuins, batchScenery } from "./Regions.js";
import { createPolish } from "./Polish.js";

export class Battlefield {
  constructor(scene) {
    this.ground = createTerrain(scene);
    const statics = new THREE.Group();
    scene.add(statics);
    const animateRegions = createRegions(scene, statics);
    this.deployment = new THREE.Group();
    scene.add(this.deployment);
    const zone = DEPLOYMENT_ZONES.blue,
      color = 0x6ea7ef;
    const area = this.plane(
      this.deployment,
      zone.x,
      zone.z,
      zone.width,
      zone.depth,
      color,
      0.06,
    );
    area.material.transparent = true;
    area.material.opacity = 0.14;
    area.material.depthWrite = false;
    const points = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
      [-1, -1],
    ].map(
      ([x, z]) =>
        new THREE.Vector3(
          zone.x + (x * zone.width) / 2,
          0.08,
          zone.z + (z * zone.depth) / 2,
        ),
    );
    this.deployment.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color }),
      ),
    );
    for (const z of [-zone.depth / 2, zone.depth / 2])
      createBanner(scene, zone.x, z, color, 4);
    for (const o of OBSTACLES) {
      if (o.kind === "water") continue;
      if (o.kind === "castle") {
        const keep = new THREE.Group();
        statics.add(keep);
        createCastle(keep, o);
        keep.scale.y = 1.6;
      }
      else if (o.kind === "wall") createWall(statics, o);
      else if (o.kind === "ruin") createRuins(statics, o);
      else createNaturalObstacle(statics, o);
    }
    const animatePolish = createPolish(scene, statics);
    this.animate = time => { animateRegions(time); animatePolish(time); };
    batchScenery(statics);
  }
  plane(parent, x, z, width, depth, color, y) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ color, roughness: 1 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
}
