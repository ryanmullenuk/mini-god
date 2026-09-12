# Contributing to Mini God

Use issues to describe bugs and discuss larger changes. Include reproduction steps, browser, viewport size and relevant screenshots. Never attach private saves, credentials or personal information to a public issue.

## Development workflow

1. Fork the repository and create a feature branch.
2. Install dependencies and run the game using the README.
3. Make a focused change, retaining the current visual style and functioning systems.
4. Run TypeScript and relevant regression checks; run the production build before submitting.
5. Open a pull request explaining the player-visible change and how it was checked.

## Invariants to preserve

- Terrain changes one layer per sculpting stroke. Followers cannot cross tall cliffs or water.
- Food enters storage only after physical delivery. Claims must prevent duplicated catches and jobs.
- Saves must load without duplicating animals, resources, jobs or rewards. Add migration coverage when changing the format.
- Keep animation shader-driven or instanced where possible. Do not rebuild the entire terrain on each brush stamp.
- Test camera and interface changes at narrow and wide viewports, at maximum zoom and low pitch.
- Keep costs and rates in existing balance configurations where possible.

Do not commit `.env` files, API tokens, browser saves, build output, `node_modules`, local work folders or deployment credentials. The public repository is a clean snapshot; the original local development history is intentionally not included.

This repository is public source only. Agree contribution and reuse permissions with the maintainer before submitting code; no open-source license is implied.
