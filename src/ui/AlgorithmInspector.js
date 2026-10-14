import { CONFIG, PATH_PROFILES, BOID_PROFILES } from '../config.js';
import { PROFILE_EXPLANATIONS, groupMetrics } from '../navigation/PresentationMetrics.js';
import { DEMO_PRESETS } from '../systems/DemoPresets.js';

const rows = values => '<dl>' + values.map(([k,v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
const number = value => value == null ? '—' : Number.isFinite(value) ? value.toFixed(2) : 'Open';

export class AlgorithmInspector {
  constructor(game, actions) {
    this.game = game;
    const button = document.getElementById('algorithmView');
    button.onclick = () => { game.algorithmView = !game.algorithmView; this.update(); };
    document.getElementById('finalPath').checked = true;
    document.getElementById('academic-tools').insertAdjacentHTML('afterbegin', '<button id="inspect-pause">Pause simulation</button>');
    document.getElementById('inspect-pause').onclick = actions.pause;
    document.querySelector('.selection-line').insertAdjacentHTML('afterend',
      '<label class="group-picker">COMMAND GROUP<select id="group-picker"><option value="all">All units</option><option value="warrior">Warriors · Balanced</option><option value="berserker">Berserkers · Aggressive</option><option value="guard">Guards · Safe</option></select></label>');
    document.getElementById('group-picker').onchange = e => {
      if (e.target.value === 'all') actions.selectArmy();
      else actions.selectGroup(e.target.value);
    };
    const lab = document.querySelector('.lab-controls');
    lab.insertAdjacentHTML('beforeend', '<div class="demo-extras">' + Object.entries(DEMO_PRESETS)
      .filter(([id]) => !['bridge','ruins'].includes(id))
      .map(([id,p]) => `<button data-demo="${id}">${p.label}</button>`).join('') + '</div>');
    for (const el of lab.querySelectorAll('[data-demo]')) el.onclick = () => actions.startLab(el.dataset.demo);
    for (const [type, p] of Object.entries(PATH_PROFILES)) {
      document.querySelector('.route-card.' + type).insertAdjacentHTML('beforeend',
        `<p class="route-detail">${PROFILE_EXPLANATIONS[type]}</p><p class="route-detail" id="extra-${type}"></p>`);
    }
  }
  update(sample) {
    const g = this.game;
    document.getElementById('academic-tools').hidden = !g.algorithmView;
    document.getElementById('algorithmView').setAttribute('aria-pressed', String(g.algorithmView));
    document.getElementById('algorithmView').textContent = g.algorithmView ? 'Algorithm View · ON' : 'Algorithm View';
    document.getElementById('inspect-pause').textContent = g.paused ? 'Resume simulation' : 'Pause simulation';
    document.getElementById('inspect-pause').hidden = g.phase === 'PREPARATION';
    document.querySelector('.demo-extras').hidden = g.phase !== 'PREPARATION';
    document.getElementById('group-picker').disabled = !g.blue;
    document.getElementById('group-picker').value = g.blue?.selectedGroup ?? 'all';
    if (!g.algorithmView) return;
    const paths = g.phase === 'PREPARATION' ? g.previewPaths : g.blue?.paths;
    for (const type of Object.keys(PATH_PROFILES)) {
      const p = paths?.[type];
      document.getElementById('extra-' + type).textContent = p
        ? `Mode: ${p.mode} · ${p.waypoints.length} waypoints · ${number(p.computationMs)} ms · mean clearance ${number(p.meanClearance)} m` : 'Choose Compare three routes or issue a movement order.';
    }
    const profile = BOID_PROFILES[sample?.unitType];
    document.getElementById('agent-metrics').innerHTML = rows([
      ['Same-class neighbors', sample?.debugNeighbors ?? 0], ['Radius', CONFIG.neighborRadius + ' m'],
      ['Speed', number(sample?.velocity.length()) + ' m/s'],
      ['Waypoint', sample?.route.length ? `${Math.min(sample.waypoint + 1, sample.route.length)} / ${sample.route.length}` : '—'],
    ]) + (profile ? `<p class="muted">${sample.unitType} multipliers: separation ${profile.separation}, cohesion ${profile.cohesion}, alignment ${profile.alignment}, target ${profile.target}. Neighbors require line of sight; separation also sees other friendly classes.</p>` : 'Select a soldier or group.');
    const stats = groupMetrics(g.blue, g.grid, g.blue?.selectedGroup ?? 'all');
    const runs = Object.entries(g.blue?.runs ?? {}).filter(([type]) => g.blue?.selectedGroup === 'all' || type === g.blue?.selectedGroup);
    document.getElementById('group-metrics').innerHTML = stats ? rows([
      ['Profile / units', `${stats.profile} / ${stats.units}`], ['Average speed', number(stats.speed) + ' m/s'],
      ['Average neighbors', number(stats.neighbors)], ['Spread (mean radius)', number(stats.spread) + ' m'],
      ['Mean nearest distance', number(stats.nearest) + ' m'], ['Path cost', number(stats.cost)],
      ['Progress (70% quorum)', Math.round(stats.progress * 100) + '%'], ['Region at centroid', stats.region],
    ]) + runs.map(([type,r]) => `<p class="route-detail">${type}: ${r.finished ? 'Arrived in' : 'Elapsed'} ${r.elapsed.toFixed(1)} s · mean spread ${number(r.samples ? r.spreadSum/r.samples : null)} m · minimum sampled mean nearest distance ${number(r.minMeanNearest)} m</p>`).join('')
      + '<p class="muted">Each soldier advances its own route cursor. One fast soldier cannot advance the others. Costs use different profile weights and are not directly comparable as a universal score. Run times use simulation time; pauses are excluded.</p>' : 'Deploy an army or start a demo.';
  }
}
