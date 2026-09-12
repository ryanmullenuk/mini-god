# Tide: divine beacon and readable village life

This phase extends the existing terrain, navigation, settlement and rendering systems. No dependencies or terrain rules changed.

## Play

- Open **Your village → Gather followers** (keyboard **7**), then click or tap dry ground. Up to six nearby available followers walk to the light, gather for five simulation seconds, and resume village work.
- Builders, planters, harvesters, followers clearing sites, and supply carriers are not interrupted. Hunger prevents gatherings. A beacon expires after 90 simulation seconds, pauses with the world, can be replaced, and can be dismissed immediately.
- An unreachable beacon remains visible. Followers cannot cross multi-layer cliffs; create single-layer steps before it expires. Blocked followers can work elsewhere and retry when choosing their next job. The gathering destinations use the same walking clearance as every other journey.
- **Guide hut** and **Guide farm** retain their existing costs and reservation rules. Construction now shows foundations, posts, rising walls, a roof, and a diminishing stack of allocated supplies. Wood is still gathered and delivered to camp, then allocated once to the site; this does not introduce a separate building-delivery economy.
- **Your guidance** distinguishes walking to build, building progress, no available builder, missing access and damaged foundations.
- Expand **Huts & fields** to inspect every building, focus it on the island, see shelter allocation by follower name, or inspect crop growth, moisture and harvest count.
- New completed farms choose an available farmer automatically. Use the field's **Farmer** selector to reassign that role or choose **Any available follower**. One follower can be assigned to one field. Farmers complete other duties, deliver cargo and address hunger before choosing field work. Other followers can help if the designated farmer is stranded or cannot reach the field. Assignment does not create duplicate crop or material claims.
- The faith message explains whether shelter or food is missing, how much faith a cared-for village produces per minute, or whether faith is full. Existing prayers, rain, growth and faith rules remain in effect.

## Persistence

Save format 4 stores the active beacon, individual gathering destinations, phases, expiry and farmer assignments. Formats 1–3 remain supported. Import validation checks beacon identity, membership, positions, job consistency, timer bounds and unique farmer assignments. Terrain, supplies, cargo and crops retain their existing migration behavior. Save storage remains local to the device.

Shelter names are a deterministic allocation of existing four-person hut capacity; this phase does not add family simulation or daily home visits. Farmer assignments are preferences within the existing autonomous job system, not a new profession or experience progression system.

## Verification

Automated coverage includes actual beacon movement, pause, protected jobs/cargo, hunger, cancellation, replacement, blocked cliffs, terrain restoration, expiry, saved continuation, malformed saves, farmer reassignment, scene geometry and the guided two-hut-and-farm milestone through harvested food and earned faith. Existing terrain, terrace, settlement and building-guidance regressions remain required.

Browser smoke check: the local game loaded in Safari and inviting two settlers displayed the new village controls and gathering button. Browser interaction was repeatedly interrupted by active-page changes in Safari and Chrome. Full placement, visual construction and touch playthroughs remain unverified; automated simulation and geometry checks do not replace them.

## Next validation

1. Place and dismiss a beacon using mouse and touch; verify Escape, second-finger cancellation and releasing over UI.
2. Shape a real staircase while a beacon is blocked; observe followers taking it.
3. Watch the full two-hut-and-farm construction loop at normal speed, check scene readability and choose a farmer.
4. Reload an existing saved village and an active gathering; inspect narrow-screen controls and performance at 30 followers.
