# Loose flocks and ocean visitors

The 72 gulls now form five loose clusters of 10, 12, 9, 15 and 16 birds plus ten independent solo travellers. Irregular offsets replace the V formation. Birds maintain their own flight positions and headings, turn toward escape directions near the cursor, continue outward briefly, then steer back toward their moving flock once clear. Black birds use the same flight-based avoidance. Neither group snaps sideways and back to a formation slot.

Two ambient whale slots and five dolphin slots create occasional ocean visits, each with independent random locations and cooldowns. Whales rise slowly, show a brief blow spray, and submerge. Dolphins breach along a pitched arc with splash rings. Events validate their whole travel corridor against ocean-connected water, depth and shore clearance. Active visitors disappear if sculpting removes safe water. The existing ocean distance field is shared, avoiding another terrain-wide shoreline calculation.

These are scenery, not catchable food animals. They do not alter fish stocks, village jobs or saved resources, and need no save-format change. Pausing freezes visits and birds. Their meshes and materials are disposed with the game.

Validation: 28 targeted tests passed for terrain, sky, migration, forward flight and regrouping, surfacing and breaching, pause, new land and enclosed pools. Type checking and focused code lint passed. Browser visual testing was not performed.
