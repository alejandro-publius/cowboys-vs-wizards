# Design: Clash log preview (retrospective)

Describes the code at `4fb0f88`, read after the fact.

- `clashLog(events)` in `src/match/clash-log.js` is pure. It finds the last `clash` event, maps `spell`, `damage` and `defeat` events to one sentence each in event order, and returns `{ title: "Round N clash", lines }`. An empty described set gives `["Nothing was hit"]`.
- The only lookup outside the event is `CARDS[cardId].name`. Cowboy troops read "Your X" / "your X"; Wizard troops read "X" / "the X"; Bases read "your Base" and "the Wizard Base".
- Input batch: events since the previous clash. The properties feed raw batches from real matches, including `draw`, `summon`, `phase-*` and `round-start` events, to confirm those are ignored.

## Verification design

`tests/match/clash-log-properties.test.js` is a hand-written seeded loop: seeds 0 to 199 times four cpu/random bot pairings, played by `scripts/play-match.mjs`. It is not a property-testing library, and **it has no shrinking**. A failure prints `replay: CLASH_LOG_SEED=<seed> pairing=<a/b> batch=<n>` plus the event and line. Setting `CLASH_LOG_SEED` reruns that seed only.

A coverage-guard test fails if the generated batches stop exercising Base hits, troop hits, spells, spell moves, defeats or simultaneous lanes.

Mutation evidence: `docs/evidence/kiro-preview-contracts.md`.
