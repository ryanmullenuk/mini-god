# Tide: smaller followers, temples and slaughterhouses

## What to play

Followers and their carried items are now exactly 50% of their former visual scale. Terrain, buildings, camera and travel speed retain their dimensions; the one-layer climbing and walking-clearance rules remain intact.

Open **Your village** and choose:

- **Temple (8): 18 wood.** Followers gather supplies and construct a columned temple with a teal roof. Housed, fed followers visit between other duties, worship for four simulation seconds and leave up to two faith. Each follower waits at least 90 simulation seconds between visits. A temple holds 50 faith. **Collect temple offerings** transfers available whole faith points to your balance, capped at 500, leaving excess offerings in the temple. A floating gold offering rises when collected.
- **Slaughter house (9): 12 wood.** A small barn and pen start with two sheep when construction finishes. These form a protected breeding pair. Provided there is a camp route and surplus food above three per follower, four stored food pays for a 90-second rearing cycle. The pen holds at most four sheep. A follower processes one surplus animal in eight seconds, carries ten food and delivers it to camp. Nothing enters village food storage before delivery. Existing farming, cargo and navigation systems remain in use.

Both buildings use the existing flat 2×2 plot assessment and construction reservations. They block walking through their footprint and check planned entrances and routes before funding. Construction takes 48 worker-seconds for a temple and 36 for a slaughterhouse. They are player-directed options; autonomous hut/farm expansion remains unchanged.

## Divine influence and targeted blessings

**Influence** displays the reach of the camp and completed, valid temples. The camp begins at radius 18, increasing by one unit per sheltered follower up to an eight-unit bonus. Temples add their own influence circles with the same base and bonus; tier 2 adds six more units to temple radius.

Rain and New growth now select a target on the island before spending faith. The preview shows the affected radius, eligible field count and cost. The whole blessing must fit inside one influence circle. Rain costs eight faith and waters farms inside the selected patch for 18 seconds. Growth costs twelve faith and enriches crops, soil and resource stocks only in the selected patch. Natural showers still water the island. Tier 1 blessing radius is six; tier 2 radius is eight.

Paused worlds can plan buildings, but cannot cast paid blessings. Escape, tool changes, pointer cancellation, a second finger and release over UI preserve the existing placement protections.

Two completed usable huts, a delivered harvest and a completed usable temple unlock **village tier 2**, permanently widening temple influence and blessings. This is the first progression milestone, not a full technology tree.

## Save compatibility and limits

Save format 5 accepts formats 1–4. It persists temple offerings, worship cooldowns, livestock, paid rearing progress, processing counts, targeted rain and the village tier alongside existing jobs, cargo and guidance. Validation rejects unknown buildings, mismatched jobs, invalid livestock, out-of-range offerings and malformed rain areas.

Livestock are an abstract pen simulation: feed is allocated from camp storage when rearing begins, just as building wood is allocated when construction starts. This does not yet add separate feed-hauling jobs, free-ranging herds, pasture ecology, carcass storage or spoilage. Food consumed includes both meals and allocated feed. Breeding never consumes the last two sheep. Work and breeding pause on damaged ground and resume after restoration.

## Verification

52 automated checks pass across terrain, terraces, settlement, guidance, beacons and this phase. New checks exercise construction and solid footprints, real worship and collection, feed/food conservation, meat delivery, breeding-pair protection, targeted effects and influence rejection, tier unlock, saved continuation, malformed imports, old-save migration, exact half-scale followers and finite scene geometry. Type checking, source lint and production build are required release gates.

Browser access failed with `cgWindowNotFound`; the current temple/slaughterhouse visuals, paid placement and touch interaction have not received a hands-on playthrough. The prior release's browser smoke check only verified loading and inviting followers.
