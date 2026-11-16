# Cowboys vs. Wizards

A haunted Western browser card game. You play the Cowboys against a CPU
Wizard on three lanes per side. The deck and a four-card hand are visible.
Tribute summons turn weaker troops into stronger ones, and each living troop
shows one to five health orbs. The page also keeps the original Billy versus
Wizard attack exchange.

The match uses eight illustrated cards (Sheriff, Billy, Mounted Billy, Deadeye,
Skeleton, Wizard, Dragon, Singularity), a Tripo-made board, and an illustrated
deck back. The Dragon is a static Tripo model. Mounted Billy and Skeleton still
appear as labelled temporary tokens on the board. The numeric rules are a draft
(`orb-duel-draft-1`) and are open to requirements review and playtesting.

## Build and play

Use Node 22 or newer. Install once with `npm ci`.

```sh
npm run build
```

This writes `dist/cowboys-vs-wizards-board-duel.html`, one file with models,
card art and the fallback recording embedded. Open it in a WebGL 2 browser.

| URL query | Result |
| --- | --- |
| none | Card match with a generated seed |
| `?seed=0` | Card match with seed 0: the Cowboys start with a Sheriff in hand |
| `?mode=demo` | Original attack exchange |

Seed 0 example (adjust the repository path):
`file:///<repo>/dist/cowboys-vs-wizards-board-duel.html?seed=0`.
The match panel shows the seed and whether it is pinned. Restart reuses a
pinned seed. A seed typed into the panel replays that match.

In the match, pick a card, choose tribute and a lane, confirm, then end the
phase. The CPU acts and the clash plays. The "Attack demo" button switches to
the original exchange: Billy draws and fires (`1`), the Wizard casts
Singularity (`2`), or play the full exchange (`Space`).

## Checks

Rules and presentation tests need no build. Run what your change touches:

| Check | Command |
| --- | --- |
| Engine rules and CPU | `node --test "tests/game/*.test.js"` |
| Presenter, controller, card model, board pieces | `node --test "tests/match/*.test.js"` |
| Asset audit | `node --test tests/assets/audit.test.mjs` |
| Scene geometry and event order | `npm run check` |
| One seeded bot match as a trace | `node scripts/play-match.mjs --seed 14` |
| Bot matches over a seed range | `node scripts/simulate-matches.mjs --from 0 --count 1000 --cowboy cpu --wizard cpu` |
| Browser play-through (needs Chrome and a fresh build) | `npm run build && node scripts/browser-match-check.mjs --seed 0` |

`npm run check` uses placeholder image decoding. It does not judge appearance
or frame rate. The browser script marks a step "observed" only when the page
showed it, and writes screenshots and `browser-run.json` to
`docs/evidence/kiro-match-ui/` unless `--out-dir` is given. The Kiro
`duel-presenter` SessionStart hook runs
`scripts/check-match-ui.sh` (presenter, controller and card-model tests).
A coordinator follow-up, `scripts/verify-duel.mjs --browser`, is planned and
not yet in this tree.

## Seeds and replay

`createMatch(seed)` in `src/game/state.js` makes the opening state from a
whole-number seed. The same seed and the same actions give the same match. When
a change affects play, report the seed, rules version, command and result.
Seeds 0-99 are what the presenter property tests cover. Seeds 14, 27 and 47
have named opening-hand cases in the controller tests.

## Code map and owners

| Path | Responsibility |
| --- | --- |
| `src/game/` | Rules engine, legal actions, CPU and public views. No DOM, rendering, files, network or models |
| `src/match/` | Selection, scheduler, presenter and controller. Applies accepted engine actions and plays their events back in order |
| `src/render/` | Three.js board, orbs, cues, rigs, camera and the attack timeline (`scene.js`) |
| `src/ui/` | Card model, card art, hand and overlay DOM, `layout.html`, `match.css` |
| `src/main.js` | Entry point: starts the renderer, controller and mode switch |
| `src/physics/gravity.cjs` | Singularity physics |
| `scripts/` | Build, scene check, browser check, bot play and simulation |
| `tests/` | `game/`, `match/` and `assets/` tests |
| `assets/models/` | Optimized Tripo GLBs |
| `assets/cards/`, `assets/media/` | Card art and deck back, poster and replay |
| `.kiro/` | Kiro specs, agents and steering |
| `docs/kiro-build-log.md` | Dated build record; see also `docs/evidence/` |
| `docs/fable-tasks.md` | Active assignments and ownership |

Read `AGENTS.md` before editing. The engine decides outcomes. The presenter
shows the engine's before and after values and computes no damage. Renderers and
the UI read public views and do not change rules. Each parallel worker gets its
own git worktree and owned paths. The coordinator owns shared package files,
entry points, builds, logs and integration.

## Assets and attribution

GLBs are static exports; the procedural rig supplies motion. Skeletal clips
are still missing. The older inventory in `docs/evidence/` refers to the former
`assets/*.glb` paths; those files now live in `assets/models/` with identical bytes.

Lucca Cerf's pinned MIT-licensed documents are in
`docs/references/lucca-character-factory/`. Their private execution tools are
not included. Read `docs/character-animation-plan.md` for adaptation and load
only the needed reference section for an animation task.

The build embeds Three.js (MIT) and Rapier (Apache-2.0) notices. Attribute Codex,
Fable, Kiro, Tripo and user contributions separately; work outside Kiro must not
be represented as Kiro work.
