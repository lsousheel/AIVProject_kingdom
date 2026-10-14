# Kingdom Wars: Interactive Army Battle Simulator

**“We explore how different A*-based navigation strategies interact with Boids-based local swarm behavior in a 3D battlefield.”**

An existing plain JavaScript / Three.js / Vite project, extended into a siege scenario. Blue is an attacking force deployed in an open staging area. There is one Red castle, defended by 34 preset soldiers. The core academic systems remain our custom A* and Boids.

## Run

```sh
npm install
npm run dev
npm test
npm run build
```

Open Vite's printed local URL. For Vercel, use the Vite preset, build command `npm run build`, output `dist`. No backend or environment variables are needed. The production build has a non-blocking size advisory for the Three.js-containing JavaScript chunk.

## Quick demonstration

1. Click **Compare three routes** before deploying. All three searches use identical endpoints, making cost-profile differences easy to explain.
2. Inspect the colored lines and per-class length, estimated cost, crossing, terrain and expansion metrics in the left sidebar. Toggle individual routes, explored cells and waypoint markers.
3. Click the bottom troop cards to add units. Use the small minus controls to remove them. **Balanced 30** quickly fills 10 of each class.
4. Choose Compact block, Line or Wide ranks. Soldiers appear immediately and update when troops or formation change. **Reposition** is optional.
5. Click **Start War**. Select a soldier or troop card, then hold the left mouse button and sketch a route. Release to move. Class-profile A* performs one search to the destination, using distance from your sketch as a soft cost. It favors your reference while skipping unnecessary bends and loops and detouring around obstacles. An obstructed endpoint is adjusted to the nearest reachable ground. Red reacts when attackers approach.
6. Use **Battle view** to find the fighting. Groups calculate separate routes and may split across the map. **Advance to the keep** reissues an attack order to the currently selected group(s).
7. Click a soldier/card or press **1 / 2 / 3** for Warriors / Berserkers / Guards. Click clear ground with either mouse button to move only that class. Manual movement interrupts pursuit and attacks until arrival; units can still take damage. Escape clears selection.
8. Inspect the neighbor radius and steering vectors of one selected soldier. Pause to explain the interaction of global plans and local steering.
9. Defeat every Red soldier to win. Castle destruction is not required. Reset / Play again returns to an empty roster and the original defensive positions.

Composition and formation are locked after Start War. Preparation changes immediately rebuild the visible formation, preserving its position when it fits, or returning it to the staging center.

## Swarm lab (no combat)

During preparation, click **Narrow bridge** or **Village alley** in the left sidebar. A temporary 24-Berserker group follows an ordinary A* plan while Red remains stationary and combat is disabled. The camera focuses the experiment and enables one-soldier neighbor/vector overlays. Pause, select a soldier and inspect its four numerical force strengths. **Return to preparation** restores your original composition, formation and deployed position; Reset instead clears preparation normally.

Every soldier owns its own waypoint cursor; one fast soldier cannot advance the whole group. In the repeatable bridge test, a 6.8-unit-wide group compresses to about 2.4 units inside the channel and expands to about 7.2 at arrival, with minimum measured body spacing about 0.758 (nominal diameter 0.76). This is local steering and collision validation, not a formation teleport.

## Controls

| Input | Action |
| --- | --- |
| Troop card in preparation | Add one soldier |
| Small minus on card | Remove one soldier |
| Choose troops / formation | Immediately show the formation; no Deploy step |
| Hold left mouse and drag on ground | Sketch a route; A* follows the guidance and finds obstacle detours to the destination. |
| Reposition + ground click | Choose another valid staging position |
| Start War | Enable battle; troops await your movement orders |
| Battle view | Focus current fighting (or selected troops if none) |
| 1 / 2 / 3 | Select and focus Warrior / Berserker / Guard |
| Escape | Deselect troops |
| Troop card in battle / click Blue soldier | Select that class group |
| All groups | Select every active Blue unit |
| Left/right click clear ground | Move selected group(s), overriding combat pursuit until arrival; invalid orders preserve routes |
| WASD / arrow keys | Pan the camera |
| Scroll | Zoom |
| Home / Overview | Return to the battlefield overview |
| Focus army / Red keep | Focus Blue troops / the Red castle |
| Space / Pause | Pause simulation; focused form controls keep their normal keyboard behavior |
| P | Toggle all three Blue route displays |
| G / B / V | Grid / neighbor radius / steering vectors |

The left panel scrolls independently. Bottom cards own gameplay actions; the left panel owns enemy intelligence, selection information and academic inspection.

## One A*, three cost profiles

All groups use `navigation/AStar.js`. The grid has 80 × 80 cells over a finite 120 × 120 playable area. Every profile shares the same blocked cells, soldier clearance and no-corner-cutting rules. An aggressive route never gains permission to cross walls.

