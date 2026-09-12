# Mini God

A stylized miniature god game: sculpt a terraced archipelago, guide a village, and watch its people, wildlife and coastal world develop.

[Play the current game](https://tide-island-sculpt.niall-harper-3240.chatgpt.site)

## Run locally

Requires Node.js 22.13 or newer, pnpm, and a browser with WebGL enabled.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by the development server. No game API keys are required. Progress is stored in your browser on this device; the in-game help menu can export and import saves.

## Check and build

```sh
pnpm exec tsc --noEmit
node --test --test-concurrency=2 scripts/check-*.mjs
pnpm build
```

## Controls

- Explore: drag to orbit; right-drag to pan; scroll to zoom.
- Shape: raise or lower one layer per stroke. Use Path to cut walkable steps.
- Followers climb only one layer at a time; create steps across taller cliffs.
- Choose a settlement, then use the village, building and wildlife icons to guide work.
- The speaker button toggles sea and bird ambience.

## Project map

| Location | Purpose |
| --- | --- |
| `app/` | Main interface, styles and page metadata |
| `components/` | Toolbar, splash, food controls and shared UI |
| `lib/game/terrain.ts` | Elevation data, generation and local terrain geometry |
| `lib/game/terrain-worker.ts` | Background terrain meshing |
| `lib/game/settlement.ts` | Follower jobs and settlement simulation |
| `lib/game/food-system.ts` | Fishing, breeding, hunting and food delivery |
| `lib/game/food-balance.ts` | Editable food and wildlife balance |
| `lib/game/ocean.ts` | Shader-driven ocean, depth bands, foam and mist |
| `lib/game/save.ts` | Save validation and migrations |
| `scripts/` | Regression checks and sculpting benchmark |
| `docs/` | Design and implementation notes, including historical features |
| `public/` | Static assets |

Built with TypeScript, React, Three.js, Vinext/Vite and Cloudflare tooling. Most scenery and audio are procedural, so there are no missing model or sound downloads.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Open an issue to discuss larger changes and submit a pull request for review. Public visibility does not give direct write access to the main branch.

The design notes include earlier directions that have since changed; the code and current game are authoritative. Preserve compatibility with existing saves and avoid main-thread terrain rebuilds during sculpting.

## Deployment

The existing `.openai/hosting.json` identifies the original hosted Site; it is not a credential. Forks should configure their own hosting target before deployment, rather than attempting to publish to the original Site. Local development does not require access to the original hosting account.

## Licensing

Public source only: no open-source license has been granted for the original game code or assets. All rights are reserved by their respective owners. Third-party packages retain their respective licenses. Please discuss permission with the maintainer before redistribution or reuse outside the repository contribution workflow.
