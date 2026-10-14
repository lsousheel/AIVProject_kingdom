import * as THREE from "three";
import { BATTLEFIELD } from "./layout.js";
import { terrainHeight, createRoad } from "./Terrain.js";
import { box } from "./EnvironmentFactory.js";

// Seeded art dressing only. Solid props stay in existing obstacle footprints
// or outside navigation; walkable-area details are flat ground overlays.
function randomSource(seed = 731) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
export function groundPatch(parent, { x, z, radius, color, rotation = 0, stretch = 1, y = 0.018 }) {
  const geometry = new THREE.CircleGeometry(1, 9);
  const p = geometry.attributes.position;
  for (let i = 1; i < p.count; i++) {
    const scale = 0.82 + 0.18 * Math.sin(i * 2.7 + x);
    p.setXY(i, p.getX(i) * scale, p.getY(i) * scale);
  }
  const mesh = new THREE.Mesh(geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  mesh.rotation.set(-Math.PI / 2, 0, rotation);
  mesh.scale.set(radius, radius * stretch, 1);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function createPolish(scene, statics) {
  const random = randomSource(), choose = list => list[Math.floor(random() * list.length)];
  const palette = [0x65714d, 0x6d7752, 0x727852, 0x777350];
  // Broad broken color fields + smaller wear. All are below feet/debug overlays.
  for (let i = 0; i < 210; i++) {
    const x = (i % 14) * 9 - 60 + random() * 2, z = Math.floor(i / 14) * 8.5 - 60 + random() * 2;
    if (Math.abs(x + 18) < 5) continue;
    groundPatch(statics, { x, z, radius: 2 + random() * 2,
      color: choose(palette), rotation: random() * 6.28, stretch: 0.4 + random() * 0.7 });
  }
  // Frayed road edges and wheel ruts, flat enough to walk over.
  for (const road of BATTLEFIELD.roads) {
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const nx = -(b[1] - a[1]) / length, nz = (b[0] - a[0]) / length;
      for (let d = 0; d < length; d += 2.5) {
        const t = d / length, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        if (Math.abs(x + 18) < 6) continue;
        for (const sign of [-1, 1]) groundPatch(statics, {
          x: x + nx * road.width * 0.44 * sign, z: z + nz * road.width * 0.44 * sign,
          radius: 0.5 + random() * 0.65, stretch: 0.7, color: 0x8e815d, y: 0.03,
        });
      }
      if (Math.abs((a[0] + b[0]) / 2 + 18) > 7)
        for (const sign of [-1, 1]) {
          const rut = [[a[0] + nx * sign * 0.65, a[1] + nz * sign * 0.65],
            [b[0] + nx * sign * 0.65, b[1] + nz * sign * 0.65]];
          createRoad(statics, rut, 0.16, 0x817452, 0.034);
        }
    }
  }

  // Vary the apparent banks inside the existing water footprint. The deep-water
  // boundary remains unchanged, so decoration cannot imply a new crossing.
  for (let z = -64; z < 64; z += 1.6) {
    if (BATTLEFIELD.crossings.some(c => Math.abs(z - c.z) < c.depth / 2 + 1)) continue;
    for (const sign of [-1, 1]) {
      const x = -18 + sign * (4.2 + Math.sin(z * 0.27) * 0.2);
      groundPatch(statics, { x, z, radius: 0.8, stretch: 1.8, color: 0x555d46, y: 0.061 });
      groundPatch(statics, { x: x - sign * 0.65, z, radius: 0.8, stretch: 1.4, color: 0x638c7a, y: 0.062 });
    }
  }

  // Repeated ground-level details and background biome use a few draw calls.
  function instances(name, geometry, color, items, shadows = false) {
    const mesh = new THREE.InstancedMesh(geometry,
      new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }), items.length);
    mesh.name = name;
    const dummy = new THREE.Object3D();
    items.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx ?? 0, p.rotation ?? random() * 6.28, p.rz ?? 0);
      dummy.scale.set(p.sx ?? p.scale ?? 1, p.sy ?? p.scale ?? 1, p.sz ?? p.scale ?? 1);
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.castShadow = shadows; mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  const reeds = [], pebbles = [], grass = [], forest = [], shrubs = [];
  for (let i = 0; i < 260; i++) {
    const z = random() * 124 - 62;
    if (BATTLEFIELD.crossings.some(c => Math.abs(z - c.z) < c.depth / 2 + 1)) continue;
    const x = -18 + (i % 2 ? 1 : -1) * (3.4 + random() * 0.7);
    reeds.push({ x, z, y: 0.4, sx: 0.07, sy: 0.5 + random() * 0.7, sz: 0.07 });
    pebbles.push({ x, z: z + 0.4, y: 0.12, sx: 0.2 + random() * 0.3, sy: 0.2, sz: 0.4 });
  }
  for (let i = 0; i < 380; i++) {
    const x = random() * 120 - 60, z = random() * 120 - 60;
    if (Math.abs(x + 18) < 7) continue;
    grass.push({ x, z, y: 0.06, sx: 0.25, sy: 0.12, sz: 0.4 });
  }
  for (let cluster = 0; cluster < 14; cluster++) {
    const angle = cluster * 2.39996, cx = Math.cos(angle) * 94, cz = Math.sin(angle) * 102;
    for (let i = 0; i < 24; i++) {
      const x = cx + (random() - 0.5) * 25, z = cz + (random() - 0.5) * 25;
      if (Math.max(Math.abs(x), Math.abs(z)) < 67 || Math.abs(x + 18) < 8) continue;
      const scale = 0.65 + random() * 1.1, y = terrainHeight(x, z);
      forest.push({ x, z, y: y + 3.8 * scale, scale });
      if (i % 3 === 0) shrubs.push({ x: x + 2, z: z + 1, y: y + 0.7, sx: 1.4, sy: 0.7, sz: 1.2 });
    }
  }
  instances("shore reeds", new THREE.ConeGeometry(1, 1, 3), 0x8a8756, reeds);
  instances("shore stones", new THREE.DodecahedronGeometry(1), 0x858776, pebbles);
  instances("low ground vegetation", new THREE.ConeGeometry(1, 1, 3), 0x859062, grass);
  instances("background forest crowns", new THREE.ConeGeometry(2.1, 7, 6), 0x354e42, forest, true);
  instances("background forest trunks", new THREE.CylinderGeometry(0.25, 0.4, 3, 5), 0x5f5140,
    forest.map(p => ({ ...p, y: p.y - 2.5 * p.scale })), true);
  instances("forest shrubs", new THREE.IcosahedronGeometry(1), 0x526a42, shrubs);

  // Give existing navigational trees layered silhouettes within their footprints.
  for (let i = 0; i < BATTLEFIELD.trees.length; i++) {
    const [x, z] = BATTLEFIELD.trees[i];
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.15, 3.5, 5),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0x344d3e : 0x4e6445, flatShading: true }));
    crown.position.set(x, 5.2 + (i % 3) * 0.4, z);
    crown.rotation.y = i * 0.8; crown.castShadow = true;
    statics.add(crown);
  }

  // Props occupy the old blocked stone footprints, never newly block a lane.
  function barrel(x, z, y = 0.55) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x756044, roughness: 1 }));
    mesh.position.set(x, y, z); mesh.castShadow = true; statics.add(mesh);
    for (const offset of [-0.32, 0.32]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.04, 3, 8),
        new THREE.MeshStandardMaterial({ color: 0x414944 }));
      ring.rotation.x = Math.PI / 2; ring.position.set(x, y + offset, z); statics.add(ring);
    }
  }
  for (const [i, o] of BATTLEFIELD.ruins.entries()) {
    const alongX = o.width > o.depth;
    // Rubble at wall tops and feet, still inside the blocked footprint.
    for (let n = 0; n < 7; n++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45),
        new THREE.MeshStandardMaterial({ color: n % 2 ? 0x817f70 : 0xaaa18c, flatShading: true }));
      rock.position.set(o.x + (random() - 0.5) * (o.width - 1), 0.25,
        o.z + (random() - 0.5) * (o.depth - 1));
      rock.rotation.set(random(), random(), random()); statics.add(rock);
    }
    if (i === 4) {
      // Abandoned cart in the collapsed center of this ruin footprint.
      box(statics, o.x, 0.7, o.z, 1.15, 0.18, 1.35, 0x6b5239);
      for (const dx of [-0.57, 0.57]) {
        box(statics, o.x + dx, 1, o.z, 0.09, 0.6, 1.35, 0x796044);
        for (const dz of [-0.45, 0.45]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 8),
            new THREE.MeshStandardMaterial({ color: 0x3e3e32 }));
          wheel.rotation.z = Math.PI / 2; wheel.position.set(o.x + dx, 0.5, o.z + dz); statics.add(wheel);
        }
      }
    } else if (i % 3 === 0) barrel(o.x, o.z, 0.85);
    else if (i % 3 === 1) {
      const crate = box(statics, o.x, 0.6, o.z, 1.1, 1.2, 1.1, 0x705b41);
      crate.rotation.y = 0.16;
      box(statics, o.x, 1.22, o.z, 1.15, 0.1, 0.15, 0x403e32);
    } else {
      const log = box(statics, o.x, 0.4, o.z, alongX ? 2.8 : 0.55, 0.5, alongX ? 0.55 : 2.8, 0x4e4435);
      log.rotation.y = 0.08;
    }
  }
  // Military supply posts on the blocked outer wall, with stakes facing approach.
  for (const z of [-32, -16, 12, 44]) {
    barrel(35, z);
    for (let i = -1; i <= 1; i++) {
      const stake = new THREE.Mesh(new THREE.ConeGeometry(0.18, 2.6, 5),
        new THREE.MeshStandardMaterial({ color: 0x594b36 }));
      stake.position.set(34.7, 3.2, z + i * 0.7); stake.rotation.z = -0.22;
      stake.castShadow = true; statics.add(stake);
    }
  }
  // Raised keep details: buttresses, slit windows, a portcullis and red standards.
  for (const z of [-5, 5]) {
    box(statics, 48.35, 4, z, 0.6, 8, 0.8, 0x858373);
    box(statics, 48.25, 7, z, 0.12, 2.7, 1.3, 0x863b32);
    box(statics, 48.16, 7, z, 0.1, 1.9, 0.15, 0xc5ad76);
  }
  // Supply tents on the existing raised castle courtyard, clear of the gate.
  for (const z of [-4.8, 4.8]) {
    const tent = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.6, 4),
      new THREE.MeshStandardMaterial({ color: 0x8c7054, flatShading: true }));
    tent.position.set(56, 5.8, z); tent.rotation.y = Math.PI / 4;
    tent.scale.z = 1.2; tent.castShadow = true; statics.add(tent);
    box(statics, 55.04, 5.6, z, 0.05, 0.75, 0.5, 0x383c30);
    barrel(55.7, z + 1.3, 5.7);
  }
  for (let z = -1.4; z <= 1.4; z += 0.4) box(statics, 47.94, 2.3, z, 0.13, 4.3, 0.09, 0x262e2b);
  for (const z of [-6, -3, 3, 6]) box(statics, 47.97, 5.3, z, 0.08, 0.9, 0.22, 0x303c36);

  // Lightweight living details, deliberately outside the static batching group.
  const flags = [], flames = [];
  for (const [x, z, y] of [[53, 0, 22], [35, -24, 6], [35, 43, 6], [-25, -23, 4]]) {
    box(statics, x, y / 2, z, 0.1, y, 0.1, 0x4e4939);
    const geometry = new THREE.PlaneGeometry(2.1, 1.2, 8, 1);
    geometry.translate(1.05, -0.6, 0);
    const flag = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: x > 0 ? 0x993e34 : 0xb9a277, side: THREE.DoubleSide, roughness: 1 }));
    flag.position.set(x, y, z); scene.add(flag); flags.push(flag);
  }
  for (const z of [-5, 5]) {
    const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32),
      new THREE.MeshBasicMaterial({ color: 0xffb850 }));
    flame.position.set(48.3, 2.8, z); scene.add(flame); flames.push(flame);
    box(statics, 48.3, 1.3, z, 0.14, 2.6, 0.14, 0x493f32);
  }
  // Gradient sky dome is one unlit draw call; fog joins it to the distant hills.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(285, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: "varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "varying vec3 vDirection; void main(){float h=clamp(normalize(vDirection).y,0.,1.);vec3 c=mix(vec3(.69,.65,.51),vec3(.24,.40,.49),pow(h,.6));gl_FragColor=vec4(c,1.); #include <tonemapping_fragment>\n #include <colorspace_fragment>\n}",
  }));
  sky.material.fragmentShader = sky.material.fragmentShader.replace(" #include", "\n #include");
  sky.renderOrder = -100; scene.add(sky);
  return time => {
    flags.forEach((flag, index) => {
      const p = flag.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i,
        Math.sin(time * 2.4 + p.getX(i) * 2.8 + index) * 0.13 * p.getX(i));
      p.needsUpdate = true;
    });
    flames.forEach((flame, i) => flame.scale.set(0.85 + Math.sin(time * 13 + i) * 0.1,
      1.7 + Math.sin(time * 17 + i) * 0.35, 0.85));
  };
}
