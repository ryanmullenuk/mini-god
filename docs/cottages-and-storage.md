# Cottages and village storage

This release adds hut upgrades, two storage buildings, construction deliveries and an expanded building inspector. It preserves the existing terrain, ocean, daylight, animal economy and smaller villagers.

## Playing

Open the village panel. Granary and Storehouse are now available beside the other building guidance buttons. Choose a flat, reachable site. Open **Village buildings** to focus a building and inspect its work, residents, supplies and progress. A completed hut offers **Upgrade to cottage** when 12 wood and a safe route from camp are available.

| Addition | Wood | Work after delivery | Benefit |
| --- | ---: | ---: | --- |
| Cottage upgrade | 12 | 45 seconds | Shelter increases from four to six |
| Granary | 12 | 36 seconds | Adds 240 food storage and a food delivery point |
| Storehouse | 10 | 32 seconds | Adds 120 wood storage and a wood delivery point |

All times use simulation seconds and follow pause/speed controls. Cottages retain their original small footprint and keep residents sheltered during work. Cottage details add windows, a chimney and an entrance step. Granaries use warm roofs and grain sacks; storehouses use green roofs and timber stacks.

## Materials and delivery

A funded construction site reserves its wood from shared storage. Followers collect that reserved wood at camp, carry up to three pieces per trip, and deposit it at the site's entrance. Hammer construction begins only when every piece has arrived. Existing kneeling and hammer motions also apply to upgrades. Reservations, cargo and delivered site materials are separate; the same wood cannot be spent twice.

Food and timber deliveries choose the nearest reachable suitable depot or camp. Storage remains one shared village inventory: a granary's displayed count is the shared food total, not an additional inventory. The camp begins with 240 food capacity and 120 wood capacity. Completed, valid storage buildings add to those limits. Delivery checks free capacity at arrival, including when multiple followers arrive together. Excess remains in the follower's hands. Removing a building's valid foundation reduces capacity but never deletes previously stored supplies.

This stage does not introduce distribution between independent warehouses. Feed, crafting and village consumption continue using the existing shared inventory. Reserved construction wood is collected at camp even if it originally entered through a storehouse.

## Saves and balance

Save format 12 accepts formats 1–11. Older paid construction is treated as already supplied, preserving its progress and avoiding a second charge. No terrain migration runs for format 11 saves. New saves validate construction reservations plus carried and delivered wood as one conserved total. Cottage level, upgrade progress and interrupted cargo survive restoration. Storage capacity is derived from saved buildings, preventing a second capacity grant on load.

Building costs and construction times remain in BUILD_COST / BUILD_TIME in lib/game/world-state.ts. VILLAGE_BALANCE beside them holds cottage capacity, cost, work time, carrier load and storage capacities.

## Verification

All 96 automated checks passed across terrain metadata, terraces, settlement, guidance, beacons, temples, animals, archipelago/daylight, food and the eight new building checks. These include physical delivery, capacity limits, simultaneous arrivals, rejected upgrades, construction cargo after terrain changes, save conservation, legacy paid construction and finite building geometry. Type checking and focused game-code lint passed. Browser visual testing was not performed.
