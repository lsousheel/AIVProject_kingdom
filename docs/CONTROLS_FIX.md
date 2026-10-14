# Deployment and battle control fixes — October 11, 2026

Reference-path correction: the sketch is now a soft distance penalty in one class-profile A* search to the final destination. Intermediate samples are not mandatory stops. This removes concatenated-route backtracking and permits skipping unnecessary bends and loops. Normal Boids lookahead and steering are restored. For sketch orders, each soldier joins the nearest visible portion of the group route instead of returning to its anchor. Tests verify reference-side preference around a wall, no repeated route cells even with looping strokes, arrival, obstacle avoidance and class isolation. All 32 tests and the build pass. The sequential guidance-point implementation described below is superseded.

Latest behavior: choosing troops or formation immediately displays the army, so Deploy is no longer required. Start War holds position until an order. Select a class and left-drag to sketch route guidance. Class-profile A* connects spaced reachable guidance points and finds detours around blocked samples; it does not reject a sketch merely because it crosses obstacles. Obstructed endpoints use the nearest reachable ground in the starting component. The inspector shows actual search costs, explored nodes, terrain and crossings. Single clicks retain automatic destination routing; Reposition remains optional.

## Later update: manual placement and orders restored

At the user's request, Deploy now arms placement: click inside the Blue staging area to place the chosen formation. Start War enables combat but issues no automatic route. Soldiers hold their chosen positions until a group receives a ground-click destination or the optional Advance to the keep order. The field status explicitly shows placement instructions and awaiting orders. All 27 tests and the production build pass, including holding a custom formation after Start War and fighting after a player-issued order. The earlier automatic-flow record below is historical and superseded by this update.

The previous UI required an undisclosed second deployment click and a separate attack order after Start War. Combat could immediately override a class movement order. The troop-card callback also ignored DEMONSTRATION despite displaying selection controls there.

## Changed behavior

- Deploy places the chosen army immediately at the valid staging center and focuses the camera. Reposition still supports custom valid staging clicks.
- Start War atomically plans all three groups and launches their attack. Red retains defensive behavior and responds when the attacking army approaches; the default battle resolves without another command.
- Cards and keys 1/2/3 select/focus Warrior, Berserker and Guard in battles and demos. Left or right clicks on clear ground move only selected units; clicking empty ground no longer silently deselects them. Escape deselects.
- A manual move clears the selected units' combat target and overrides pursuit until arrival. They remain vulnerable to damage. Advance to the keep is an explicit attack-move order.
- Battle view focuses the fight involving selected troops, or a nearby active fight, instead of centering between distant battles. Persistent battlefield status distinguishes preparation, marching, fighting, pause and no-combat demonstrations.
- Attacks now visibly swing weapons and show amber combat rings and health bars.

## Validation

All **24 tests passed**. Added tests prove that Deploy + Start War alone causes Red reactions, damage and an outcome, and that a selected class can disengage without changing another class's route, then resume combat on arrival. Existing river, A*, Boids, deployment, lab, combat and lifecycle tests pass.

Production build passed (608.36 kB JavaScript / 157.29 kB gzip); the existing bundle-size advisory remains. Browser checks verified immediate 30-unit placement, automatic attack, casualties, Guard-only ground orders, keyboard selection, demo card selection and Battle view. Warrior/Berserker route metrics stayed unchanged when Guards were redirected.

Modified: `src/main.js`, `src/ui/UIManager.js`, `src/style.css`, `src/systems/Game.js`, `src/systems/CombatSystem.js`, `src/units/Army.js`, `src/units/Soldier.js`, `tests/gameplay.test.js`, `README.md`. Added `tests/controls.test.js`. Source backup: `before-control-fixes-2026-10-11.zip`.

A move order intentionally suppresses attacking until arrival; use Advance to the keep to restore attack-move sooner. Demo modes intentionally have no combat. A defensive Red army does not charge across the whole map at battle start.

