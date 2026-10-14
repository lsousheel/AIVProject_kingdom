# Blue King cinematic briefing

## Delivered

Five scenes appear on every fresh load: the mission, A* and Boids, the three troop classes, strategy/controls, and the king's final order. Every scene has Skip; scenes 1–4 have Next and scene 5 has Begin the Siege. Progress is shown as a count and five dots.

The final image is the user's **King Overlooking the Fortress.png**, copied unchanged to `public/assets/blue-king.png` and loaded through `/assets/blue-king.png`. CSS `object-fit: cover` applies a reversible crop around the king, crown and lion cloak. It is not regenerated or stretched. Desktop dedicates 42% of the opening to the image. Phone widths stack it above the content, retaining more of the landscape composition.

## Architecture and files

Created:
- `public/assets/blue-king.png` — supplied artwork.
- `src/intro/IntroContent.js` — five scenes and troop content derived from `UNIT_TYPES`, `PATH_PROFILES` and `CONFIG.maxPlayerUnits`.
- `src/intro/IntroSequence.js` — page navigation, Skip/Begin, replay, modal input isolation, focus management and lifecycle.
- `src/intro/IntroCameraTransition.js` — small cubic-eased transition using the existing RTS camera.
- `src/intro/intro.css` — responsive portrait crop, typography, gradients, fades and reduced-motion behavior.
- `tests/intro.test.js` — scene/config and camera transition tests.
- `docs/ROYAL_BRIEFING.md` — this report.
- `docs/briefing-king.jpg`, `docs/briefing-pillars.jpg` — verified opening screenshots.

Modified: `src/main.js` to instantiate the intro, gate simulation/camera input during it, and temporarily use the full canvas for the reveal; `README.md` to link this guide. A*, Boids, combat, deployment, scenery, inspector, unit selection and RTS camera implementation files were not changed in this phase.

## Content and interaction

- The academic screen explicitly names **Pathfinding & Navigation / A* global planning** and **Swarm & Boids Modeling / local movement**. A small route diagram bends around an obstacle. The emphasized message is “A* decides WHERE the army goes. Boids decides HOW it moves there.”
- Warrior, Berserker and Guard descriptions use the existing balanced/aggressive/safe profiles. HP, ATK, DEF and SPD read current configuration, rather than duplicated constants.
- Controls explain automatic formation display, optional Reposition, Start War, class selection, right-click movement, left-drag reference sketches, WASD, scroll and 1/2/3. The tutorial correctly describes defeating the Red army as the win condition.
- Skip and Begin share one four-second transition: text fades, portrait fades, the dark overlay dissolves, and a high aerial camera eases toward the preparation overview. The existing Three.js scene stays alive; it is not disposed or recreated.
- Gameplay UI/canvas are inert during the intro. Simulation updates are suspended without altering the game's pause flag. Keyboard gameplay shortcuts cannot issue hidden commands.
- **Replay briefing** is in the top toolbar. In preparation, it returns to the overview. During battle/demo, it preserves the current game and restores the previous camera target/zoom instead of resetting units or phase.
- Reduced-motion users get a short 0.3-second handoff without decorative animation.

## Verification

- Full automated suite: **45 passed, zero failures**, including all previous navigation, class isolation, bottleneck, combat, demo and comparison checks.
- New tests verify five scenes, academic labels, dynamic troop statistics, eased camera movement, exact preparation endpoint and replay camera restoration.
- Live browser checks: initial scene; Next through all five scenes; Skip from scenes 1 and 4; Begin the Siege; troop placement and Start War after the transition; replay during battle.
- Desktop portrait inspected at the app's normal size. At a 390×844 test viewport, the portrait stacks above content, the long troop page scrolls, and the 44px Next/Skip controls remain within the viewport. Temporary viewport override was removed.
- Final production build passes: JavaScript about 639.5 kB / 168.0 kB gzip; CSS about 17.0 kB / 4.9 kB gzip. The existing >500 kB JavaScript advisory remains non-blocking.

## Limitations

The supplied PNG is retained at its original quality, adding its full transfer size on first load. No music or narration was added. The desktop crop prioritizes the king, so much of the distant fortress is outside that narrow portrait frame; smaller stacked layouts show more of the original scene. Long scenes scroll on short displays. The tutorial intentionally reappears on fresh loads and has no localStorage dismissal state. Replay returns to an existing battle rather than destroying it to force Preparation.

Backup before this phase: `before-royal-briefing-2026-10-12.zip`.
