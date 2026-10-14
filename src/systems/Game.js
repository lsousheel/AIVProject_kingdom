import { Army } from "../units/Army.js";
import {
  BLUE_START,
  RED_START,
  RED_COMPOSITION,
  RED_DEFENSE,
  EMPTY_COMPOSITION,
  PATH_PROFILES,
} from "../config.js";
import { validateDeployment } from "./DeploymentSystem.js";
import { CombatSystem, battleOutcome } from "./CombatSystem.js";
import { EnemySystem } from "./EnemySystem.js";
import { findPath } from "../navigation/AStar.js";
import { DEMO_PRESETS } from './DemoPresets.js';

// Owns lifecycle, independent of DOM and rendering, so rules can be tested in Node.
export class Game {
  constructor(scene, grid) {
    this.scene = scene;
    this.grid = grid;
    this.reset();
  }
  reset() {
    this.blue?.dispose();
    this.red?.dispose();
    this.blue = null;
    this.red = new Army(this.scene, this.grid, {
      team: "red",
      start: RED_START,
      composition: RED_COMPOSITION,
      defenseLayout: RED_DEFENSE,
    });
    this.composition = { ...EMPTY_COMPOSITION };
    this.previewPaths = null;
    this.demoRestore = null;
    this.algorithmView = false;
    this.formation = "block";
    this.phase = "PREPARATION";
    this.paused = false;
    this.placementArmed = false;
    this.message =
      "Choose troops and a formation to see your army immediately, then click Start War and draw your routes.";
    this.elapsed = 0;
    this.combat = new CombatSystem(this.grid);
    this.enemy = new EnemySystem();
  }
  deploy(center = BLUE_START) {
    if (this.phase !== "PREPARATION") return false;
    const result = validateDeployment(
      this.grid,
      this.composition,
      center,
      this.formation,
    );
    if (!result.ok) {
      this.message = result.reason;
      return false;
    }
    this.blue?.dispose();
    this.blue = new Army(this.scene, this.grid, {
      team: "blue",
      start: { x: center.x, z: center.z },
      composition: { ...this.composition },
      formation: this.formation,
    });
    this.blue.setSelected(true);
    if (this.previewPaths) this.compareRoutes();
    this.placementArmed = false;
    this.message =
      "Formation ready. Click Start War, select a group, then hold left mouse and drag to draw its route. Reposition is optional.";
    return true;
  }
  invalidateDeployment() {
    if (this.phase !== "PREPARATION") return;
    const center = this.blue?.start ?? BLUE_START;
    if (Object.values(this.composition).some(count => count > 0)) {
      if (!this.deploy(center)) this.deploy(BLUE_START);
      return;
    }
    this.blue?.dispose();
    this.blue = null;
    this.placementArmed = false;
    this.message = "Choose troops to show your formation.";
  }
  start() {
    if (this.phase !== "PREPARATION" || !this.blue) return false;
    this.blue.setSelected(true);
    this.phase = "BATTLE";
    this.placementArmed = false;
    this.message =
      "War started — select a group, then hold left mouse and drag on the ground to trace your route. Release to follow it. All groups selects the whole army.";
    return true;
  }
  compareRoutes() {
    if (this.phase !== "PREPARATION") return;
    const start = this.blue?.start ?? BLUE_START;
    this.previewPaths = Object.fromEntries(
      Object.entries(PATH_PROFILES).map(([type, profile]) => [
        type,
        findPath(this.grid, start, { x: 38, z: 4 }, profile),
      ]),
    );
    this.message =
      "Route comparison: identical start and goal, three cost profiles. Troops remain in preparation.";
  }
  startDemo(region) {
    if (this.phase !== "PREPARATION") return false;
    const preset = DEMO_PRESETS[region];
    if (!preset) return false;
    this.demoRestore = {
      composition: { ...this.composition },
      formation: this.formation,
      start: this.blue?.start,
      previewPaths: this.previewPaths,
    };
    this.previewPaths = null;
    this.blue?.dispose();
    const start = preset.start;
    this.blue = new Army(this.scene, this.grid, {
      start,
      composition: preset.composition,
    });
    this.blue.setSelected(true);
    const destination = preset.end;
    if (!this.blue.command(destination)) {
      this.exitDemo();
      return false;
    }
    this.phase = "DEMONSTRATION";
    this.algorithmView = true;
    this.paused = false;
    this.placementArmed = false;
    this.message = `${preset.label}: real A* and Boids movement. Red holds; combat is off. Select a class or soldier to inspect it. Return restores your preparation.`;
    return true;
  }
  exitDemo() {
    if (!this.demoRestore) return;
    const restore = this.demoRestore;
    this.blue?.dispose();
    this.blue = null;
    this.phase = "PREPARATION";
    this.paused = false;
    this.composition = restore.composition;
    this.formation = restore.formation;
    this.demoRestore = null;
    if (restore.start) this.deploy(restore.start);
    this.previewPaths = restore.previewPaths;
    this.message = "Swarm lab complete. Your preparation has been restored.";
  }
  command(destination, { attackMove = false, trace = null } = {}) {
    if (
      !["BATTLE", "DEMONSTRATION"].includes(this.phase) ||
      !this.blue?.selected
    ) {
      this.message = "Select the Blue army during battle to issue orders.";
      return null;
    }
    const path = this.blue.command(destination, this.blue.selectedGroup, {
      attackMove,
      trace,
    });
    this.message = path
      ? `${this.blue.selectedGroup === "all" ? "All groups" : this.blue.selectedGroup}: ${trace ? "following your sketch with A* detours around obstacles" : attackMove ? "advancing and engaging enemies" : "moving to your marker; combat resumes on arrival"}.${path.adjustedDestination ? " Destination adjusted to the nearest reachable ground." : ""}`
      : "No reachable destination for this group. Your previous order is unchanged.";
    return path;
  }
  update(dt) {
    if (this.phase === "DEMONSTRATION") {
      if (!this.paused) this.blue.update(dt);
      return;
    }
    if (this.phase !== "BATTLE" || this.paused) return;
    this.elapsed += dt;
    this.enemy.update(this.red, this.blue, dt);
    this.combat.update(this.blue, this.red, dt);
    this.blue.update(dt);
    this.red.update(dt);
    const outcome = battleOutcome(this.blue, this.red);
    if (outcome) {
      this.phase = outcome;
      this.message = "Battle complete. Reset to prepare another army.";
    }
  }
}