`Grid.js` stores:
- Walkable / blocked cells from obstacle footprints expanded by soldier radius.
- Terrain types, discounted roads, rough-ground costs and crossing names derived from `world/layout.js`. Later overlapping zones override earlier ones: regions, then roads, then crossings.
- An approximate distance to the nearest blocked-cell center, computed once with a two-pass chamfer distance transform.

For a step into a neighbor:

```text
proximity = max(0, 1 - clearance / clearanceRadius)
stepCost  = movementCost × (1
            + terrainWeight × terrainPenalty
            + clearanceWeight × proximity²)

g = accumulated stepCost
h = Euclidean distance to destination × minimum traversal multiplier
f = g + heuristicWeight × h
```

Terrain penalty is terrain cost minus 1, so a road can have a negative penalty. The heuristic is scaled by the minimum possible terrain multiplier to stay a lower bound; a regression test compares standard A* with Dijkstra on discounted roads. Axial movement costs 1 cell; diagonal movement costs √2. Physical route length is reported separately from weighted search cost. The frontier, neighbor expansion, parent reconstruction and reopening logic are shared by every profile.

| Type | Mode | Heuristic weight | Terrain weight | Clearance weight / radius |
| --- | --- | ---: | ---: | --- |
| Warrior | Balanced | 1.0 | 1.0 | 1.7 / 5 world units |
| Berserker | Aggressive | 1.65 | 0.05 | 0 / 0 |
| Guard | Safe | 1.0 | 1.0 | 9 / 9 world units |

Balanced is standard A* minimizing terrain-adjusted distance plus a modest clearance penalty. Aggressive uses weighted A*: it expands more directly toward the goal and mostly ignores rough-ground cost. **Its weighted heuristic gives up the standard shortest-cost guarantee.** Safe remains standard A* but adds a strong, gradual penalty near blocked cells. It prefers broader routes when a detour is worth the clearance.

“Safe” means obstacle clearance, not awareness of enemy damage or threats. Terrain cost is a planning preference; it does not apply an extra speed multiplier during movement.

### Reproducible comparison

From `(-38, 0)` to `(38, 4)` on the configured map:

| Profile | Route length | Estimated cost | Expansions | Detected crossing |
| --- | ---: | ---: | ---: | --- |
| Warrior | 97.9 | 80.6 | 881 | Stone Bridge |
| Berserker | 77.7 | 77.3 | 51 | Wooden Bridge |
| Guard | 124.6 | 158.0 | 3,901 | Southern Ford |

The routes are search results, not hard-coded corridors. Changing the start, destination, terrain or weights can cause profiles to choose the same corridor. Aggressive does not universally guarantee the geometrically shortest route.

The **comparison view** holds start and goal constant and never moves units. **Battle metrics** instead describe the most recent group orders using each group's actual anchor. Expansions count processing events, including any reopened cells, rather than necessarily unique visited cells.

## Boids profiles and group movement

Each soldier uses the existing shared `BoidsSystem.js`:

- Separation pushes away from nearby teammates of **every class**, reducing collisions between intersecting groups.
- Cohesion pulls toward the average visible position of teammates in the **same class group**.
- Alignment matches velocities inside that same group.
- Target steering follows the class's navigation waypoints.

Restricting cohesion and alignment to route groups prevents Guards from being pulled toward Berserkers using a different corridor.

`BOID_PROFILES` contains multipliers on the existing global weights:

| Type | Separation | Cohesion | Alignment | Target |
| --- | ---: | ---: | ---: | ---: |
| Warrior | 1.00 | 1.00 | 1.00 | 1.00 |
| Berserker | 0.95 | 0.75 | 0.90 | 1.15 |
| Guard | 1.10 | 1.15 | 1.10 | 1.00 |

Base separation/cohesion/alignment/target weights remain 2.4 / 0.35 / 0.65 / 2.2. Desired velocity uses class speed; acceleration is clamped. Forces are computed from a common state snapshot before integrating a fixed 1/60-second simulation step.

## A* + Boids integration

A command is planned separately for each selected class, using an actual soldier near its centroid as an anchor. The entire command is committed only when every requested group has a valid plan.

Each soldier receives a connector to its class's shared route, the shared route, and a final connector to its own arrival slot. Slots are unique across groups included in the same command and avoid nearby stationary teammates.

The existing movement safeguards remain:

- Each soldier advances its own waypoint cursor.
- Short lookahead is allowed only along clear segments.
- An obstacle probe prioritizes target steering when social forces point into walls.
- Obstructed waypoints trigger a repair search, throttled to at most once per half-second per agent.
- Stalled-progress recovery briefly prioritizes the route.
- Arrival steering prevents cohesion from holding a soldier away from its slot.
- Proposed motion and pair-separation corrections are validated against the grid.

