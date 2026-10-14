Visual polish verified October 12, 2026: 32 tests pass; build passes. See [Visual polish delivery](VISUAL_POLISH.md) for changed files, screenshots, navigation preservation and performance measurements.

Current verification (October 11, 2026): **32 tests pass**, production build passes. Troop/formation selection now displays soldiers immediately without Deploy. Left-drag draws a route for the selected class; A* uses the sketch as guidance, detours around obstacles and reaches the destination or nearest reachable ground. New tests cover automatic formation display, soft reference routing without mandatory bends or repeated cells, class isolation, wall detours, river crossings, and endpoint adjustment. See [Enemy movement stability](ENEMY_MOVEMENT.md) and [Deployment and battle control fixes](CONTROLS_FIX.md) for earlier changes. The report below records the October 4 environment baseline.

# Battlefield environment phase — validation and change record

Verified October 4, 2026. This phase extends the existing Three.js/Vite project. Custom A*, class profiles, Boids, roster/deployment, combat, camera and defensive AI are preserved. The previous complete source/configuration is saved in `baseline-environment-backup.zip`.

## Checks

- `npm test`: **22 passed, 0 failed**.
- `npm run build`: passed; JavaScript 605.43 kB / 156.45 kB gzip. The existing Three.js chunk-size advisory remains non-blocking.
- River cells are blocked except for three configured crossings. A test closes the wooden bridge and proves Aggressive A* finds another crossing.
- Discounted-road A* matches a Dijkstra reference cost and can prefer a longer physical route. Its heuristic now includes the minimum traversal multiplier.
- Both mixed armies complete routes across the new map in opposite directions without stepping into blocked cells.
- Twenty agents complete successive orders; invalid water targets preserve existing routes.
- Every class retains its local steering weights and independent orders.
- Both swarm labs complete with all 24 agents, no damage, fixed Red defenders, pause support and restored player preparation.
- Deployment limits, unit data, defensive placement, cooldown/defense, death, reset and full battles pass.
- The default mixed attack test terminates in defeat at approximately 110.4 simulated seconds. Thirty Berserkers deployed at (-38, 12) and ordered to (42, 25) win through the southern approach. Balance and timing matter; direct attacks are not guaranteed to win.

## Same-endpoint comparison

Start (-38, 0), destination (38, 4), identical occupancy and terrain.

| Profile | Physical distance | Estimated cost | Expanded events | Actual path crossing |
| --- | ---: | ---: | ---: | --- |
| Warrior / Balanced | 97.9 | 80.6 | 881 | Stone Bridge |
| Berserker / Aggressive | 77.7 | 77.3 | 51 | Wooden Bridge |
| Guard / Safe | 124.6 | 158.0 | 3,901 | Southern Ford |

The labels come from crossing metadata on cells in the returned path. No class is assigned a bridge. Roads can make cost smaller than distance; costs also use different profile objectives and are not directly interchangeable measures of quality. Aggressive uses weighted A* without an optimal-cost guarantee. Safe means clearance from obstacles, not protection from enemy fire.

## Swarm observations

The fixed bridge lab begins with a 6.8-unit lateral spread. Its measured maximum spread among agents inside the central bridge section is about 2.40; final arrival spread is about 7.22. Minimum measured body spacing is 0.758, against a nominal diameter of 0.76. All 24 arrive. These measurements are asserted in the automated test, with tolerances for the local solver.

Each agent advances its own waypoints. No fast leader can skip the group's route. Line-of-sight neighbor filtering, route lookahead, obstacle probing, bounded repair searches, velocity validation and positional-separation validation prevent social steering from crossing water or walls. This remains a local steering solver, not a rigid formation or physics engine.

## Browser verification

At 1280 x 720:

- Viewed the river, both bridge decks/rails, ford, forest trail, ruined village, outer defenses, continuous terrain and Red keep.
- Compared route ribbons and table metrics; inspected detected crossings and terrain types.
- Checked the budget/formation controls, rejected a water deployment, and placed a valid army in staging.
- Launched both swarm labs and inspected a selected soldier's radius, vectors, numerical strengths and waypoint cursor.
- Checked pause and class selection in the lab.
- Observed the village lab reach 24/24 arrived, returned to the original 30-unit Wide ranks preparation, then started a normal battle with all three real crossing routes and visible casualties.
- Selected a soldier on the crowded bridge and read all four weighted strengths (separation 4.22, cohesion 0.01, alignment 0.16, target 2.53) while paused.
- Fresh runtime console checks reported no errors or warnings.

