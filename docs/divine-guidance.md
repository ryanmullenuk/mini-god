# Tide: divine building guidance

Followers can now be directed to build huts and farms at sites chosen by the player. This extends the existing settlement simulation, sculpting, navigation and rendering.

## Play

1. Invite islanders and open **Your village**.
2. Choose **Guide hut** or **Guide farm**. Guidance is free; the hut needs 6 wood and the farm needs 3 wood.
3. Point at a site. Green means it is suitable; red explains the problem, such as uneven ground, poor soil, another building or a blocked route. Click or tap to leave the request. On touch, the village panel folds after choosing a guidance power to leave room for placement.
4. Followers gather and deliver supplies, step aside if necessary, then build at the marked site. The completed farm uses the existing planting, rain, harvest and food-delivery loop.
5. **Your guidance** shows waiting reasons and construction progress. Select a request to focus its site. Withdraw an unfunded request with its cross button; no supplies have been spent. Choose **Done**, another tool or Escape to finish placing requests. Keyboard 5 selects huts and 6 selects farms.

Up to eight requests can wait at once. Terrain still needs a broad, flat footprint and a route using the existing one-layer steps. The player can plan while paused; work resumes with the simulation. Hungry followers still forage and carried supplies still return to camp before new work.

## Construction rules

Pending requests reserve space without blocking walking or spending wood. They take priority over automatic expansion. Before spending supplies, the simulation checks the site again and confirms that it remains reachable after planned huts become solid obstacles. Neighbouring entrances must remain clear. A follower on the footprint walks aside using normal navigation before construction can start.

Funded requests become ordinary construction plots with the same stable ID. A hut costs 6 wood once and a farm costs 3 wood once. New hut obstacles replan active routes. Guided construction takes priority when followers choose new building work. Completed buildings and farms retain the original shelter and food behaviour.

Sculpted-away requests wait without consuming wood and resume when suitable terrain and access are restored. Started buildings use the existing terrain-damage rules. Cancelling applies to unstarted requests; it does not remove an already funded building or rewind the economy. Terrain undo remains separate from guidance.

## Saves and verification

Save format 3 persists pending requests, guided construction and movement to clear building sites. Existing format 1 and 2 saves are accepted, with no pending guidance by default. The storage key and previous-island recovery remain unchanged. Import validation checks limits, positions, kinds, unique IDs, job references and material claims.

34 automated tests pass: 8 terrain metadata, 8 settlement, 8 terrace and 10 guidance checks. New tests cover choosing sites, zero-wood gathering through harvest delivery, priority over automatic expansion, construction costs, blocked entrances, conflicting pending layouts, stepping aside, withdrawal/marker disposal, terrain damage/restoration, save continuation and malformed imports. TypeScript, lint on game/UI/tests, and production build pass. Dependency versions are unchanged.

Computer Use could not access Safari (`cgWindowNotFound`), so the current release has not received a hands-on browser or touch playthrough. Placement gesture branches were reviewed for pointer cancellation, second-finger cancellation, Escape, tool changes and release over UI; this is not a substitute for an end-to-end browser input test.