**Route repairs, connectors and combat pursuit retain the soldier's path profile.** Safe paths can still compress locally; clearance is a soft planning preference, not a rigid formation or guaranteed clearance constraint on every movement sample.

The inspector arrows show weighted force inputs, capped in visual length, for one selected soldier. Obstacle, arrival and stalled-progress overrides may change final velocity. Attacking and idle soldiers have no active movement vectors.

## World and defending army

`Terrain.js` creates a 480 × 480 landscape. The core playable grid stays flat and finite; hills and peripheral trees/rocks extend beyond it. Fog blends the distance. There is no square platform base or visible slab edge. Scenery beyond the playable grid is decorative; issuing an order there is rejected.

The progression is open staging → river decision → ruined village / forest flank → gate or broken-wall approach → Red keep. Distant instanced mountains, trees, rolling hills and fog extend the landscape. Water current streaks and light castle smoke animate inexpensively; torches are emissive geometry without extra lights.

The river at x = -18 is blocked from one navigation boundary to the other. Its three openings are derived from the same crossing footprints used to render the stone bridge (z = -17), wooden bridge (z = 0) and southern ford (z = 27). Soldier-radius and cell inflation leave conservative bank clearance. Bridges stay almost flush with the planar movement surface; the ford is shallow-colored water with pebbles. Deep water is never walkable, including after local Boids steering.

Broken village walls create a direct alley, a wide northern street and an outside southern flank. Northern forest trunks and rocks are blocked footprints surrounded by costly forest and a discounted trail. Outer wall sections have a main gate opening and southern break. The castle's decorative gate is blocked navigation geometry, not a destructible objective.

`BATTLEFIELD` in `world/layout.js` drives region geometry, obstacles, roads and crossing metadata. `TERRAIN_COSTS` is centralized:

| Terrain | Base traversal multiplier |
| --- | ---: |
| Ground | 1.00 |
| Road | 0.78 |
| Stone bridge | 0.85 |
| Wooden bridge | 1.35 |
| Village rubble | 1.40 |
| Forest | 1.50 |
| Shallow ford | 1.65 |

Each profile blends those costs using its terrain weight, then adds clearance cost. Inspector crossing names are collected from cells in the computed path, not assigned by class. Blocking the wooden bridge in a test makes Aggressive A* choose another crossing.

Red's fixed, visible roster is **12 Warriors, 8 Berserkers, 14 Guards**. Stats are identical to Blue equivalents; the advantage is four extra soldiers and defensive positioning.

- Warriors hold the middle approach around `(30, 3)`.
- Berserkers hold a southern interception position around `(42, 25)`.
- Guards protect the castle entrance around `(43, 0)`.

Red remains fixed during preparation and holds while attackers are distant after Start War. Each class independently intercepts nearby invaders in Red territory using the same class-profile A* and Boids. Unengaged groups can return toward their defensive posts. There is no giant behavior tree or replacement engine navigation.

## Classes and combat

| Class | Health | Damage | Defense | Speed | Appearance |
| --- | ---: | ---: | ---: | ---: | --- |
| Warrior | 100 | 15 | 5 | 4.0 | Sword, helmet, small shield |
| Berserker | 70 | 25 | 2 | 4.7 | Axe, crest and shoulder accent |
| Guard | 160 | 9 | 10 | 3.2 | Broader body and large shield |

All use one Soldier class and `UNIT_TYPES` data. Nearby visible enemies are acquired; out-of-range targets are pursued with periodic A* updates. In range, units stop Boids movement, face their target and attack on a cooldown:

```text
damage = max(1, attacker.attackDamage - defender.defense)
```

Attacking soldiers swing their weapons and show amber rings plus health bars. Manual move orders suspend attack/pursuit until arrival without making the soldier invulnerable.

Both sides' damage is collected before applying it, avoiding a fixed first-update advantage. Dead units hide their meshes and health bars and leave active systems. Survivors reacquire targets or resume their group objective. Selected or damaged units display health bars.

Victory is Red active units reaching zero. Defeat is Blue reaching zero; simultaneous elimination is a draw. Combat remains secondary to navigation and swarm inspection.

## Files and tuning

