# Broad mainland and compact controls

The fresh world now has a broad central island and three smaller offshore islands, with no generated sand links or minor rock keys. Existing terrain resolution, single-layer climbing and local sculpt meshing are retained.

Compared with the previous fresh world, the central footprint has 66,228 dry samples versus 51,859 (+28%), and 56,683 low grass samples versus 33,383 (+70%). Terrain mesh vertices fall from 1,307,406 to 753,462 (42% fewer); this is a geometry reduction, not a measured frame-rate guarantee.

Save format 16 migrates untouched terrain while protecting inhabited areas, sculpted cells, existing jobs, animals and resources. Consequently an established save may retain pieces of its previous island layout. Historical generators remain available for migration comparisons.

Village controls now collapse to three icons and a resource strip. Only the selected village, building or food panel opens. Building management expands per building, and food management expands by species or fishing/hunting. Hints, placement guidance and event feedback share a strip directly above the bottom toolbar.

Validation: 112 automated checks pass, including mainland size and geometry budgets, four disconnected land components, save migration and idempotence, settlement, navigation, food and terrain regressions. TypeScript and production build pass. Browser review verified first settlement placement, the building icon grid, food categories, fishing details and bottom guidance at a narrow viewport.
