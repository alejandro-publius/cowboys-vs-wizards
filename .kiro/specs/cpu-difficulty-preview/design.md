# Design: CPU difficulty preview (plan)

Constraints from #34: the only input is `publicState(state, side)` through `chooseAction(view)`; no seed, hand or deck peeking. `scripts/play-match.mjs` gives each bot only its own public view and its `makeBot(kind, seed, side)` already supports `cpu` and `random` opponents.

Proposed shape (for Rachel, not a decision): a level selects a function from public view to one legal action. `normal` is today's `chooseAction`, unchanged. `src/main.js` reads `?cpu=`; an unknown value falling back to `normal` is an assumption to confirm.

Verification design:
1. Equivalence: `normal` against current `chooseAction` over 100 or more seeds.
2. Hidden information: reuse the existing test's pattern.
3. Strength ordering: paired seeded simulation, 1,000 or more matches per pairing, same Cowboy opponent, both starting sides. Report as an estimate with sample size. No claim of proof.
4. Cost: a Node simulation of this size runs in seconds; the 800-match suite for #29 plays in about a second. No browser needed except for CD-1.
