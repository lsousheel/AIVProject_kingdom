import * as THREE from "three";
import { CONFIG } from "../config.js";

export class RTSCamera {
  constructor(canvas) {
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 600);
    this.focus = new THREE.Vector3(4, 0, 0);
    this.smoothFocus = new THREE.Vector3(4, 0, 0);
    this.zoom = 1.2;
    this.smoothZoom = 1.2;
    this.keys = new Set();
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoom = THREE.MathUtils.clamp(
          this.zoom + e.deltaY * 0.0005,
          0.28,
          1.6,
        );
      },
      { passive: false },
    );
    window.addEventListener("keydown", (e) => {
      if (e.target.matches("input,select,textarea")) return;
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.code)
      ) {
        e.preventDefault();
        this.keys.add(e.code);
      }
      if (e.code === "Home") {
        e.preventDefault();
        this.reset();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
    this.update(1);
  }
  reset() {
    this.focus.set(4, 0, 0);
    this.zoom = 1.2;
  }
  focusArmy(army) {
    if (army) {
      this.focus.copy(army.center);
      this.zoom = 0.38;
    }
  }
  focusPoint(point, zoom = 0.38) {
    this.focus.set(point.x, 0, point.z);
    this.zoom = zoom;
  }
  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  update(dt) {
    const horizontal =
      Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
      Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));
    const vertical =
      Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")) -
      Number(this.keys.has("KeyW") || this.keys.has("ArrowUp"));
    this.focus.x = THREE.MathUtils.clamp(
      this.focus.x + horizontal * dt * CONFIG.cameraPanSpeed,
      -52,
      52,
    );
    this.focus.z = THREE.MathUtils.clamp(
      this.focus.z + vertical * dt * CONFIG.cameraPanSpeed,
      -52,
      52,
    );
    const smoothing = 1 - Math.exp(-8 * dt);
    this.smoothFocus.lerp(this.focus, smoothing);
    this.smoothZoom += (this.zoom - this.smoothZoom) * smoothing;
    const fit = this.smoothZoom * Math.max(1, 1 / this.camera.aspect);
    this.camera.position.set(
      this.smoothFocus.x + 10 * fit,
      105 * fit,
      this.smoothFocus.z + 90 * fit,
    );
    this.camera.lookAt(this.smoothFocus);
  }
}