| File | Responsibility |
| --- | --- |
| `src/config.js` | Layout, terrain, path/Boids profiles, classes, army counts, defensive posts and tuning |
| `src/navigation/Grid.js` | Occupancy, terrain cost, clearance field and segment checks |
| `src/navigation/AStar.js` | Shared configurable A* / weighted A* |
| `src/navigation/DebugVisualizer.js` | Per-profile routes, nodes, cells, radius and arrows |
| `src/units/Army.js` | Group selection, class plans, formations and distinct arrival slots |
| `src/units/Soldier.js` | Existing shared class models, health and unit state |
| `src/systems/BoidsSystem.js` | Profile-based group steering and movement safeguards |
| `src/systems/DeploymentSystem.js` | Existing whole-formation placement and budget validation |
| `src/systems/Game.js` | Preparation, preview, battle, pause, outcome and reset |
| `src/systems/EnemySystem.js` | Independent defensive group interception |
| `src/systems/CombatSystem.js` | Profile-preserving pursuit and existing combat |
| `src/world/Terrain.js` | Continuous landscape, instanced mountains/scenery and roads |
| `src/world/layout.js` | Shared battlefield footprints, crossings and terrain costs |
| `src/world/Regions.js` | River, bridges, ruins, ambient animation and scenery batching |
| `src/world/Battlefield.js` | World assembly, staging region and rough-ground display |
| `src/world/EnvironmentFactory.js` | Reusable castle, wall, tree, rock and banner geometry |
| `src/camera/RTSCamera.js` | Smooth pan, zoom, focus and bounds |
| `src/ui/UIManager.js`, `src/style.css` | Bottom troop cards and left academic inspector |
| `src/main.js` | Rendering, input and system wiring |

Primary tuning is centralized in `config.js`: `PATH_PROFILES`, `BOID_PROFILES`, `TERRAIN_ZONES`, `RED_DEFENSE`, `RED_COMPOSITION`, `UNIT_TYPES`, `DEPLOYMENT_ZONES`, and `CONFIG`. `DEFAULT_COMPOSITION` is the Balanced 30 preset; `EMPTY_COMPOSITION` is the initial roster. `CONFIG.armySize` is only the fallback for constructing a standalone Army without a composition.

Keep world size divisible by cell size. If obstacles are changed dynamically, recompute the grid's clearance data; this version uses static geometry.

## Validation and limits

`npm test` runs 32 tests: automatic formation display, soft sketch guidance, loop prevention, A* obstacle detours, river crossings and endpoint adjustment, stable defender orders, pursuit progress, line-of-sight grace, manual battle start/Red response and class-specific combat disengagement, river occupancy, bridge compression/re-expansion, swarm-lab restoration, discounted-road optimality, scenery construction, original navigation regressions, profile route differences, clearance preference, group-isolated orders, both armies completing profile routes, local Boids stability, placement, fixed defenders, state locking, health/death, and complete victories/defeats. See `docs/VALIDATION.md` for measured results and browser checks.

Current limits:
- Balance is illustrative. The tested 30-Berserker southern flank attack wins; a direct approach can lose. No claim of competitive balance is made. Survivors separated by walls may require another player order.
- Safe routes use wall clearance, not enemy threat. Weighted A* can return a suboptimal-cost route.
- Local repairs and individual pursuit paths are not all drawn. Lines show the last global group plans.
- One group per class; no arbitrary subgroup/drag selection or explicit disengage order.
- Formations govern deployment, not rigid movement. This is not a physics-based crowd solver.
- The castle is a visual objective; victory comes from defeating its army.
- Desktop controls; the compact layout is not a complete mobile/touch experience.
- O(n²) neighbor checks and a linear A* frontier remain suitable for this roughly 64-unit scope. FPS varies by view, GPU, overlays and active browser tabs.
- Navigation remains planar. Shore margins are conservative cell approximations; route clearance is distance to blocked-cell centers. The narrow bridge has two usable grid rows.
- Ambient scenery is merged/instanced (45 environment mesh objects, about 23.6k triangles before units/debug); rendering still depends on device and view.
- Google Fonts is optional; system fonts provide an offline fallback.

Recommended next improvements: a cost/clearance heatmap, editable profile sliders with a controlled comparison benchmark, explicit retreat orders and battle balance. Profile performance before adding a heap or spatial hash.

Prior versions are preserved in `baseline-navigation-backup.zip`, `baseline-battle-backup.zip` and `baseline-environment-backup.zip` (the complete pre-environment phase).


## Visual polish

The October 12 scene update adds warm lighting, layered terrain, animated river shading, richer crossings, a taller Red Keep, props, clustered forests and clearer soldier accents. Gameplay and navigation are preserved. See [the visual polish report](docs/VISUAL_POLISH.md) for files, verification, performance and limitations.
# Algorithm presentation tools

Use **Algorithm View** for route comparison, search overlays, live Boids inspection and six combat-free movement presets. See [the presentation guide](docs/ALGORITHM_DEMO.md) for a live-demo walkthrough, implementation details and limitations.

# Royal briefing

Every fresh load opens the Blue King's five-scene briefing. **Skip tutorial** and **Begin the siege** share a cinematic battlefield reveal. Use **Replay briefing** in the toolbar to view it again. See [the briefing report](docs/ROYAL_BRIEFING.md).

"# AIVProject_kingdom" 
