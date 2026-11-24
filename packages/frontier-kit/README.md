# Frontier kit

Code shared by Showdown and Boot Hill Poker. It imports neither game and has
no DOM, Node, network or rendering dependency.

## What is shared

Two modules.

`paired-cohort.js` is the deterministic paired-duel cohort audit
(`measurePairedCohort`, `PairedCohortError`, `DRAW`, `MAX_DEALS`). It was
moved here unchanged from `src/review/paired-duel-kit.js`, which is now a
re-export so existing callers keep working. `index.js` exports this module
and nothing else.

| Game | Consumer | Import path |
| --- | --- | --- |
| Showdown | `scripts/field-trial-confirm.mjs`, `tests/game/field-trial-repair.test.js` | `src/review/paired-duel-kit.js` (re-export) |
| Boot Hill Poker | `scripts/verify-poker-kit.mjs` | `packages/frontier-kit/index.js` |

`seeded-rng.js` is `mulberry32(seed)`, the seeded generator that each game
keeps as a private copy today. Neither game uses the kit's version yet (see
"Seeded RNG" below). Import it from `packages/frontier-kit/seeded-rng.js`. It
is not exported from `index.js`, because `tests/game/dec4-frontier-kit.test.js`
pins that file's exports and imports to the audit.

There is no shared combat engine, renderer, networking or WebSocket layer,
and neither game's browser runtime imports the kit yet.

## Seeded RNG

`mulberry32(seed)` returns `next()`, which gives a float in [0, 1) that is a
whole multiple of 2^-32. The seed must be a finite number, and it is wrapped
to a uint32: truncated, then taken modulo 2^32. Any other seed throws
`TypeError`. The module has no imports and no module-level state, and it
never reads or writes a global. Each generator keeps its own state.

The lines inside `next()` are the same text as Showdown's `random()` in
`src/game/showdown/rules.js` and Poker's `createRng()` in
`experiments/boot-hill-poker/engine.js`. The games differ only in how they
read a seed:

- For finite numbers, both wrap the seed the same way and match the kit.
- For other seeds they disagree. Showdown applies `>>> 0`, so `""`, `null`
  and `NaN` become 0 and `"0x10"` becomes 16. Poker FNV-1a hashes any seed
  that is neither a finite number nor decimal integer text.

The kit refuses those seeds rather than pick one reading. Each game keeps its
own seed parsing.

`tests/game/frontier-kit-seeded-rng.test.js` checks the following in Node:

- The kit, Showdown and Poker streams all equal an independent BigInt
  mulberry32 for:
  - seed 0;
  - the uint32 edges, including `0x92d4860b`, whose first value is exactly 0;
  - wrapped negatives, fractions and huge numbers;
  - a sweep of 4,096 seeds.
- The state steps by `0x6d2b79f5`, and generators are repeatable and share
  no state.
- Showdown's `createShowdown` deals and Poker's `shuffleDeck` and `newDeal`
  hands can be rebuilt from the kit.
- An in-memory copy of each engine, with its generator switched to the kit,
  matches the current engine on:
  - every stream and deal;
  - 120 Showdown level-0 duels;
  - Poker's recorded 500-seed cohort (500 wins each, 488 first-seat wins).
- A deliberately wrong switch is caught.

### Not integrated

Neither game's source, build or staged tree uses the kit generator. The
release checkpoint stays anchored to the current engines. The Node rehearsal
above shows that switching the source keeps deals identical. It does not
prove either browser build.

Switching is a recertification, not a refactor. It changes the bytes of
`rules.js`, whose hash `docs/evidence/outrider-gate/receipt.json` records,
and the bytes of the root page.

To switch both games with identical deals:

1. **Showdown.** The `/`, `/3d/` and `/graybox/` pages bundle `src/app.js`.
   The `/showdown/` page bundles `prototypes/showdown/main.js`, whose
   `rules.js` re-exports the same engine. In `src/game/showdown/rules.js`,
   import `mulberry32` from `../../../packages/frontier-kit/seeded-rng.js` and
   make the body of `random(seed)` `return mulberry32(seed >>> 0);`. Keep the
   export name, the `>>> 0` and the comment
   `mulberry32: the same seed always gives the same deal.`, which
   `scripts/showdown-dec4-properties.mjs` quotes. esbuild bundles the kit
   file, so staging does not change.
2. **Poker.** The `/poker/` files are copied byte for byte. In `engine.js`,
   make the body of `createRng(seed)`
   `return mulberry32(normalizeSeed(seed));`. The import is the hard part:
   `../../packages/frontier-kit/seeded-rng.js` resolves in Node, but staged as
   `/poker/engine.js` it points outside `poker/`, and
   `scripts/check-pages-tree.mjs` rejects that. The recommended fix:
   - `scripts/stage-pages.mjs` copies the kit file to
     `poker/frontier-kit/seeded-rng.js` and rewrites that one import to
     `./frontier-kit/seeded-rng.js`;
   - `check-pages-tree.mjs` adds the file to `POKER_FILES` and compares
     `engine.js` with its source after the same rewrite;
   - `tests/game/dec4-frontier-kit.test.js` updates its staged-graph
     assertion, which expects exactly four scripts.
3. **This test.** Turn the rehearsal into direct checks of the switched
   engines, and retire the "not integrated" test.
4. **Browser proof.** Rebuild and stage, then:
   - Showdown: replay transcripts made before the switch
     (`scripts/referee/browser-transcripts.mjs --source public`) through the
     rebuilt page with `scripts/referee/browser.mjs --cohort`.
   - Poker: in headless Chrome, import the staged `poker/engine.js` and
     compare `shuffleDeck` and `newDeal` with Node for the same seeds.

   Then recertify the release checkpoint.

## Runtime packaging

`scripts/stage-pages.mjs` copies five files of `experiments/boot-hill-poker/`
into `/poker/`, and `scripts/check-pages-tree.mjs` requires that import
graph to be exactly those files. A runtime import of this kit from Poker
would need both scripts to stage `packages/frontier-kit/` and a relative path
that resolves under the Pages project path. Showdown's pages are esbuild
bundles, so a runtime import there would be bundled without staging changes.

## Checks

`node --test tests/game/dec4-frontier-kit.test.js` checks the import
boundaries (including indirect imports), the re-export, the 500 mirrored
Poker seeds and the recorded Showdown Billy cohort through the kit.

`node --test tests/game/frontier-kit-seeded-rng.test.js` checks the seeded
generator against both games, as described above.
