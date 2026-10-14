import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BATTLEFIELD } from "./layout.js";
import { box, createBanner } from "./EnvironmentFactory.js";
import { createRoad } from "./Terrain.js";

export function createRuins(parent, o) {
  const alongX = o.width > o.depth,
    length = Math.max(o.width, o.depth),
    n = Math.ceil(length / 1.8);
  for (let i = 0; i < n; i++) {
    const h = i === Math.floor(n / 2) ? 0.32 :
      1.2 + ((i * 7 + Math.round(o.x + o.z) + 100) % 4) * 0.48;
    box(
      parent,
      o.x + (alongX ? ((i - (n - 1) / 2) * length) / n : 0),
      h / 2,
      o.z + (alongX ? 0 : ((i - (n - 1) / 2) * length) / n),
      alongX ? length / n : o.width,
      h,
      alongX ? o.depth : length / n,
      0x9d9787,
    );
    if (h > 1) {
      const cap = box(parent,
        o.x + (alongX ? ((i - (n - 1) / 2) * length) / n : 0), h + 0.12,
        o.z + (alongX ? 0 : ((i - (n - 1) / 2) * length) / n),
        alongX ? length / n * 0.75 : o.width * 0.7, 0.25,
        alongX ? o.depth * 0.7 : length / n * 0.75, 0x817e6d);
      cap.rotation.y = Math.sin(i * 7) * 0.12;
    }
  }
}

