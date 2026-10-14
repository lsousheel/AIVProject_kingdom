import * as THREE from "three";
import { CONFIG, PATH_PROFILES } from "../config.js";

export class DebugVisualizer {
  constructor(scene, grid) {
    this.scene = scene;
    this.grid = grid;
    this.flags = {
      warrior: true,
      berserker: true,
      guard: true,
      grid: false,
      blocked: false,
      visited: false,
      boids: false,
      vectors: false,
      waypoints: false,
      enemyPaths: false,
      frontier: false,
      finalPath: true,
    };
    this.lines = new THREE.GridHelper(
      grid.size,
      grid.count,
      0xe0d4a1,
      0xaabc9f,
    );
    this.lines.position.y = 0.12;
    scene.add(this.lines);
    const cells = [];
    for (let z = 0; z < grid.count; z++)
      for (let x = 0; x < grid.count; x++)
        if (!grid.walkable(x, z)) cells.push(grid.toWorld({ x, z }));
    this.blocked = this.cells(cells, 0xe47562, 0.4);
    scene.add(this.blocked);
    this.paths = new THREE.Group();
    this.visited = new THREE.Group();
    scene.add(this.paths, this.visited);
    this.neighbor = new THREE.Mesh(
      new THREE.RingGeometry(
        CONFIG.neighborRadius - 0.04,
        CONFIG.neighborRadius,
        64,
      ),
      new THREE.MeshBasicMaterial({ color: 0x70e0d2, side: THREE.DoubleSide }),
    );
    this.neighbor.rotation.x = -Math.PI / 2;
    scene.add(this.neighbor);
    this.arrows = {};
    for (const [name, color] of Object.entries({
      separation: 0xf19180,
      cohesion: 0x87d7a0,
      alignment: 0x7daeff,
      target: 0xf2d08d,
      final: 0xffffff,
    })) {
      this.arrows[name] = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(),
        2,
        color,
        0.5,
        0.25,
      );
      scene.add(this.arrows[name]);
    }
    this.signature = "";
    this.emptyPaths = {};
  }
  cells(points, color, opacity) {
    const mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(
        this.grid.cellSize * 0.9,
        this.grid.cellSize * 0.9,
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      points.length,
    );
    const dummy = new THREE.Object3D();
    dummy.rotation.x = -Math.PI / 2;
    points.forEach((p, i) => {
      dummy.position.set(p.x, 0.13, p.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    return mesh;
  }
  clear(group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
        if (o.isInstancedMesh) o.dispose();
      });
    }
  }
  ribbon(points, width, color, height) {
    const vertices = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        length = Math.hypot(b.x - a.x, b.z - a.z);
      if (!length) continue;
      const x = ((-(b.z - a.z) / length) * width) / 2,
        z = (((b.x - a.x) / length) * width) / 2;
      const q = [
        [a.x + x, a.z + z],
        [a.x - x, a.z - z],
        [b.x + x, b.z + z],
        [b.x - x, b.z - z],
      ];
      for (const index of [0, 1, 2, 2, 1, 3])
        vertices.push(q[index][0], height, q[index][1]);
    }
    return new THREE.Mesh(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      ),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    );
  }
  refresh(game) {
    const bluePaths =
      game.phase === "PREPARATION"
        ? (game.previewPaths ?? this.emptyPaths)
        : (game.blue?.paths ?? this.emptyPaths);
    const signature = [
      game.blue?.routeRevision ?? -1,
      game.red.routeRevision,
      game.phase,
      JSON.stringify(this.flags),
    ].join("/");
    if (
      this.signature === signature &&
      this.lastPaths === bluePaths &&
      this.lastArmy === game.blue &&
      this.lastRed === game.red
    )
      return;
    this.signature = signature;
    this.lastPaths = bluePaths;
    this.lastArmy = game.blue;
    this.lastRed = game.red;
    this.clear(this.paths);
    this.clear(this.visited);
    for (const [enemy, paths] of [
      [false, bluePaths],
      [true, game.red.paths],
    ]) {
      if (enemy && !this.flags.enemyPaths) continue;
      for (const [type, path] of Object.entries(paths)) {
        if (!path || !this.flags[type]) continue;
        const color = PATH_PROFILES[type].color;
        const points = path.waypoints.map(
          (p) => new THREE.Vector3(p.x, enemy ? 0.2 : 0.3, p.z),
        );
        const material = enemy
          ? new THREE.LineDashedMaterial({
              color,
              dashSize: 0.7,
              gapSize: 0.5,
              transparent: true,
              opacity: 0.45,
            })
          : new THREE.LineBasicMaterial({ color });
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          material,
        );
        line.computeLineDistances();
        if (this.flags.finalPath) this.paths.add(line);
        else { line.geometry.dispose(); line.material.dispose(); }
        if (!enemy && this.flags.finalPath) {
          const rank = ['warrior', 'berserker', 'guard'].indexOf(type);
          // Nested widths preserve the three colors where the real routes overlap.
          this.paths.add(this.ribbon(points, 0.62 - rank * 0.18, color, 0.31 + rank * 0.015));
        }
        if (this.flags.waypoints)
          this.paths.add(
            new THREE.Points(
              new THREE.BufferGeometry().setFromPoints(points),
              new THREE.PointsMaterial({ color, size: 0.3 }),
            ),
          );
        for (const [i, p] of [points[0], points.at(-1)].entries()) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(i ? 0.85 : 0.3, i ? 1.05 : 0.45, 32),
            new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.copy(p);
          this.paths.add(ring);
        }
        if (!enemy && this.flags.visited)
          this.visited.add(this.cells(path.visited, color, 0.11));
        if (!enemy && this.flags.frontier)
          this.visited.add(this.cells(path.frontier ?? [], 0xdcb6ef, 0.55));
      }
    }
  }
  update(game, sample) {
    this.refresh(game);
    const inspecting = !!game.algorithmView;
    this.paths.visible = inspecting || game.phase !== 'PREPARATION';
    this.visited.visible = inspecting;
    this.lines.visible = inspecting && this.flags.grid;
    this.blocked.visible = inspecting && this.flags.blocked;
    this.neighbor.visible = inspecting && this.flags.boids && !!sample?.alive;
    if (sample) this.neighbor.position.copy(sample.position).setY(0.2);
    const weights = sample?.debugWeights;
    for (const [name, arrow] of Object.entries(this.arrows)) {
      const force = sample?.alive ? (name === 'final' ? sample.debugSteering : sample.debugForces?.[name]) : null;
      arrow.visible =
        inspecting && this.flags.vectors && !!force && force.lengthSq() > 0.0001;
      if (arrow.visible) {
        arrow.position.copy(sample.position).setY(1);
        arrow.setDirection(force.clone().normalize());
        arrow.setLength(
          Math.min(6, force.length() * (weights?.[name] ?? 1) * 2),
          0.5,
          0.25,
        );
      }
    }
  }
}
