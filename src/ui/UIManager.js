import { AlgorithmInspector } from './AlgorithmInspector.js';
import {
  CONFIG,
  UNIT_TYPES,
  RED_COMPOSITION,
  DEFAULT_COMPOSITION,
  PATH_PROFILES,
} from "../config.js";
import { compositionTotal } from "../systems/DeploymentSystem.js";

function troopIcon(type) {
  const color = "#" + PATH_PROFILES[type].color.toString(16);
  const weapon =
    type === "guard"
      ? '<path d="M7 26h18v15L16 49 7 41z" fill="' +
        color +
        '"/><path d="M16 30v12M11 35h10" stroke="#213038" stroke-width="2"/>'
      : type === "berserker"
        ? '<path d="M43 14v35" stroke="#a39171" stroke-width="3"/><path d="M35 16q9-10 18 0v10q-9 8-18-1z" fill="' +
          color +
          '"/>'
        : '<path d="M45 14l3 7-2 20h-3l-1-20z" fill="' +
          color +
          '"/><path d="M39 38h12" stroke="#b8a382" stroke-width="3"/>';
  return (
    '<svg viewBox="0 0 60 58" aria-hidden="true"><path d="M21 47l2-19h16l4 19z" fill="#547fa5"/><path d="M25 46v8m13-8v8" stroke="#273335" stroke-width="5"/><circle cx="31" cy="19" r="8" fill="#d2c5a3"/><path d="M23 18q0-12 8-12t8 12z" fill="' +
    color +
    '"/>' +
    weapon +
    "</svg>"
  );
}
export class UIManager {
  constructor(game, actions) {
    this.game = game;
    document.querySelector("#app").innerHTML = `
      <header><div class="brand"><span class="crest">♜</span><div><small>THE SIEGE OF RED KEEP</small><h1>KINGDOM WARS</h1></div></div>
      <div class="header-tools"><button id="focus">Focus army</button><button id="battleView">Battle view</button><button id="castle">Red keep</button><button id="home">Overview</button><button id="algorithmView" aria-pressed="false">Algorithm View</button><span id="phase" class="phase-badge">PREPARATION</span></div></header>
      <aside>
        <small>ENEMY INTELLIGENCE</small><h2>Break the defense.</h2><p class="muted">Defeat the Red army to take the keep. Study the approaches before committing.</p>
        <div class="enemy-roster"><strong>${compositionTotal(RED_COMPOSITION)}</strong><div>RED DEFENDERS<span>${RED_COMPOSITION.warrior} Warriors · ${RED_COMPOSITION.berserker} Berserkers · ${RED_COMPOSITION.guard} Guards</span></div></div>
        <div class="defense-notes"><span>Warriors <b>Middle line</b></span><span>Berserkers <b>Southern flank</b></span><span>Guards <b>Castle entrance</b></span></div>
        <div class="selection-line"><small>SELECTED GROUP</small><b id="selection">Not deployed</b></div>
        <p id="status" class="status" role="status"></p>
        <div id="academic-tools" hidden><p class="muted">GLOBAL PLANNING<br>A* decides where the group goes.<br>LOCAL MOVEMENT<br>Boids determines how soldiers move.</p><button id="compare">Compare three routes</button>
        <table id="comparison" class="comparison" hidden><caption>Same start · same destination</caption><thead><tr><th>Profile</th><th>Distance</th><th>Cost</th><th>Nodes</th></tr></thead><tbody id="comparison-body"></tbody></table>
        <div class="lab-controls"><small>SWARM LAB · NO COMBAT</small><div class="button-pair"><button id="bridgeDemo">Narrow bridge</button><button id="ruinsDemo">Village alley</button></div><button id="exitDemo" hidden>Return to preparation</button></div>
        <details open id="inspector"><summary>ALGORITHM INSPECTOR</summary>
        <details open><summary>PATHFINDING</summary><p id="route-context" class="muted">Same A*. Different priorities.</p>
        ${Object.entries(PATH_PROFILES)
          .map(
            ([type, p]) => `<div class="route-card ${type}">
          <label><input id="${type}" type="checkbox" checked aria-label="Show ${UNIT_TYPES[type].label} path"><b>${UNIT_TYPES[type].label}</b><span>${p.label}</span></label>
          <div class="route-metrics"><span>Length <b id="length-${type}">—</b></span><span>Cost <b id="cost-${type}">—</b></span><span>Explored <b id="nodes-${type}">—</b></span><span>Waypoint <b id="waypoint-${type}">—</b></span></div><p class="route-detail" id="crossing-${type}">Crossing: —</p><p class="route-detail" id="terrain-${type}">Terrain: —</p>
          </div>`,
          )
          .join("")}
        </details><details><summary>DEBUG OVERLAYS</summary><div class="debug-grid">${[
          ["finalPath", "Final path", ""],
          ["frontier", "Frontier at search completion", ""],
          ["grid", "Navigation grid", "G"],
          ["blocked", "Blocked cells", ""],
          ["visited", "Explored A* cells", ""],
          ["waypoints", "Waypoint markers", ""],
          ["boids", "Boids neighbor radius", "B"],
          ["vectors", "Steering vectors", "V"],
          ["enemyPaths", "Defender routes", ""],
        ]
          .map(
            ([id, label, key]) =>
              `<label><input id="${id}" type="checkbox">${label}<kbd>${key || "·"}</kbd></label>`,
          )
          .join("")}</div>
        </details><details open><summary>LOCAL MOVEMENT · BOIDS</summary><dl><dt>Sample</dt><dd id="sample">—</dd><dt>Arrived</dt><dd id="arrived">—</dd><dt>Render rate</dt><dd id="fps">—</dd></dl>
        <div id="force-strengths" class="force-strengths"></div><p class="vector-key"><span>■ Separation</span><span>■ Cohesion</span><span>■ Alignment</span><span>■ Target</span><span>□ Final acceleration</span></p>
        <div id="agent-metrics"></div></details><details open><summary>GROUP & RUN METRICS</summary><div id="group-metrics"></div></details><p class="muted">Solid lines: Blue group plans. Dashed: defenders. Vectors sample one selected soldier. Road, forest and ford costs shape global routes. Safe routes favor clearance. Colored strengths show weighted local terms. White final steering is acceleration after target/obstacle overrides; arrow lengths are capped.</p></details></div>
      </aside>
      <div class="map-caption"><b id="field-status">Prepare your army</b><span id="field-hint"></span></div>
      <section class="troop-bar" aria-label="Troop selection and orders">
        <div class="bar-intro"><small id="bar-step">01 / MUSTER</small><h3 id="bar-title">Your attacking force</h3><strong id="budget">0 / 30</strong><span id="bar-hint">Click a card to add troops</span></div>
        <div class="troop-cards">${Object.entries(UNIT_TYPES)
          .map(
            ([type, s]) => `<div class="troop-card ${type}">
          <button class="card-add" data-type="${type}" aria-label="Add ${s.label}">${troopIcon(type)}<span><b>${s.label}</b><small>${PATH_PROFILES[type].label} path</small><em>HP ${s.health} · ATK ${s.damage}</em></span><strong id="amount-${type}">0</strong></button>
          <button class="card-remove" data-remove="${type}" aria-label="Remove ${s.label}">−</button></div>`,
          )
          .join("")}</div>
        <div id="prep-actions" class="bar-actions"><label>FORMATION<select id="formation"><option value="block">Compact block</option><option value="line">Line</option><option value="wide">Wide ranks</option></select></label>
          <div class="button-pair"><button id="balanced">Balanced 30</button><button id="deploy">Deploy</button></div><button id="start" class="primary" disabled>START WAR →</button></div>
        <div id="battle-actions" class="bar-actions" hidden><div class="button-pair"><button id="selectArmy">All groups</button><button id="pause">Pause</button></div><button id="attack" class="primary">Advance to the keep →</button><span id="remaining"></span></div>
        <button id="reset" class="reset-button" title="Reset to preparation">Reset</button>
      </section>
      <footer><span id="footer-phase">Choose troops and formation → Start War → Draw route</span><span>1/2/3: select class · Drag: draw route · WASD: pan · Scroll: zoom · P/G/B/V: debug · Home: overview</span></footer>
      <div id="outcome" class="outcome" hidden><div><small>THE BATTLE IS OVER</small><h2 id="result-title"></h2><p id="result-message"></p><button id="replay" class="primary">Play again</button></div></div>`;
    for (const id of [
      "focus",
      "battleView",
      "castle",
      "home",
      "compare",
      "bridgeDemo",
      "ruinsDemo",
      "exitDemo",
      "deploy",
      "start",
      "selectArmy",
      "pause",
      "attack",
      "reset",
      "replay",
    ])
      document.getElementById(id).onclick = actions[id];
    document.getElementById("balanced").onclick = () => {
      if (game.phase !== "PREPARATION") return;
      game.composition = { ...DEFAULT_COMPOSITION };
      game.invalidateDeployment();
      actions.preview();
      this.update();
    };
    for (const button of document.querySelectorAll("[data-type]"))
      button.onclick = () => {
        const type = button.dataset.type;
        if (game.phase === "PREPARATION") {
          if (compositionTotal(game.composition) >= CONFIG.maxPlayerUnits)
            return;
          game.composition[type]++;
          game.invalidateDeployment();
          actions.preview();
        } else if (["BATTLE", "DEMONSTRATION"].includes(game.phase))
          actions.selectGroup(type);
        this.update();
      };
    for (const button of document.querySelectorAll("[data-remove]"))
      button.onclick = () => {
        if (game.phase !== "PREPARATION") return;
        const type = button.dataset.remove;
        if (game.composition[type] === 0) return;
        game.composition[type]--;
        game.invalidateDeployment();
        actions.preview();
        this.update();
      };
    document.getElementById("formation").onchange = (e) => {
      game.formation = e.target.value;
      game.invalidateDeployment();
      actions.preview();
      this.update();
    };
    for (const id of [
      ...Object.keys(PATH_PROFILES),
      "grid",
      "blocked",
      "visited",
      "waypoints",
      "boids",
      "vectors",
      "enemyPaths",
      "frontier",
      "finalPath",
    ])
      document.getElementById(id).onchange = (e) =>
        actions.toggle(id, e.target.checked);
    this.inspector = new AlgorithmInspector(game, actions);
    this.update();
  }
  update(fps = 0, sample = null) {
    this.inspector?.update(sample);
    const g = this.game,
      prep = g.phase === "PREPARATION",
      blue = g.blue?.active ?? [],
      total = compositionTotal(g.composition);
    document.getElementById("phase").textContent = g.paused
      ? "PAUSED"
      : g.phase === "DEMONSTRATION"
        ? "DEMO · NO COMBAT"
        : g.phase;
    document.getElementById("prep-actions").hidden = !prep;
    document.getElementById("battle-actions").hidden = prep;
    document.getElementById("compare").hidden = !prep;
    document.querySelector(".lab-controls").hidden =
      !prep && g.phase !== "DEMONSTRATION";
    document.getElementById("bridgeDemo").hidden = !prep;
    document.getElementById("ruinsDemo").hidden = !prep;
    document.getElementById("exitDemo").hidden = g.phase !== "DEMONSTRATION";
    document.getElementById("attack").disabled = g.phase === "DEMONSTRATION";
    document.getElementById("status").textContent = g.message;
    const fighting = [...blue, ...g.red.active].filter(
      (s) => s.state === "ATTACKING",
    ).length;
    const responding = g.red.active.filter(
      (s) => !s.arrived || s.state === "ATTACKING",
    ).length;
    document.getElementById("field-status").textContent = prep
      ? g.placementArmed
        ? "Click inside the Blue staging area to place your formation"
        : g.blue
        ? blue.length + " soldiers deployed — ready to attack"
        : "Choose troops to show your formation"
      : g.phase === "DEMONSTRATION"
        ? "SWARM DEMO — COMBAT IS OFF"
        : g.paused
          ? "BATTLE PAUSED — click Resume"
          : fighting
            ? "FIGHTING · " +
              fighting +
              " engaged · Red " +
              g.red.active.length +
              " remaining"
            : blue.some((s) => !s.arrived)
              ? "ADVANCING · " + responding + " Red defenders responding"
              : "AWAITING ORDERS · Select a group, then drag to draw its route";
    document.getElementById("field-hint").textContent = prep
      ? g.message
      : g.phase === "DEMONSTRATION"
        ? "Return to preparation, deploy your army and Start War for a real battle."
        : g.message;
    document.getElementById("selection").textContent = g.blue?.selected
      ? g.blue.selectedGroup === "all"
        ? "All Blue groups"
        : UNIT_TYPES[g.blue.selectedGroup].label + " group"
      : g.blue
        ? "None selected"
        : "Not deployed";
    document.getElementById("bar-step").textContent = prep
      ? "01 / MUSTER"
      : "02 / COMMAND";
    document.getElementById("bar-title").textContent = prep
      ? "Your attacking force"
      : g.blue?.selectedGroup === "all"
        ? "All groups selected"
        : (UNIT_TYPES[g.blue?.selectedGroup]?.label ?? "Select a group");
    document.getElementById("bar-hint").textContent = prep
      ? "Click a card to add troops"
      : "Click a card to select its group";
    document.getElementById("budget").textContent = prep
      ? `${total} / ${CONFIG.maxPlayerUnits}`
      : `${blue.length} remaining`;
    document.getElementById("remaining").textContent =
      `Blue ${blue.length} · Red ${g.red.active.length}`;
    for (const [type, s] of Object.entries(UNIT_TYPES)) {
      const count = prep
        ? g.composition[type]
        : blue.filter((u) => u.unitType === type).length;
      document.getElementById("amount-" + type).textContent = count;
      const add = document.querySelector('[data-type="' + type + '"]'),
        remove = document.querySelector('[data-remove="' + type + '"]');
      add.disabled = prep ? total >= CONFIG.maxPlayerUnits : count === 0;
      add.setAttribute(
        "aria-label",
        prep ? "Add " + s.label : "Select " + s.label + " group",
      );
      add
        .closest(".troop-card")
        .classList.toggle(
          "selected",
          !prep &&
            g.blue?.selected &&
            (g.blue.selectedGroup === "all" || g.blue.selectedGroup === type),
        );
      remove.hidden = !prep;
      remove.disabled = count === 0;
    }
    document.getElementById("start").disabled = !g.blue;
    document.getElementById("deploy").disabled = total === 0;
    document.getElementById("deploy").hidden = !g.blue;
    document.getElementById("deploy").textContent = g.placementArmed
      ? "Click staging area…"
      : g.blue
        ? "Reposition"
        : "Deploy";
    document.getElementById("formation").value = g.formation;
    document.getElementById("pause").textContent = g.paused
      ? "Resume"
      : "Pause";
    const paths = prep ? (g.previewPaths ?? {}) : (g.blue?.paths ?? {});
    document.getElementById("route-context").textContent = prep
      ? "Comparison: identical endpoints · no movement"
      : Object.values(g.blue?.paths ?? {}).some(p => p.mode === "Guided A*")
        ? "Your sketch + A* obstacle detours"
        : "Automatic routes to clicked destinations";
    document.getElementById("comparison").hidden = !prep || !g.previewPaths;
    document.getElementById("comparison-body").innerHTML = Object.entries(paths)
      .filter(([, p]) => p)
      .map(
        ([type, p]) =>
          "<tr><th>" +
          PATH_PROFILES[type].label +
          "</th><td>" +
          p.length.toFixed(1) +
          "</td><td>" +
          p.cost.toFixed(1) +
          "</td><td>" +
          p.expanded +
          "</td></tr>",
      )
      .join("");
    for (const type of Object.keys(PATH_PROFILES)) {
      const p = paths[type],
        group = g.blue?.members(type) ?? [],
        moving = group.filter((s) => s.route.length);
      document.getElementById("cost-" + type).textContent = p
        ? p.cost.toFixed(1)
        : "—";
      document.getElementById("crossing-" + type).textContent =
        "Crossing: " + (p?.crossings?.join(", ") || "None");
      document.getElementById("terrain-" + type).textContent =
        "Terrain: " + (p?.terrainTypes?.join(" · ") || "—");
      document.getElementById("waypoint-" + type).textContent =
        sample?.unitType === type && sample.route.length
          ? Math.min(sample.waypoint + 1, sample.route.length) +
            " / " +
            sample.route.length
          : moving.length
            ? Math.round(
                (moving.reduce((v, s) => v + s.waypoint / s.route.length, 0) /
                  moving.length) *
                  100,
              ) + "% avg"
            : p ? p.waypoints.length + " planned" : "—";
      document.getElementById("length-" + type).textContent = paths[type]
        ? `${paths[type].length.toFixed(1)} m`
        : "—";
      document.getElementById("nodes-" + type).textContent =
        paths[type]?.expanded ?? "—";
    }
    document.getElementById("sample").textContent = sample
      ? `${sample.unitType} / ${sample.state.toLowerCase()}`
      : "—";
    document.getElementById("force-strengths").innerHTML = [
      "separation",
      "cohesion",
      "alignment",
      "target",
      "final",
    ]
      .map(
        (name) =>
          "<span>" +
          name +
          "<b>" +
          (
            (name === 'final' ? (sample?.debugSteering?.length() ?? 0) : (sample?.debugForces?.[name]?.length() ?? 0)) *
            (sample?.debugWeights?.[name] ?? 1)
          ).toFixed(2) +
          "</b></span>",
      )
      .join("");
    const members = g.blue?.members(g.blue.selectedGroup ?? "all") ?? [];
    document.getElementById("arrived").textContent = members.length
      ? `${members.filter((s) => s.arrived).length} / ${members.length}`
      : "—";
    if (fps)
      document.getElementById("fps").textContent = `${Math.round(fps)} FPS`;
    document.getElementById("footer-phase").textContent = prep
      ? "Choose troops and formation → Start War → Draw your route"
      : g.blue?.selected
        ? "Drag ground: draw route · Click: automatic route · Advance to keep: attack"
        : "Select a Blue group";
    const ended = ["VICTORY", "DEFEAT", "DRAW"].includes(g.phase);
    document.getElementById("outcome").hidden = !ended;
    if (ended) {
      document.getElementById("result-title").textContent = g.phase;
      document.getElementById("result-message").textContent =
        g.phase === "VICTORY"
          ? "The defenders are defeated. Red Keep has fallen."
          : g.phase === "DEFEAT"
            ? "Your attacking force has fallen. Try a different approach."
            : "Both forces have fallen.";
    }
  }
}
