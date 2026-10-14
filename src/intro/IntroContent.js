import { CONFIG, UNIT_TYPES, PATH_PROFILES } from '../config.js';

const descriptions = {
  warrior: 'Reliable in most situations. Balanced routes and steady swarm movement.',
  berserker: 'Fast, hard-hitting troops. Favor direct routes and accept tighter passages.',
  guard: 'High health and defense. Favor wider routes and stronger group cohesion.',
};

export function troopBriefing() {
  return Object.entries(UNIT_TYPES).map(([type, stats]) => ({
    type, ...stats, mode: PATH_PROFILES[type].label, description: descriptions[type],
  }));
}

export function briefingScenes() {
  return [
    {
      label: '01 / THE MISSION', title: 'The Red Keep\nstands before us.',
      content: `<p class="king-dialogue">Commander, their army holds the river, the ruins, and the castle approaches.</p><p>You will choose our forces, plan the assault, and lead them through the enemy defenses.</p><div class="royal-order"><small>YOUR OBJECTIVE</small><strong>Break the Red defense.<br>Conquer the Keep.</strong></div>`,
    },
    {
      label: '02 / HOW YOUR ARMY THINKS', title: 'One plan.\nMany moving minds.',
      content: `<div class="pillar"><small>PATHFINDING & NAVIGATION</small><h3>A* · Global planning</h3><p>Evaluates routes around water, walls and ruins, weighing terrain and obstacle clearance.</p><svg class="planning-diagram" viewBox="0 0 360 60" role="img" aria-label="A route from start to target bends around a blocked obstacle"><path d="M22 42H90L125 12H232L270 42H337" fill="none" stroke="#dfc388" stroke-width="2"/><rect x="145" y="26" width="62" height="30" rx="3" fill="#647878"/><circle cx="22" cy="42" r="5" fill="#dfc388"/><path d="m330 35 8 7-8 7" fill="none" stroke="#dfc388" stroke-width="2"/><text x="4" y="21">START</text><text x="299" y="21">TARGET</text></svg></div><div class="pillar"><small>SWARM & BOIDS MODELING</small><h3>Boids · Local movement</h3><p>Soldiers avoid crowding, stay together, and match their neighbors as they follow the route.</p><div class="boid-concepts"><span>↔ Separation</span><span>→← Cohesion</span><span>⇉ Alignment</span></div></div><div class="pillar-summary">A* decides <b>WHERE</b> the army goes.<br>Boids decides <b>HOW</b> it moves there.</div>`,
    },
    {
      label: '03 / KNOW YOUR FORCES', title: 'Choose the strength\nof your army.',
      content: `<div class="briefing-troops">${troopBriefing().map(s => `<article class="briefing-troop ${s.type}"><div><h3>${s.label}</h3><small>${s.mode}</small></div><p>${s.description}</p><dl><div><dt>HP</dt><dd>${s.health}</dd></div><div><dt>ATK</dt><dd>${s.damage}</dd></div><div><dt>DEF</dt><dd>${s.defense}</dd></div><div><dt>SPD</dt><dd>${s.speed}</dd></div></dl></article>`).join('')}</div><p class="briefing-note">Different priorities. The same A* and Boids framework.</p>`,
    },
    {
      label: '04 / YOUR BATTLE PLAN', title: 'The approach\nis yours to choose.',
      content: `<ol class="siege-steps"><li><b>Study the defense</b><span>Red begins in fixed defensive positions.</span></li><li><b>Build your force</b><span>Choose up to ${CONFIG.maxPlayerUnits} troops. Your formation appears immediately.</span></li><li><b>Place & begin</b><span>Reposition in the Blue staging zone if needed, then select Start War.</span></li><li><b>Command your groups</b><span>Select a class. Right-click to move, or left-drag your own route reference.</span></li><li><b>Use the terrain</b><span>Compare bridges, forest trails and open approaches in Algorithm View.</span></li><li><b>Break the defense</b><span>Advance to the keep issues an attack order. Defeat the Red army to win.</span></li></ol><div class="briefing-controls"><span><kbd>Click troop</kbd> Select group</span><span><kbd>Right-click</kbd> Move</span><span><kbd>Left-drag</kbd> Sketch route</span><span><kbd>WASD</kbd> Camera</span><span><kbd>Scroll</kbd> Zoom</span><span><kbd>1 / 2 / 3</kbd> Select class</span></div>`,
    },
    {
      label: '05 / THE KING’S FINAL ORDER', title: 'Bring us victory.',
      content: `<p class="king-dialogue">The enemy may have the stronger position, Commander.<br><em>But they do not have your strategy.</em></p><p>Study their defenses. Choose your soldiers wisely.<br>Use the terrain. Choose your routes.</p><div class="royal-order"><strong>Lead our army.<br>Break their defense.<br>Conquer the Red Keep.</strong></div>`,
    },
  ];
}
