# Enemy movement stability — October 11, 2026

Defender group orders previously restarted every four seconds, even for the same stationary target. Each group order reconnects soldiers through a shared anchor, creating unnecessary regrouping. Individual combat paths also restarted every 1.2 seconds, and a momentary loss of line of sight immediately restored an older marching order.

- Defenders retain their current target and group route until the target moves at least four world units, dies, or leaves the defended area.
- Pursuit paths retain progress while the target is stationary. Moving targets still trigger bounded replanning.
- New pursuit paths skip the rounded start-cell center only when the next segment is clear, and include the exact destination to avoid stopping just outside attack range.
- A 0.6-second line-of-sight grace prevents rapid switching around corners. Damage still requires clear sight, and unseen targets do not receive fresh pursuit paths.
- Returning groups compare their position to their actual defensive center.

Validation: 27 tests pass, including three movement regressions, obstacle collision checks, class movement overrides, complete battles, and a winning southern flank scenario. Production build passes; the existing bundle-size advisory remains. Live browser check showed responding defenders, active combat and casualties without console errors. Unit stats, class A* profiles and Boids weights are unchanged.
