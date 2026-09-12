# Tide: kneeling builders and free-roaming animals

## Construction

When a follower reaches a construction site, they face the building, smoothly lower onto one knee and swing a visible wood-handled hammer. Their other arm braces in front. The pose uses the existing articulated hips, knees, ankles, shoulders and elbows, retaining the half-size follower scale.

Hammer motion only runs during an actual stationary build job. Walking, farming, worshipping and deliveries keep their own poses. Completing or cancelling construction hides the hammer and blends the follower back to standing. Pausing freezes the swing; cancelling a job while paused hides its tool. Construction rates, costs, reservations and saves are unchanged.

## Island animals

Six pigs and twelve chickens roam independently across the island, including before settlers arrive. Pigs have pink low-poly bodies, snouts, ears and curled tails; chickens have white or brown feathers, combs and yellow beaks. Legs animate when walking. Idle pigs root and chickens peck.

Animals choose nearby wander targets and validate the complete segment and each movement using the existing dry-land and single-layer-step navigation. They avoid valid buildings and crop fields. If terrain or a new building invalidates their position, they recover to nearby safe ground; when none exists they hide and retry locally until land is restored. They do not walk through water or tall cliffs. Pause and village speed controls apply to them.

These are ambient wildlife, separate from the slaughterhouse sheep, feed and food economy. They cannot yet be selected, captured, fed or slaughtered and chickens do not yet produce eggs. Like existing fish and birds, their roaming positions regenerate on reload/import/new-island rather than being added to the simulation save. The animal count is bounded at eighteen, and all geometry and materials are disposed when the island is replaced or closed.

## Verification

New checks exercise real construction arrival and facing, kneeling joints, changing hammer swings, pause and cancellation, non-construction jobs, animal counts, extended dry-land wandering, obstacle avoidance, submerged-terrain recovery and geometry disposal. Existing game regression suites, type checking, source lint and a production build remain release gates.

The local route responds successfully, but browser access again returned `cgWindowNotFound`. Hands-on visual and touch verification remains outstanding; simulation and pose checks are not a substitute for seeing the scene in play.
