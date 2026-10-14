import * as THREE from "three";
import "./style.css";
import {
  CONFIG,
  OBSTACLES,
  BLUE_START,
  RED_CASTLE,
  TERRAIN_ZONES,
} from "./config.js";
import { Grid } from "./navigation/Grid.js";
import { Battlefield } from "./world/Battlefield.js";
import { Game } from "./systems/Game.js";
import { UIManager } from "./ui/UIManager.js";
import { RTSCamera } from "./camera/RTSCamera.js";
import { DebugVisualizer } from "./navigation/DebugVisualizer.js";
import { DEMO_PRESETS } from './systems/DemoPresets.js';
import { IntroSequence } from './intro/IntroSequence.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc6c4ae);
scene.fog = new THREE.Fog(0xc6c4ae, 155, 350);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.domElement.id = "battlefield";
renderer.domElement.setAttribute("aria-label", "Interactive 3D battlefield");
renderer.domElement.tabIndex = 0;
document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xb9d3e1, 0x635442, 1.55));
const sun = new THREE.DirectionalLight(0xffd49b, 3.1);
sun.position.set(-55, 70, 45);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
  left: -85,
  right: 85,
  top: 85,
  bottom: -85,
  far: 230,
});
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.035;
sun.shadow.radius = 2;
scene.add(sun);
const field = new Battlefield(scene),
  grid = new Grid(
    CONFIG.worldSize,
    CONFIG.cellSize,
    OBSTACLES,
    CONFIG.soldierRadius,
    TERRAIN_ZONES,
  );
const game = new Game(scene, grid),
  rts = new RTSCamera(renderer.domElement),
  debug = new DebugVisualizer(scene, grid);
let sample = null;
const reset = () => {
  game.reset();
  sample = null;
  rts.reset();
  ui.update();
  document.querySelector("aside").scrollTop = 0;
};
const ui = new UIManager(game, {
  preview: () => {
    sample = game.blue?.active[0] ?? null;
    if (game.blue) rts.focusPoint(game.blue.center, 0.55);
  },
  deploy: () => {
    game.placementArmed = true;
    game.message =
      "Click clear ground inside the Blue staging boundary to place your formation, then Start War. You choose where it moves.";
    rts.focusPoint(BLUE_START, 0.55);
    ui.update();
  },
  compare: () => {
    game.algorithmView = true;
    game.compareRoutes();
    ui.update();
  },
  bridgeDemo: () => startLab("bridge"),
  startLab,
  ruinsDemo: () => startLab("ruins"),
  exitDemo: () => {
    game.exitDemo();
    sample = game.blue?.active[0] ?? null;
    rts.reset();
    ui.update();
  },
  start: () => {
    if (game.start()) rts.focusArmy(game.blue);
    ui.update();
  },
  selectArmy: () => {
    game.blue?.setSelected(true);
    sample = game.blue?.active[0];
    ui.update();
  },
  selectGroup: selectType,
  attack: () => {
    game.command({ x: 38, z: 4 }, { attackMove: true });
    ui.update();
  },
  battleView: () => {
    const engaged = [...(game.blue?.active ?? []), ...game.red.active].filter(
      (s) => s.state === "ATTACKING",
    );
    const anchor = engaged.find(s => s.team === "blue" && s.selected) ?? engaged.find(s => s.team === "blue") ?? engaged[0];
    const troops = anchor
      ? engaged.filter(s => s.position.distanceTo(anchor.position) < 14)
      : game.blue?.members(game.blue.selectedGroup ?? "all");
    if (troops?.length) rts.focusPoint(game.red.centerOf(troops), engaged.length ? 0.32 : 0.48);
  },
  pause: () => {
    game.paused = !game.paused;
    ui.update();
  },
  focus: () =>
    rts.focusArmy(
      game.blue ?? { center: new THREE.Vector3(BLUE_START.x, 0, BLUE_START.z) },
    ),
  home: () => rts.reset(),
  castle: () => rts.focusPoint({ x: RED_CASTLE.x - 5, z: RED_CASTLE.z - 4 }, 0.62),
  reset,
  replay: reset,
  toggle: (id, on) => {
    debug.flags[id] = on;
  },
});
function selectType(type) {
  if (
    !["PREPARATION", "BATTLE", "DEMONSTRATION"].includes(game.phase) ||
    !game.blue?.members(type).length
  )
    return;
  game.blue.setSelected(true, type);
  sample = game.blue.members(type)[0];
  rts.focusPoint(game.blue.centerOf(game.blue.members(type)), 0.48);
  game.message = game.phase === 'PREPARATION'
    ? `${type} selected. Start War to issue movement orders.`
    : `${type} selected. Right-click for A* movement, or hold left mouse and sketch a route; release to move. A* uses your sketch as a reference and detours around obstacles.`;
  ui.update();
}
function moveSelected(point) {
  game.command(point, { attackMove: false });
  ui.update();
}
function startLab(region) {
  if (!game.startDemo(region)) return;
  sample = game.blue.active[0];
  rts.focusPoint(
    DEMO_PRESETS[region].focus,
    region === 'groups' ? 0.95 : 0.42,
  );
  for (const id of ["boids", "vectors"]) {
    debug.flags[id] = true;
    document.getElementById(id).checked = true;
  }
  ui.update();
}
const raycaster = new THREE.Raycaster(),
  pointer = new THREE.Vector2();
