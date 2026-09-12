# Animal proportions, flocks and herds

Huts render at 70% of their previous size, including their placement preview and staged construction. Existing foundations, saved building positions and four-person capacity are retained. Wild adult pigs render at 80%, chickens at 55%, and both ambient and managed fish at 40% of their former size. Pen animals and carried animals have been adjusted to match the smaller islanders. These are visual sizes, not changes to food yields.

New wildlife starts in chicken flocks of four and pig herds of three. Groups follow a shared leader using the same dry-ground navigation and single-layer steps as before. Existing animals keep their positions and gradually regroup; no teleportation is used. Each initial pig herd contains a smaller piglet. Piglets grow over 180 simulation seconds. Born piglets are represented in the pen's real stock and follow the moving adult herd inside the enclosure. Young stock is held back from slaughter until mature; the breeding pair remains protected.

Assign a chicken-coop keeper through Food & wildlife. On reaching a chicken, the keeper gathers nearby, reachable chickens into a flock limited by remaining coop space. All flock members are reserved to that keeper. The keeper leads them on foot and waits for stragglers. Chickens remain visible and counted as wild until each reaches the coop entrance. Then that individual moves into the coop stock, without adding food or creating a duplicate. Terrain changes or cancelled routes release the remaining birds. Existing carried chicken saves still complete their delivery.

Sheep have been replaced with horned, bearded goats throughout the current scene and interface. Existing livestock counts, feed cycles and food delivery remain in place, using the compatible saved livestock field.

Save format 8 preserves in-progress flock reservations, wild piglet ages and pen juvenile ages. Earlier saves upgrade without resetting the island. Balance and visual scales are grouped in food-balance.ts.

Validation includes herd spacing and maturation, multi-bird herding with capacity reservations, mid-herd save continuation, releasing a cancelled flock, unchanged population counts, hut scale and goat anatomy, alongside all existing gameplay checks. Hands-on browser visual and performance testing was not requested or performed.
