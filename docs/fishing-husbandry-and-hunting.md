# Fishing, husbandry and Hunting

## Food and delivery

Fish yield 3 food, chickens 5 and pigs 10. Fish and hunted pigs become carried food; live chickens and trapped pigs are carried to their destination pens. Surplus livestock is physically carried to a slaughterhouse, processed there, and then carried as food to camp. Existing camp delivery is the only operation adding catch food to storage. Interrupted deliveries retain their cargo, including across terrain edits and saves. Existing sheep breeding and processing remain intact.

## Player controls

Open **Food & wildlife** in the village panel. Mark a fishing area on reachable dry shoreline, then assign a fisher. Each distinct water area begins with 12 fish, takes 8 seconds per catch and recovers one fish every 45 seconds, even from zero. Areas cannot overlap or be deleted to manufacture replenished stock. Visible managed fish track actual stocks; ambient fish in that area are suppressed. Up to eight areas are supported.

Guide a chicken coop (6 wood, 20 construction seconds) or pig pen (9 wood, 28 seconds). Assign one keeper per pen. Keepers catch roaming chickens or collect pigs from traps. Coops hold eight birds and pens six pigs. Once two animals are present, keepers provide surplus feed: 2 food and 75 seconds for a chick, 4 food and 120 seconds for a piglet. Each breeding cycle charges feed once. Breeding pauses at capacity, including space reserved by incoming animals. No egg food is generated.

Choose Grow the herd or Send surplus for food. The latter sends animals above the protected pair to a completed, reachable slaughterhouse. Changing back to breeding cancels transfers that have not yet collected an animal. Already carried animals complete delivery. Slaughterhouses queue chickens/pigs separately from sheep, with twelve inbound/queued animals maximum. Processing takes eight seconds.

Train a follower in Hunting for 2 wood. Sixty seconds of practice at camp earns the skill and a spear; progress persists. Trained followers can set pig traps and optionally hunt pigs. Pigs flee nearby followers faster than followers walk. Spear hunting uses a short range and requires a walkable, unobstructed terrain segment to the pig. No ranged action crosses water or a multi-layer cliff.

A trap costs 3 wood and 1 food bait, charged once when placed. A trained follower crafts and arms it. Nearby pigs can approach its bait and become trapped; one trap holds one pig. A trained follower or assigned pig keeper collects the animal and carries it to a pen. An empty trap can be rebaited for 1 food. Up to eight traps are supported.

## Persistence and implementation

Save format 7 adds simulation-owned wild animals, fishing populations/recovery, assigned workers, pen stocks/breeding/feed flags, trap phases, Hunting progress, training/hunting choices, live cargo and slaughterhouse queues. Legacy formats 1–6 retain their economy and terrain and initialise the new wildlife state once. No reset is required for existing islands.

New rules are isolated in `food-system.ts`; adjustable food values, building costs/times, catch/breeding/recovery times, capacities, training and traps are in `food-balance.ts`. Settlement remains responsible for movement, physical plot rules, fixed simulation steps and delivery. Views read simulation state and do not generate food or animals. Wildlife continues to use the existing smaller models and terrain rules.

Visible actions include fishing rods, spears/practice, bending to catch/feed/set traps, carried animals, caught-pig cages, populated pens and stock-backed fish. Construction still uses kneeling hammer animations. Decorative fish outside managed fishing areas become managed through shoreline designation; wild land animals are finite and their reproduction occurs in pens.

## Validation

New tests cover exact cargo/delivery yields; depletion and recovery from zero; exclusive chicken capture; paid breeding, capacities and protected pairs; Hunting material/skill restrictions; pig flight and trap collection; slaughterhouse processing and guided pen construction; live cargo held on blocked routes; cliff restrictions; save continuation, legacy migration, invalid claims/capacities; and fish view counts/disposal. Existing terrain, settlement, terrace, guidance, beacon, temple, animal and island expansion tests remain required. Hands-on visual and device performance testing was not requested or performed.
