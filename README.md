# Cowboys vs. Wizards

A haunted Western browser card duel. Play the Cowboys against the Wizard CPU over three lanes. Choose illustrated cards from your hand, tribute troops to summon stronger ones, and watch life orbs disappear when attacks land.

## Play

Use Node.js 22.18 or later and a WebGL 2 browser. Install dependencies with `npm ci`, then build.

```sh
npm run build
```

Open `dist/cowboys-vs-wizards-board-duel.html`. The single file includes the models, card art and fallback recording. Use `?seed=0` for a repeatable opening with a free Sheriff summon. The seed can also be entered in the game menu. Choose **Attack demo** or append `?mode=demo` for the original Billy and Wizard exchange.

For a static website, run `npm run build -- --web` and serve the entire `dist/web/` directory. It contains an `index.html` and content-hashed assets. Relative URLs allow hosting under a subdirectory.

See the [morning handoff](docs/morning-handoff.md) for the tested seed 60 route to the Mounted Billy and Dragon clash.

## Verify

| What you need | Command |
| --- | --- |
| Game, presenter and asset tests | `node scripts/verify-duel.mjs` |
| The same tests, a fresh build and an eight-step Chrome replay | `node scripts/verify-duel.mjs --browser` |
| Attack demo geometry, grip and event order | `npm run check` |
| A seeded rules trace | `node scripts/play-match.mjs --seed 60` |

The Chrome check on macOS writes the receipt and screenshots to `.artifacts/kiro/replay/` when invoked through `verify-duel.mjs`. The saved **orb-duel-replay** Workflow runs the same command. See the [Kiro write-up](docs/kiro-brag-sheet.md) for the Spec, hooks, tests, review Power and MCP evidence.

## Code map

| Path | Owns |
| --- | --- |
| `src/game/` | Seeded rules, legal actions, public views and CPU |
| `src/match/` | Selection, controller, scheduler and event playback |
| `src/render/` | Three.js scene, rigs, orbs and combat cues |
| `src/ui/` | Illustrated hand, interactive overlay and menus |
| `src/main.js` | Browser boot, mode switching and frame loop |
| `assets/` | Optimized Tripo models, card illustrations and media |
| `scripts/`, `tests/` | Build, replay, simulation and verification |
| `.kiro/`, `docs/` | Workspace guidance, requirements, research and evidence |

Read [AGENTS.md](AGENTS.md) before editing. Work on one owned area in a separate worktree and run the affected check. The engine decides outcomes. The presenter renders the events and their before and after values.

## Assets and attribution

Mounted Billy and Dragon are fitted, textured static meshes. Billy, Wizard and Sheriff use procedural rigs. Skeleton uses a temporary token. See the [animation plan](docs/character-animation-plan.md) before adding clips or replacing an export.

The build includes Three.js (MIT) and Rapier (Apache-2.0) notices. The pinned Lucca Cerf references and their MIT license are in [docs/references/lucca-character-factory](docs/references/lucca-character-factory). The [build log](docs/kiro-build-log.md) attributes work by Kiro, Fable, Codex, Tripo and the user.
