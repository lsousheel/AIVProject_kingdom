# Algorithm presentation phase — October 12, 2026

The existing world, UI palette, deployment flow, custom A*, reference-sketch routing, Boids and Red defenders are retained. Backup: `before-algorithm-view-2026-10-12.zip`.

## Present it live

1. Open **Algorithm View** in the top bar. In preparation, choose **Compare three routes**. No soldiers move. Gold is Warrior/Balanced, orange is Berserker/Aggressive, teal is Guard/Safe.
2. Expand **PATHFINDING** for measured length, cost, expansions, waypoint count, terrain, crossing, search time and mean clearance. The three searches use exactly the same start and destination. Costs have different weights: they are not a universal ranking of the routes.
3. Expand **DEBUG OVERLAYS** to show final paths, navigation grid, blocked cells, explored cells, terminal frontier, waypoint markers, neighbor radius or steering arrows. Purple frontier cells are still open when the search finds its goal; this is not a live search replay.
4. Choose **Narrow bridge**, **Village alley**, **Open field**, **Forest trail** or **Castle approach**. Combat is disabled and Red holds position. Select a soldier or its group. Inspect **LOCAL MOVEMENT · BOIDS** and **GROUP & RUN METRICS**. Pause/resume is available inside Algorithm View.
5. Choose **Run three groups** to send six soldiers of each class toward one objective with their own profiles. Group statistics record simulation travel time, sampled average spread and minimum sampled mean nearest-neighbor distance. On arrival the measurements remain visible.
6. **Return to preparation** restores the composition, formation, placement and comparison preview. For normal play, select troops, click **Start War**, select a card/group/soldier, then right-click a destination or left-drag a reference sketch. Turn Algorithm View off for the clean interface.

## Implementation

| Area | Result |
| --- | --- |
| Independent selection | Existing class cards, soldier clicking, selection rings and 1/2/3 retained. Added a persistent All/Warrior/Berserker/Guard selector, available after deployment. A command affects only the selected class. Existing class banners remain. |
| Global profiles | Same custom planner: Balanced combines terrain and clearance; Aggressive uses weighted A* 1.65 with weak terrain cost; Safe strongly penalizes low clearance. No class-to-crossing rule. |
| Comparison | Existing non-moving, common-endpoint preview retained and surfaced in Algorithm View. Colored ribbons use nested widths so coincident segments retain class colors. |
| Route measurements | Existing distance, cost, expanded count, terrain and crossing come from the actual route. Added measured search milliseconds, planned waypoint count and mean obstacle clearance. |
| A* visualization | Added final-path toggle and the actual open frontier at successful termination; existing explored/grid/blocked/waypoint overlays retained. All debug overlays are optional. |
| Boids visualization | Existing radius and four component arrows retained; added white final acceleration after steering overrides. Numerical values reuse simulation calculations. Arrows are length-capped for readability. |
| Boids profiles | Warrior multipliers 1/1/1/1; Berserker separation .95, cohesion .75, alignment .9, target 1.15; Guard 1.1/1.15/1.1/.95. Guard target multiplier was reduced slightly in this phase; other tuning was already implemented. |
| Group progression | Individual route cursors remain independent: one leader never advances the rest. The displayed group progress uses geometric projection onto the planned route and a 70% quorum, not cursor lookahead. |
| Bottlenecks | Existing line-of-sight social forces, local movement validation, stall recovery and individual arrival slots preserved. New forest/gate tests validate safe completion; existing bridge compression and re-expansion checks still pass. |
| Demo lifecycle | Presets only start from preparation. They temporarily replace Blue, disable combat, hold Red, and restore the preparation on exit. Algorithm View itself changes inspection visibility; it does not silently pause battles. |
| Live statistics | Selected agent: neighbors, radius, speed, waypoint and five force magnitudes. Group: units/profile, average speed/neighbors, mean radius, nearest distance, cost, spatial progress and region at centroid. Runs: elapsed/completed time and sampled spread/spacing. |
| Presentation layout | Tactical styling retained, with collapsible pathfinding, debug, Boids and group sections. Fixed fog and caption readability in narrow app panels. |

## Changed files

Created:
- `src/navigation/PresentationMetrics.js`: profile descriptions, geometric progress and group statistics.
- `src/systems/DemoPresets.js`: six movement scenarios.
- `src/ui/AlgorithmInspector.js`: presentation controls and live inspector.
- `tests/presentation.test.js`: ten focused tests.
- `docs/ALGORITHM_DEMO.md`: this delivery and presentation guide.

Modified:
- `src/navigation/AStar.js`: terminal frontier and search timing.
- `src/navigation/DebugVisualizer.js`: frontier, final acceleration, visibility gating and overlapping route colors.
- `src/systems/BoidsSystem.js`: expose neighbor count and actual steering acceleration.
- `src/units/Army.js`: sampled per-class run statistics.
- `src/systems/Game.js`: preset lifecycle and comparison restoration.
- `src/config.js`: small Guard target-weight adjustment.
- `src/ui/UIManager.js`: integrate the inspector, section layout and controls.
- `src/main.js`: wire existing actions to presets/group selection and scale fog for narrow viewports.
- `src/style.css`: compact presentation controls and caption sizing.
- `README.md`: link to this guide.

## Verification and performance

- Full suite: **42 passed, zero failures**. Includes the prior 32 navigation/gameplay/environment tests plus ten presentation tests. After correcting spatial progress, all ten presentation tests passed again.
- Forest, gate, open-field and three-group presets finish with every soldier on walkable ground; Red positions and restored preparation are checked. Existing full battle and victory scenarios still pass.
- Measured default comparison: Balanced 97.9 m / 881 expanded; Aggressive 77.7 m / 51 expanded; Safe 124.6 m / 3901 expanded. Existing tests verify route cost from its actual edges and demonstrate that blocking a crossing changes the route.
- Browser checks cover comparison values, frontier rendering, live vectors/metrics and pause. Local HUD spot samples were about 30–47 FPS while inspected in a narrow app panel; this is not a controlled performance benchmark.
- Route searches and frontier snapshots happen on commands, not every frame. Group/run measurements sample at approximately 4 Hz. One debug soldier uses five arrows. Static search-cell overlays rebuild on route/flag changes. No scenery or dependencies added.
- Production build passes. The existing bundle-size advisory remains; the added code is roughly 8.5 kB minified JavaScript over the visual-polish build.

## Limitations and next phase

- Optional step-by-step A* playback and dimmed completed path segments were not added. The explorer shows final expansion history and the terminal frontier without changing the planner lifecycle.
- Comparison preview uses a fixed common objective and the current deployment start. Movement presets use nearby but distinct formation slots; their timings are demonstrations, not controlled algorithm benchmarks.
- Spatial progress is a projection onto the original group plan; after combat replanning or a large detour it can decrease. It does not drive movement. Individual waypoint counts include connectors and arrival slots.
- Nearest-distance and spread metrics are sampled, not continuous extrema. Search times vary with browser load. Final steering is acceleration, while colored terms are weighted contributions to desired direction; they have different units.
- Demo presets are intentionally available only before battle. Turning off Algorithm View hides inspection, but an already-running swarm demo remains a no-combat demo until Return to preparation.
- The castle test covers the defensive wall opening and approach, not passage through the solid keep footprint. Narrow panels require sidebar scrolling; a wider browser is preferable for a lecture.
- Recommended next phase: user-placeable comparison endpoints, isolated search replay with frontier history, and exportable repeated-run measurements with controlled seeds and hardware metadata.
