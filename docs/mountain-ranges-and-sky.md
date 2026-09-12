# Mountain ranges and a livelier sky

The archipelago now supports 32 elevation bands. The original 20 heights remain unchanged; 12 upper bands continue in 0.28-unit steps, reaching 7.10 world units. Upper terraces transition from upland earth and muted vegetation to grey rock and pale summits. Sculpting still changes only one layer per stroke and islanders still need single-layer steps.

Mainland highlands use overlapping, offset ridges with irregular shoulders. Larger outer islands have their own ridges. Beaches, low meadows, ocean shelves and pools retain their original generated heights.

Save format 13 upgrades untouched terrain from earlier formats. It protects camps, building sites, followers, routes, food-system locations and sculpted samples, including a buffer around edits. The old 20-layer generator remains available for identifying unchanged land. The existing world state is preserved and a pre-upgrade device backup is attempted before the upgraded terrain is saved. Saved format 13 terrain is never regenerated on reload.

Cloud cover increases from 30 to 50 banks: 20 opaque, 16 translucent and 14 wispy banks, rendered with instancing. Seagulls increase from 48 to 72 across six flocks of 7, 13, 9, 16, 11 and 16 birds. Each flock has its own speed and changing random destination, with gradual turning and varied wingbeats. These routes are ambient visuals, not saved simulation jobs.

Seagulls and black birds react to the pointer's camera ray at their actual flight altitude. They smoothly move away and return toward their flock as the pointer leaves. Seagull leaders also steer away from nearby pointer positions. The ray updates with camera movement and clears when the pointer leaves the canvas. Pause freezes birds and clouds.

Verification: all 96 existing checks passed, plus three added checks for highland coverage and upper-layer sculpting, protected migration without repeated generation, and bird avoidance and destination changes. Type checking and focused lint passed. No browser visual testing was performed.
