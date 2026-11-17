# Kiro trap T1: flagged match state (issue #89)

Author: Kiro. The coordinator invoked the work as a Kiro CLI V3 run on Claude Opus 5.5. The session's own system context names the client as "Kiro IDE" (session `sess_027da6e0-b625-4d13-8178-ceefce8e0a8e`). That label is the session's internal client metadata and differs from the CLI invocation; both are recorded here without choosing one. Model in this session's `session.json`: `modelId: "claude-opus-5.5"`.
Credits: the coordinator's review recovered a stream usage of 5.877552637 credits for the first T1 run (commit `922337a`). The session's `messages.jsonl` holds one `usage` value, `5.877552637147596`, which matches. The corrective run (below) is metered separately, and the stream showed no separate usage value for it when this note was written. No figure is recorded for the corrective run.
Branch: `kiro/trap-state-89`, base main `1c803bc`. First commit `922337a`, 2026-11-17 10:08 PST. Corrective commit 2026-11-17 10:11 PST (America/Los_Angeles).
Scope: task T1 in [tasks.md](../../.kiro/specs/trap-zone/tasks.md), headless state only, following [trap-prototype-contract.md](../submission/trap-prototype-contract.md) sections 2.9 and 3 (A + X, no `trapSet`).

## Change

- [src/game/state.js](../../src/game/state.js): `createMatch(seed, { cowboyDeck, traps = false })`. When `traps` is `true`, the function adds `sides[side].trap = null` and `allowances[side].tactical = null` for each side, plus a top-level `traps: { enabled: true, rulesVersion: "orb-duel-draft-1+traps" }`. The version string is exported as `TRAP_RULES_VERSION`, and its value follows [design.md](../../.kiro/specs/trap-zone/design.md) section 2. Later code checks `state.traps?.enabled`. A non-boolean `traps` throws `TypeError`. The flag makes no RNG draw and changes no deck or hand. `RULES_VERSION` stays `"orb-duel-draft-1"`.
- [src/game/actions.js](../../src/game/actions.js) `applyEndPhase`: when `next.traps?.enabled`, the round-start reset rebuilds each allowance as `{ summonUsed: false, castUsed: false, tactical: null }`. The flag-off reset is unchanged.
- [tests/game/trap-state.test.js](../../tests/game/trap-state.test.js): 9 tests, new.

## Coordinator corrections (after review of `922337a`)

1. In `922337a`, `state.traps` was the string `"trap-ax-proto-1"`. design.md section 2 specifies an object with `enabled`. It is now `{ enabled: true, rulesVersion: "orb-duel-draft-1+traps" }`, and it is still absent when the flag is off.
2. In `922337a`, the round-start reset in `actions.js` dropped `tactical` on flagged matches after round 1. The reset is now conditional on `traps.enabled`.

Not done, by instruction: no trap card IDs, no `trap` card kind, no deck or hand change, no `set-trap` action, no legal list, CPU, view, events, presenter, render, art, sound or animation.

## Deviations from tasks.md T1 (narrowed by the issue #89 brief)

- T1 lists a `trap` card kind and a `RULES_VERSION` suffix. The brief excludes card kind registration and requires the exported `RULES_VERSION` to stay the same. Flagged matches carry the design.md suffixed name in `state.traps.rulesVersion` instead. T2 or the owner gate (T0) needs to settle whether report code should read it.

## Tests

The flag-off fixtures for seeds 0 and 60 are literal state objects, recorded from `createMatch` on unmodified `1c803bc` before the edit. The test compares against those literals and does not call the function to produce its own expected value. The tests cover:

- Flag-off parity: `createMatch(s)`, `createMatch(s, {})` and `createMatch(s, { traps: false })` each deep-equal the baseline literal for seeds 0 and 60.
- Flag off adds no key: the key lists at the top level, per side and per allowance are exact, and there is no `traps` key.
- Flag on adds exactly `trap: null`, `tactical: null` and `traps`, with no `trapSet`.
- Flag on keeps the same RNG, starting side and card order for seeds 0, 1, 60 and 12345, and every default card is conserved.
- The flag composes with a custom Cowboy deck.
- A fresh restart after a mutated match gives null trap state again.
- `createMatch` mutates neither its options, the custom deck nor `DECKS`.
- Two `end-phase` actions through the real `applyAction` (seeds 0 and 60) reach round 2. With the flag on, both sides have `tactical: null` and `trap: null`. With the flag off, there are no extra keys, and the flagged state equals the off state plus the T1 keys. This test fails against the `922337a` `actions.js` (checked: 8 pass, 1 fail) and passes with the fix.
- A non-boolean flag is rejected.

## Commands run for the corrective commit (actual output, trimmed)

```
$ node --test tests/game/trap-state.test.js
ℹ tests 9  ℹ pass 9  ℹ fail 0

# same file with actions.js temporarily restored from 922337a, then restored again
✖ round start keeps tactical: null on flagged matches and adds nothing off
ℹ pass 8  ℹ fail 1

$ node --test tests/game/trap-state.test.js tests/game/match.test.js tests/game/invariants.test.js tests/game/cpu.test.js
ℹ tests 44  ℹ pass 44  ℹ fail 0

$ npm test   (node scripts/verify-duel.mjs, Node v26.0.0)
ℹ tests 231  ℹ pass 231  ℹ fail 0
2/2 file(s) passed structural checks (structure only; not motion quality)

$ node scripts/check-links.mjs
159 Markdown files, 567 relative links and images, 0 broken

$ git diff --cached --check
(no output, exit 0)
```

## Commands run for `922337a` (actual output, trimmed)

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

T2 to T10 are still pending. The T1 items still open are the question of where the `RULES_VERSION` suffix is reported, and the `trap` card kind, which waits on T0.