export function createRegions(scene, statics) {
  for (const zone of [...BATTLEFIELD.forestZones, ...BATTLEFIELD.roughZones]) {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(1, 16),
      new THREE.MeshStandardMaterial({ color: zone.color, roughness: 1 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(zone.width / 1.7, zone.depth / 1.7, 1);
    mesh.position.set(zone.x, 0.015, zone.z);
    statics.add(mesh);
  }
  for (const road of BATTLEFIELD.roads)
    createRoad(
      statics,
      road.points,
      road.width,
      road.width > 4 ? 0xb0a17a : 0x968b68,
    );
  const river = BATTLEFIELD.river;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(river.width, river.to - river.from),
    new THREE.MeshStandardMaterial({
      color: 0x376d70,
      transparent: true,
      opacity: 0.91,
      roughness: 0.3,
      metalness: 0.12,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(river.x, 0.055, 0);
  const waterTime = { value: 0 };
  water.material.onBeforeCompile = shader => {
    shader.uniforms.uRiverTime = waterTime;
    shader.vertexShader = "varying vec2 vRiver;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\n vRiver = position.xy;");
    shader.fragmentShader = "uniform float uRiverTime; varying vec2 vRiver;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>",
      `#include <color_fragment>
       float ripple = sin(vRiver.y*2.8 + sin(vRiver.x*2.1 + uRiverTime)*.8 - uRiverTime*1.5);
       float shoal = smoothstep(2.6,4.5,abs(vRiver.x));
       diffuseColor.rgb *= .78 + shoal*.36 + ripple*.022;
       diffuseColor.rgb += vec3(.01,.02,.016)*pow(max(0.,ripple),18.);
      `);
  };
  scene.add(water);
  // Riverbank ribbons follow the channel and remain visually below the decks.
  for (const sign of [-1, 1])
    createRoad(
      statics,
      [
        [river.x + sign * (river.width / 2 + 0.3), -65],
        [river.x + sign * (river.width / 2 + 0.3), 65],
      ],
      0.7,
      0xb4ae8a,
    );
  for (const c of BATTLEFIELD.crossings) {
    if (c.terrain === "ford") {
      const shallow = new THREE.Mesh(
        new THREE.CircleGeometry(1, 24),
        new THREE.MeshStandardMaterial({
          color: 0x88aaa1,
          transparent: true,
          opacity: 0.53,
          roughness: 0.8,
        }),
      );
      shallow.rotation.x = -Math.PI / 2;
      shallow.scale.set(c.width / 2, c.depth / 2, 1);
      shallow.position.set(c.x, 0.07, c.z);
      scene.add(shallow);
      for (let i = 0; i < 30; i++)
        box(
          statics,
          c.x + Math.sin(i * 2.4) * 4.2,
          0.07,
          c.z + Math.cos(i * 1.7) * 9,
          0.5,
          0.12,
          0.35,
          0xa9ae9a,
        );
    } else {
      const stone = c.terrain === "stone",
        color = stone ? 0xb0aea0 : 0x8a6747;
      box(statics, c.x, 0.055, c.z, c.width, 0.11, c.depth, color);
      if (!stone) {
        for (let i = 0; i < Math.floor(c.width / 0.8); i++) {
          const plank = box(statics, c.x - c.width / 2 + 0.4 + i * 0.8,
            0.14 + (i % 3) * 0.008, c.z, 0.73, 0.05,
            c.depth - 0.5 - (i % 4) * 0.08,
            [0x8a6747, 0x78583c, 0x98734e][i % 3]);
          plank.rotation.y = Math.sin(i * 4.7) * 0.006;
          plank.castShadow = false;
        }
      }
      for (let i = 0; i < Math.floor(c.width / 0.8); i++)
        box(
          statics,
          c.x - c.width / 2 + 0.4 + i * 0.8,
          0.12,
          c.z,
          0.06,
          0.03,
          c.depth,
          stone ? 0x969589 : 0x594632,
        );
      for (const sign of [-1, 1]) {
        box(
          statics,
          c.x,
          stone ? 0.75 : 0.9,
          c.z + sign * (c.depth / 2 - 0.12),
          c.width,
          stone ? 1.25 : 0.12,
          0.24,
          color,
        );
        for (const x of [-c.width / 2 + 0.5, 0, c.width / 2 - 0.5])
          box(
            statics,
            c.x + x,
            0.6,
            c.z + sign * (c.depth / 2 - 0.12),
            0.4,
            1.2,
            0.4,
            color,
          );
      }
      if (stone)
        for (const x of [-8, 8])
          createBanner(statics, c.x + x, c.z - c.depth / 2 - 1, 0x9d7c52, 3.5);
    }
  }
  // Current streaks slide along the river; no fluid simulation or new lights.
  const streaks = new THREE.Group();
  scene.add(streaks);
  const verts = [];
  for (let i = 0; i < 55; i++) {
    const x = river.x + Math.sin(i * 3.1) * 3.7,
      z = -80 + i * 3;
    verts.push(x, 0.085, z, x + 0.1, 0.085, z + 0.9 + (i % 3) * 0.4);
  }
  streaks.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(verts, 3),
      ),
      new THREE.LineBasicMaterial({
        color: 0xb6ddd8,
        transparent: true,
        opacity: 0.38,
      }),
    ),
  );
  const smoke = [];
  for (let i = 0; i < 6; i++) {
    const puff = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.65, 0),
      new THREE.MeshBasicMaterial({
        color: 0xc8c9bb,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    scene.add(puff);
    smoke.push(puff);
  }
  for (const z of [-5, 5]) {
    box(statics, 48.3, 1, z, 0.2, 2, 0.2, 0x55452f);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.8, 5),
      new THREE.MeshBasicMaterial({ color: 0xffb860 }),
    );
    flame.position.set(48.3, 2.2, z);
    statics.add(flame);
  }
  // Roofless village foundations / courtyard details stay on blocked footprints.
  for (const o of BATTLEFIELD.ruins.filter((_, i) => i % 3 === 0))
    box(
      statics,
      o.x,
      0.2,
      o.z,
      Math.min(o.width, 1.6),
      0.4,
      Math.min(o.depth, 1.6),
      0x777769,
    );
  return (time) => {
    waterTime.value = time;
    streaks.position.z = (time * 0.65) % 3;
    water.material.opacity = 0.9 + Math.sin(time * 0.7) * 0.025;
    smoke.forEach((p, i) => {
      const t = (time * 0.15 + i / 6) % 1;
      p.position.set(54 + t * 2, 8 + t * 9, 2 + Math.sin(t * 4) * 0.5);
      p.scale.setScalar(0.5 + t * 1.7);
      p.material.opacity = (1 - t) * 0.22;
    });
  };
}

// Static scenery is batched by material to keep the richer map inexpensive.
export function batchScenery(group) {
  group.updateMatrixWorld(true);
  const batches = new Map();
  group.traverse((o) => {
    if (!o.isMesh || o.material.transparent) return;
    const m = o.material,
      key = [m.type, m.color?.getHex(), m.side, m.roughness, m.vertexColors, o.castShadow, o.receiveShadow].join("/");
    if (!batches.has(key))
      batches.set(key, { material: m.clone(), geometries: [], objects: [], castShadow: o.castShadow, receiveShadow: o.receiveShadow });
    const b = batches.get(key);
    b.geometries.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
    b.objects.push(o);
  });
  for (const b of batches.values()) {
    const geometry = mergeGeometries(b.geometries);
    if (!geometry) {
      b.geometries.forEach((g) => g.dispose());
      b.material.dispose();
      continue;
    }
    const mesh = new THREE.Mesh(geometry, b.material);
    mesh.castShadow = b.castShadow;
    mesh.receiveShadow = b.receiveShadow;
    for (const o of b.objects) {
      o.removeFromParent();
      o.geometry.dispose();
      o.material.dispose();
    }
    b.geometries.forEach((g) => g.dispose());
    group.add(mesh);
  }
}