let drawing = null;
const stroke = new THREE.Line(new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0xffe18a, depthTest: false }));
stroke.renderOrder = 100;
scene.add(stroke);
function groundAt(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, rts.camera);
  return raycaster.intersectObject(field.ground)[0]?.point;
}
function clearStroke() {
  drawing = null;
  stroke.visible = false;
}
renderer.domElement.addEventListener("pointermove", e => {
  if (!drawing) return;
  const point = groundAt(e);
  if (!point) return;
  drawing.dragged ||= Math.hypot(e.clientX - drawing.x, e.clientY - drawing.y) > 5;
  if (point.distanceTo(drawing.points.at(-1)) < 0.8) return;
  drawing.points.push(point.clone());
  stroke.geometry.dispose();
  stroke.geometry = new THREE.BufferGeometry().setFromPoints(
    drawing.points.map(p => new THREE.Vector3(p.x, 0.3, p.z)));
  stroke.material.color.setHex(0xffe18a);
  stroke.visible = drawing.dragged;
});
renderer.domElement.addEventListener("pointerup", e => {
  if (!drawing) return;
  const gesture = drawing, point = groundAt(e);
  if (point && gesture.dragged) {
    if (point.distanceTo(gesture.points.at(-1)) > 0.1) gesture.points.push(point.clone());
    game.command(point, { attackMove: false, trace: gesture.points });
  } else if (point && !gesture.hit) moveSelected(point);
  clearStroke();
  if (renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId);
  ui.update();
});
renderer.domElement.addEventListener("pointercancel", clearStroke);
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
renderer.domElement.addEventListener("pointerdown", (e) => {
  renderer.domElement.focus();
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    (-(e.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, rts.camera);
  const ground = raycaster.intersectObject(field.ground)[0];
  if (e.button === 0 && game.phase === "PREPARATION" && game.placementArmed) {
    if (ground && game.deploy(ground.point)) {
      sample = game.blue.active[0];
      rts.focusArmy(game.blue);
    }
    ui.update();
    return;
  }
  if (e.button === 0 && game.blue) {
    const hit = raycaster.intersectObjects(
      game.blue.active.map((s) => s.mesh),
      true,
    )[0];
    if (hit) {
      let object = hit.object;
      while (object && !object.userData.soldier) object = object.parent;
      sample = object?.userData.soldier;
      if (sample) game.blue.setSelected(true, sample.unitType);
    }
    if (ground && game.blue.selected && ["BATTLE", "DEMONSTRATION"].includes(game.phase)) {
      drawing = { points: [ground.point.clone()], x: e.clientX, y: e.clientY, dragged: false, hit: Boolean(hit) };
      renderer.domElement.setPointerCapture(e.pointerId);
    }
    ui.update();
  }
  if (e.button === 2 && ground) moveSelected(ground.point);
});
window.addEventListener("keydown", (e) => {
  if (e.target.matches("input,select,textarea") || e.repeat) return;
  const type = { Digit1: "warrior", Digit2: "berserker", Digit3: "guard" }[
    e.code
  ];
  if (type) selectType(type);
  if (e.code === "Escape") {
    clearStroke();
    game.blue?.setSelected(false);
    sample = null;
    ui.update();
  }
  if (e.code === "Space" && !e.target.matches("button")) {
    e.preventDefault();
    if (["BATTLE", "DEMONSTRATION"].includes(game.phase))
      game.paused = !game.paused;
  }
  if (e.code === "KeyP") {
    const types = ["warrior", "berserker", "guard"];
    const on = !types.every((type) => debug.flags[type]);
    for (const type of types) {
      debug.flags[type] = on;
      document.getElementById(type).checked = on;
    }
  }
  const id = { KeyG: "grid", KeyB: "boids", KeyV: "vectors" }[e.code];
  if (id) document.getElementById(id).click();
});
function resize(cinematic = false) {
  const inset = cinematic ? 0 : innerWidth > 1000 ? 292 : 246,
    width = Math.max(200, innerWidth - inset),
    height = Math.max(200, innerHeight - (cinematic ? 0 : 250));
  renderer.domElement.style.left = inset + "px";
  renderer.domElement.style.top = cinematic ? '0px' : '78px';
  renderer.setSize(width, height);
  rts.resize(width, height);
  // Narrow app panels move the overview farther back; preserve its visibility.
  const fogScale = Math.max(1, height / width);
  scene.fog.near = 155 * fogScale;
  scene.fog.far = 350 * fogScale;
}
let intro;
window.addEventListener("resize", () => resize(intro?.active));
resize();
intro = new IntroSequence({ game, rts, canvas: renderer.domElement, onLayout: resize });
let last = performance.now(),
  accumulator = 0,
  uiTimer = 0,
  frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (intro.active) intro.update(dt);
  else rts.update(dt);
  field.animate(now / 1000);
  accumulator = intro.active ? 0 : accumulator + dt;
  while (accumulator >= 1 / 60) {
    game.update(1 / 60);
    accumulator -= 1 / 60;
  }
  field.deployment.visible = game.phase === "PREPARATION";
  if (
    !sample?.alive ||
    !game.blue?.selected ||
    !sample.selected ||
    !game.blue.active.includes(sample)
  )
    sample = game.blue?.selected
      ? game.blue.members(game.blue.selectedGroup)[0]
      : null;
  debug.update(game, sample);
  for (const army of [game.blue, game.red])
    for (const s of army?.active ?? []) {
      s.healthBar.quaternion.copy(rts.camera.quaternion);
    }
  uiTimer += dt;
  frames++;
  if (uiTimer > 0.25) {
    ui.update(frames / uiTimer, sample);
    uiTimer = 0;
    frames = 0;
  }
  renderer.render(scene, rts.camera);
}
requestAnimationFrame(frame);
