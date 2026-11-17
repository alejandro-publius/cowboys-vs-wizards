# Kiro trap T1: flagged match state (issue #89)

Author: Kiro (Kiro IDE client, session `sess_027da6e0-b625-4d13-8178-ceefce8e0a8e`). Model observed in this session's `session.json`: `modelId: "claude-opus-5.5"`. That file has no credit or usage field, so no credit count is recorded here.
Branch: `kiro/trap-state-89`, base main `1c803bc`. Date: 2026-11-17, 10:08 PST (America/Los_Angeles).
Scope: task T1 in [tasks.md](../../.kiro/specs/trap-zone/tasks.md), headless state only, following [trap-prototype-contract.md](../submission/trap-prototype-contract.md) sections 2.9 and 3 (A + X, no `trapSet`).

## Change

- [src/game/state.js](../../src/game/state.js): `createMatch(seed, { cowboyDeck, traps = false })`. When `traps` is `true`, the function adds `sides[side].trap = null` and `allowances[side].tactical = null` for each side, plus a top-level `traps: "trap-ax-proto-1"` (exported as `TRAP_RULES_VERSION`). A non-boolean `traps` throws `TypeError`. The flag makes no RNG draw and changes no deck or hand. `RULES_VERSION` stays `"orb-duel-draft-1"`.
- [tests/game/trap-state.test.js](../../tests/game/trap-state.test.js): 8 tests, new.

Not done, by instruction: no trap card IDs, no `trap` card kind, no deck or hand change, no `set-trap` action, no legal list, CPU, view, events, presenter, render, art, sound or animation.

## Deviations from tasks.md T1 (narrowed by the issue #89 brief)

- T1 lists a `trap` card kind and a `RULES_VERSION` suffix. The brief excludes card kind registration and requires `RULES_VERSION` to stay the same. A separate `traps` version key on flagged matches stands in for the suffix. T2 or the owner gate (T0) needs to settle whether the suffix is still wanted.
- The round-start reset in `src/game/actions.js` line 143 rebuilds each allowance as `{ summonUsed: false, castUsed: false }`. On a flagged match that drops `tactical` after the first round. T1 cannot touch `actions.js`, so the reset is left to T2. Only the initial state carries `tactical: null` today.

## Tests

The flag-off fixtures for seeds 0 and 60 are literal state objects, recorded from `createMatch` on unmodified `1c803bc` before the edit. The test compares against those literals and does not call the function to produce its own expected value. The tests cover:

- Flag-off parity: `createMatch(s)`, `createMatch(s, {})` and `createMatch(s, { traps: false })` each deep-equal the baseline literal for seeds 0 and 60.
- Flag off adds no key: the key lists at the top level, per side and per allowance are exact, and there is no `traps` key.
- Flag on adds exactly `trap: null`, `tactical: null` and `traps`, with no `trapSet`.
- Flag on keeps the same RNG, starting side and card order for seeds 0, 1, 60 and 12345, and every default card is conserved.
- The flag composes with a custom Cowboy deck.
- A fresh restart after a mutated match gives null trap state again.
- `createMatch` mutates neither its options, the custom deck nor `DECKS`.
- A non-boolean flag is rejected.

## Commands run (actual output, trimmed)

```
$ node --test tests/game/trap-state.test.js
ℹ tests 8  ℹ pass 8  ℹ fail 0

# one-off check: new flag-off output vs the 1c803bc state.js loaded from git show
old 1c803bc vs new flag-off deepEqual seeds 0,60,1,999: ok

$ node --test tests/game/trap-state.test.js tests/game/match.test.js tests/game/invariants.test.js
ℹ tests 31  ℹ pass 31  ℹ fail 0

$ npm test   (node scripts/verify-duel.mjs, Node v26.0.0)
ℹ tests 230  ℹ pass 230  ℹ fail 0
2/2 file(s) passed structural checks (structure only; not motion quality)

$ node scripts/check-links.mjs
158 Markdown files, 561 relative links and images, 0 broken

$ git diff --cached --check
(no output, exit 0)
```

No browser replay was run, because no renderer or event path changed.

## Remaining

T2 to T10 are still pending. The T1 items still open are the round-start `tactical` reset (T2), the `RULES_VERSION` suffix question, and the `trap` card kind, which waits on T0.
