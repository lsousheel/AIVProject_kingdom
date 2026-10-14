import * as THREE from "three";

export function box(parent, x, y, z, width, height, depth, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 1 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function createBanner(parent, x, z, color, height = 5) {
  box(parent, x, height / 2, z, 0.13, height, 0.13, 0x645441);
  box(parent, x + 0.75, height - 0.8, z, 1.5, 1.4, 0.08, color);
}
export function createWall(parent, o) {
  box(parent, o.x, 1.5, o.z, o.width, 3, o.depth, 0x9b9c8e);
  const alongX = o.width > o.depth,
    n = Math.floor(Math.max(o.width, o.depth) / 2);
  for (let i = 0; i < n; i++) {
    const offset = (i - (n - 1) / 2) * 2;
    box(
      parent,
      o.x + (alongX ? offset : 0),
      3.3,
      o.z + (alongX ? 0 : offset),
      alongX ? 0.9 : o.width,
      0.6,
      alongX ? o.depth : 0.9,
      0xb8b5a2,
    );
  }
}
export function createCastle(parent, o) {
  const color = o.team === "blue" ? 0x548ded : 0xd36762;
  box(parent, o.x, 1.6, o.z, o.width, 3.2, o.depth, 0xa5a594);
  box(parent, o.x, 4, o.z, 5, 8, 7, 0xc9c3ae);
  box(parent, o.x, 8.2, o.z, 5.5, 0.5, 7.5, color);
  // Recessed windows and stone courses break up the tall keep silhouette.
  for (const y of [3.8, 5.8, 7.4]) {
    for (const dx of [-1.4, 1.4]) {
      box(parent, o.x + dx, y, o.z + 3.51, 0.5, 0.9, 0.06, 0x3c453e);
      box(parent, o.x + dx, y - 0.5, o.z + 3.55, 0.7, 0.1, 0.12, 0xb1a88f);
    }
    box(parent, o.x - 2.51, y, o.z, 0.06, 0.9, 0.5, 0x3c453e);
  }
  for (const y of [3.3, 6.8])
    box(parent, o.x, y, o.z, 5.12, 0.14, 7.12, 0xa49b85);
  for (const dx of [-4, -2, 0, 2, 4])
    box(parent, o.x + dx, 2.2, o.z + o.depth / 2 + 0.02, 0.15, 1.1, 0.07, 0x6c7163);
  for (const dx of [-3.7, 3.7])
    for (const dz of [-7.7, 7.7]) {
      box(parent, o.x + dx, 3.6, o.z + dz, 2.4, 7.2, 2.4, 0xc6c1ae);
      for (const bx of [-0.8, 0.8])
        for (const bz of [-0.8, 0.8])
          box(
            parent,
            o.x + dx + bx,
            7.5,
            o.z + dz + bz,
            0.8,
            0.8,
            0.8,
            0xd0c9b4,
          );
      box(parent, o.x + dx, 5.5, o.z + dz + 1.22, 1, 1.6, 0.1, color);
    }
  // Decorative gate: the castle footprint remains blocked.
  box(
    parent,
    o.x + (o.team === "blue" ? 1 : -1) * (o.width / 2 + 0.02),
    1.4,
    o.z,
    0.15,
    2.8,
    3.4,
    0x3d4238,
  );
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(4.4, 4.5, 4),
    new THREE.MeshStandardMaterial({ color, roughness: 1 }),
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.set(o.x, 10.5, o.z);
  roof.castShadow = true;
  parent.add(roof);
  createBanner(parent, o.x, o.z, color, 15);
}
export function createNaturalObstacle(parent, o) {
  const tree = o.kind === "tree";
  const mesh = new THREE.Mesh(
    tree
      ? new THREE.ConeGeometry(1.25, 5, 6)
      : new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({
      color: tree ? 0x3c5846 : 0x969b91,
      flatShading: true,
    }),
  );
  mesh.position.set(o.x, tree ? 3 : 1.5, o.z);
  if (tree) box(parent, o.x, 0.9, o.z, 0.45, 1.8, 0.45, 0x655640);
  else mesh.scale.set(o.width / 2, 2.5, o.depth / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
}