Screenshots are saved alongside this report. The automated tests provide frame-by-frame occupancy and spacing assertions that are not possible to establish from screenshots alone.

## Performance

- Static region geometry is batched by material. Distant mountains, foliage and rocks use InstancedMesh.
- Environment construction contains **45 mesh objects and about 23,566 triangles**, excluding units/debug overlays. Before peripheral instancing there were 150 mesh objects for the same triangle count.
- Local warm search medians over 12 runs: Balanced 8.91 ms, Aggressive 0.26 ms, Safe 27.85 ms.
- One full three-group command measured 32.90 ms.
- Over 60 simulated seconds starting with 30 Blue + 34 Red, CPU-only update median was 0.129 ms, 95th percentile 0.732 ms, maximum 52.43 ms. The maximum includes scheduled search work. These numbers exclude browser rendering and vary across machines.
- Browser spot checks showed about 43–46 FPS in active lab views and 62–75 in lighter/paused views while another app tab was present. This is not a sustained frame-rate guarantee.
- No pathfinding runs every frame by design: searches occur on commands, timed enemy/combat decisions and obstructed-route repair; repair attempts are throttled to once per 0.5 seconds per agent.

## Files created

- `src/world/layout.js`: shared region/obstacle/crossing/road definitions, terrain multipliers and containment rules.
- `src/world/Regions.js`: water/crossings, procedural ruins, ambient effects and scenery batching.
- `tests/environment.test.js`: five environmental navigation, swarm and construction tests.
- `baseline-environment-backup.zip`: previous working source/configuration.
- `docs/environment-preview.jpg`, `docs/swarm-lab-preview.jpg`: browser previews.

## Files modified

- `src/config.js`: environment-derived footprints/zones, Balanced clearance tuning and southern defender position.
- `src/world/Terrain.js`: continuous river valley, instanced peripheral scenery and distant peaks.
- `src/world/Battlefield.js`: region construction, shared-footprint rendering and static batching.
- `src/navigation/Grid.js`: terrain types, road/crossing costs, crossing metadata and minimum terrain value.
- `src/navigation/AStar.js`: discounted-cost heuristic lower bound and actual-path terrain/crossing summaries.
- `src/navigation/DebugVisualizer.js`: high-contrast route ribbons.
- `src/systems/BoidsSystem.js`: throttled obstructed-route repair; existing collision-safe movement retained.
- `src/units/Army.js`: reset repair cooldowns when orders/reset occur.
- `src/systems/Game.js`: reversible bridge/village labs with disabled combat.
- `src/ui/UIManager.js`, `src/style.css`: comparison table, cost/crossing/terrain/waypoint metrics, numerical force strengths and lab controls.
- `src/main.js`: lab actions/camera and ambient animation.
- `tests/navigation.test.js`, `tests/gameplay.test.js`, `tests/profiles.test.js`: assertions updated for real river crossings, discounted cost and a viable flank strategy.
- `README.md`, `docs/VALIDATION.md`: current behavior, tuning, limitations and verification.
- `dist/`: regenerated production build.

No dependencies were added. Existing combat logic, soldier architecture and deployment validation were not replaced.

## Limitations and recommended next work

Navigation is planar and conservatively rasterized; bridge decks are almost flush with the surface. Forest/road/mud costs influence planning rather than physical movement speed. Clearance is approximate distance to blocked-cell centers. Global group lines omit individual connector, repair and pursuit routes. Overlays are optional and local forces may be overridden by collision/arrival recovery. Survivors separated by walls can require another order. The castle is a visual objective; elimination determines victory.

The next useful improvements are a cost/clearance heatmap, editable profile controls with repeatable benchmarks, a priority-queue A* frontier to reduce search spikes, broader GPU profiling and battle balance. Dynamic destruction, elevation-aware movement and threat-aware routing are outside this phase.

