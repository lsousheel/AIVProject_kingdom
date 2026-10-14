import * as THREE from "three";
import { CONFIG } from "../config.js";

// Keep the whole navigation area flat. Relief is scenery beyond its bounds.
export function terrainHeight(x, z) {
  const outside = Math.max(0, Math.max(Math.abs(x), Math.abs(z)) - 65);
  const rise = Math.min(1, outside / 40);
  return (
    rise *
    Math.min(1, Math.max(0, Math.abs(x + 18) - 7) / 25) *
    (5 +
      7 * Math.sin(x * 0.035 + 1) * Math.cos(z * 0.041) +
      3 * Math.sin((x + z) * 0.07))
  );
}
export function createTerrain(scene) {
  const geometry = new THREE.PlaneGeometry(
    CONFIG.terrainSize,
    CONFIG.terrainSize,
    96,
    96,
  );
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position,
    colors = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i),
      h = terrainHeight(x, z);
    positions.setY(i, h);
    const shade = 0.94 + 0.09 * Math.sin(x * 0.19) * Math.cos(z * 0.23);
    const color = new THREE.Color(h > 9 ? 0x777d6e : 0x66734c).lerp(
      new THREE.Color(0x8c805b), (Math.sin(x * 0.07 + z * 0.09) + 1) * 0.22,
    ).multiplyScalar(
      shade,
    );
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      flatShading: true,
    }),
  );
  ground.receiveShadow = true;
  scene.add(ground);
  // Instanced distant peaks establish a horizon without adding navigation work.
  const peaks = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 1, 5),
    new THREE.MeshStandardMaterial({
      color: 0x7a887b,
      roughness: 1,
      flatShading: true,
    }),
    22,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 22; i++) {
    const angle = (i * Math.PI * 2) / 22,
      radius = 165 + (i % 3) * 16;
    const x = Math.cos(angle) * radius,
      z = Math.sin(angle) * radius,
      h = 20 + (i % 5) * 6;
    dummy.position.set(x, terrainHeight(x, z) + h / 2, z);
    dummy.scale.set(14 + (i % 4) * 4, h, 18 + (i % 3) * 5);
    dummy.rotation.y = i * 0.7;
    dummy.updateMatrix();
    peaks.setMatrixAt(i, dummy.matrix);
  }
  scene.add(peaks);
  // Repeated peripheral foliage and rocks use three draw calls.
  const trees = [],
    rocks = [];
  for (let i = 0; i < 64; i++) {
    const angle = i * 2.399963,
      radius = 80 + (i % 7) * 7,
      x = Math.cos(angle) * radius,
      z = Math.sin(angle) * radius;
    if (Math.abs(x) < 68 && Math.abs(z) < 68) continue;
    (i % 5 === 0 ? rocks : trees).push({ x, z, scale: 1 + (i % 3) * 0.15 });
  }
  for (const [items, geometry, color, offset, isRock] of [
    [trees, new THREE.ConeGeometry(1.25, 5, 6), 0x3c5846, 3, false],
    [trees, new THREE.BoxGeometry(0.45, 1.8, 0.45), 0x655640, 0.9, false],
    [rocks, new THREE.DodecahedronGeometry(1, 0), 0x969b91, 1.5, true],
  ]) {
    const instances = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshStandardMaterial({ color, flatShading: true }),
      items.length,
    );
    items.forEach((p, i) => {
      dummy.position.set(p.x, terrainHeight(p.x, p.z) + offset * p.scale, p.z);
      dummy.rotation.set(0, i * 0.7, 0);
      dummy.scale.setScalar(p.scale);
      if (isRock) dummy.scale.set(2 * p.scale, 2.5, 2 * p.scale);
      dummy.updateMatrix();
      instances.setMatrixAt(i, dummy.matrix);
    });
    instances.castShadow = true;
    instances.receiveShadow = true;
    scene.add(instances);
  }
  return ground;
}
export function createRoad(scene, points, width = 4, color = 0xa09b78, y = 0.025) {
  const vertices = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = ((-(b[1] - a[1]) / length) * width) / 2,
      dz = (((b[0] - a[0]) / length) * width) / 2;
    const quad = [
      [a[0] + dx, a[1] + dz],
      [a[0] - dx, a[1] - dz],
      [b[0] + dx, b[1] + dz],
      [b[0] - dx, b[1] - dz],
    ];
    for (const index of [0, 1, 2, 2, 1, 3])
      vertices.push(quad[index][0], y, quad[index][1]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.computeVertexNormals();
  const road = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color,
      roughness: 1,
      side: THREE.DoubleSide,
    }),
  );
  road.receiveShadow = true;
  scene.add(road);
}
