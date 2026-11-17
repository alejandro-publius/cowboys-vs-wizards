# Orb Duel requirement-to-test map

Maps each numbered acceptance criterion in
[`.kiro/specs/orb-duel/requirements.md`](../.kiro/specs/orb-duel/requirements.md)
to the tests that exercise it today. Written by hand from the test sources at
commit `4c0723d` plus the new boundary properties. It is not generated and no
script checks it, so it can drift: re-read the cited tests before relying on a
row. It claims nothing about visual quality, fun or animation.

IDs: `R<requirement>.<criterion>`. The spec's "Asset Gaps" section carries its
own list 1 to 5, written here as `AG.1` to `AG.5`.

## Classes

| Class | Meaning |
| --- | --- |
| **direct** | A test asserts the stated behavior: either an existing test whose assertions I read, or a new `BP-*` property (named in the New column) that asserts it. Existing tests matched only by title are labelled "(title)" in the Notes or Existing column and are not what makes the row direct. |
| **partial** | Related behavior is asserted, or the test was matched only by title and `design.md` "Validates" lines and its assertions were not re-read. The Notes column says which. |
| **browser/manual** | Needs a rendered page or a person. Node tests can check structure and call order, not appearance. |
| **missing** | No test asserts it. |
| **superseded** | The spec sentence no longer describes the shipped game. |

New properties (`BP-*`) are in [`tests/game/boundary-properties.test.js`](../tests/game/boundary-properties.test.js)
with helpers in `tests/helpers/boundary-properties/`. Their evidence is in
[`docs/evidence/kiro-boundary-properties.md`](evidence/kiro-boundary-properties.md).
Test shorthands: `match` = `tests/game/match.test.js`, `summon` = `tests/game/summon.test.js`,
`inv` = `tests/game/invariants.test.js`, `sim` = `tests/game/custom-deck-simulation.test.js`,
`deck` = `tests/game/deck-builder.test.js`, `cpu` = `tests/game/cpu.test.js`,
`ctl`, `pres`, `sel`, `orbs`, `card-model` = the same-named files in `tests/match/`.

## Requirement 1: Seeded Deck Setup

| AC | Class | Existing tests | New | Notes |
| --- | --- | --- | --- | --- |
| R1.1 | direct, partly superseded | `summon` "seeded setup"; `card-specs` "registry holds available copies; default decks retain each spec's copies" | BP-DECK (every one-Sheriff and six-copy custom deck) | The default decks match the draft table. A Cowboy deck may now be any valid 12 of a 36-card pool (deck builder), so "matching the draft card table" holds only for the default. |
| R1.2 | direct | `summon` "seed replay"; `deck` "seed zero exactly retains the pre-builder default match" | BP-REPLAY | |
| R1.3 | direct | `summon` "seeded setup" (four in hand); `match` "drawing: none in round one" | | Opt-in opening policies change the second seat's hand (`opening-policy` tests); the spec text describes the default only. |
| R1.4 | direct | `match` "drawing: none in round one, one per side at the start of rounds two to nine" | | |
| R1.5 | direct | `match` "drawing: an empty deck draws nothing and the match continues" | | |
| R1.6 | direct | `inv` (both walks, every step); `sim`; `summon` "card conservation across seeds" | BP-DECK, BP-TRIBUTE, BP-SPELL, BP-REPLAY (`checkState` after every accepted action) | |
| R1.7 | direct | `inv` (the sorted ID multiset equals the fixed 24 after every action) | BP-DECK, BP-REPLAY | Shown through conservation of the ID multiset, not through a separate "no creation" assertion. |
| R1.8 | direct | `summon` "seeded setup" | | |
| R1.9 | partial | `ctl` "a seed that is not a whole number is refused before createMatch" | | The engine's own `TypeError` for a missing or non-integer seed has no test (`state.js`). Controller level only. |
| R1.10 | partial | `ctl` "a generated seed reaches createMatch and is recorded; the default comes from crypto" | | Matched by title. |
| R1.11 | partial, browser/manual | `ctl` "restart reuses a pinned seed" (title) | | The `?seed=` and seed-field parsing live in the page entry and are exercised only by the browser replay (`scripts/browser-match-check.mjs`, not run for this task). |
| R1.12 | partial, browser/manual | `card-model` "…outcomes and seed (seeds 0-99)" asserts the model's seed text | | Whether the seed is visible on screen needs a rendered page. |
| R1.13 | direct | `ctl` "seeds 14, 27 and 47 keep the createMatch opening hands and play to a result" | | |

## Requirement 2: Card Selection

| AC | Class | Existing tests | New | Notes |
| --- | --- | --- | --- | --- |
| R2.1 | partial, browser/manual | `card-model` "counts, one front per held card…" (title) | | Model level. The on-screen cards need a browser. |
| R2.2, R2.3 | partial | `sel` "hand clicks select, replace and deselect; an occupied or enemy slot is invalid"; Property 1 | | Title and design mapping, not re-read. |
| R2.4 | partial | `sel` "input is ignored outside the viewer's phase, after the result, or while not accepting" | | Title. |
| R2.5 | partial | `sel` "Feature: orb-duel, Property 1: Selection never touches the Engine" | | Title and design mapping. |
| R2.6 | direct (engine only) | `match` "drawing: none in round one…" (a hand grows to 12 with no discard) | | The UI has no test for this. |

## Requirement 3: Atomic Summon and Tribute

| AC | Class | Existing tests | New | Notes |
| --- | --- | --- | --- | --- |
| R3.1 | direct | `summon` "tribute cost by stars" | BP-TRIBUTE (cost 0, 1 and 2 on both sides) | |
| R3.2 | direct | `summon` "invalid selections are rejected without changing state, ownership or RNG"; `match` "invalid actions are rejected…" | BP-REJECT (about 40 invalid-action categories over constructed and reachable states) | |
| R3.3 | direct | `summon` "full-board sacrifice…" | BP-TRIBUTE (card, tributes, slot and allowance compared together) | |
| R3.4 | direct | `summon` "invalid selections…" (duplicate `[0, 0]`, empty slot, slot 3) | BP-REJECT (duplicate slot, empty slot, enemy-occupied slot, out of range, non-number, non-list) | |
| R3.5 | direct | `summon` "full-board sacrifice…"; `match` "full-board tribute…" | BP-TRIBUTE (every card, tribute set and slot on a full board, both sides) | |
| R3.6 | direct | `summon` "full-board sacrifice…" | BP-TRIBUTE (full health in the vacated slot, each tribute in the discard once) | |
| R3.7 | direct | `summon`, `match` "invalid actions…", "stale and retried submissions…" | BP-REJECT, BP-REPLAY (resubmitting an accepted action) | RNG-unchanged is checked through the whole-state JSON comparison. |
| R3.8 | direct | `match` "phase limits: one summon and one cast per side per round…" | BP-REJECT (`summon-used`) | |

## Requirement 4: Tribute Selection Flow (Card_UI)

| AC | Class | Existing tests | New | Notes |
| --- | --- | --- | --- | --- |
| R4.1 | partial, browser/manual | `sel` "full board: a tribute's vacated slot is offered and confirms a legal summon" | | Title. The prompt itself is a page. |
| R4.2 | partial | `sel` "seed 14: Billy shows the tribute shortfall and selection stays idle" | | Title. |
| R4.3, R4.4 | partial | `sel` Property 1; `ctl` "a double confirm, or end phase twice, applies once" | | Title and design mapping. |
| R4.5 | partial | `sel` "hand clicks select, replace and deselect; an occupied or enemy slot is invalid" | | Title. |

## Requirement 5: Orb Display

| AC | Class | Existing tests | New | Notes |
| --- | --- | --- | --- | --- |
| R5.1, R5.2 | direct (scene graph), browser/manual (appearance) | `orbs` "orb rows show exactly n orbs for n = 0 to 5, for troops and Bases"; `pres` Property 4 | | Counts meshes in the Three.js scene in Node. Whether they read on screen is not tested. |
| R5.3 | partial | `pres` Property 2 | | Design mapping. |
| R5.4 | partial | `orbs` (rows share one geometry; no orb asset loaded) | | |
| R5.5 | partial | `orbs` "at each cue's end a summoned piece stands on its tile…" | | Title. |
| R5.6, R5.7 | partial | `pres` Property 3 (zeroed attackers, chained base hits, spell defeats counted), Property 4 | | Header and coverage counters read, not every assertion. |
| R5.8 | partial | `pres` Property 3 | BP-CLASH asserts the engine side: every troop in the snapshot has a damage event, including those that die | The renderer playing each attack is browser/manual. |

## Requirement 6: Round Flow

| AC | Class | Existing tests | New | Notes |
| --- | --- | --- | --- | --- |
| R6.1 | direct | `match` "phase flow…alternating starting side"; `summon` "seed replay" (both sides start, depending on seed) | | |
| R6.2 | direct | `match` "phase limits…" | BP-REJECT, BP-SPELL (`cast-used`) | |
| R6.3 | direct | `match` "phase flow…" | | |
| R6.4 | direct | `match` "phase limits…" (`summon-after-spell`) | BP-REJECT | |
| R6.5 | missing | | | The engine has no clock. Nothing asserts that, and a test cannot show an absence. |
| R6.6 | direct | `match` "phase flow…" | BP-CLASH (next-round fields, draws, allowance reset) | |
| R6.7 | direct | `match` "stale and retried submissions…" | BP-REJECT, BP-REPLAY | |

## Requirement 7: Clash

| AC | Class | Existing tests | New | Notes |
| --- | --- | --- | --- | --- |
| R7.1 | direct | `match` "full-board tribute…fights in that round's clash" | BP-CLASH (independent sum-then-clamp oracle over 400 constructed clashes) | |
| R7.2 | direct | `match` "clash: a blocking troop absorbs the whole attack and nothing spills to the base" (title) | BP-CLASH (overkill, no base spill) | |
| R7.3 | direct | `match` "clash: troops facing an empty lane damage the opposing base, both ways" (title) | BP-CLASH | |
| R7.4 | direct | `inv` (bounds after every action) | BP-CLASH (base exactly zero and base clamped categories) | |
| R7.5 | direct | `match` "clash: mutual defeats go to their owners' discards exactly once" (title) | BP-CLASH (discard multiset, one defeat event per defeated troop, defeats after all damage) | |
| R7.6 | direct | `match` "result: exactly one base at zero loses, and the rest of the clash still resolves" (title) | BP-CLASH (lane-mirror metamorphic check) | |

## Requirement 8: Spells

| AC | Class | Existing tests | New | Notes |
| --- | --- | --- | --- | --- |
| R8.1 | direct | `match` "spells: Deadeye removes one health, kills at one, and needs no friendly troop" | BP-SPELL (caster board empty and occupied, one-orb kill) | |
| R8.2 | direct | `match` "spells: Singularity damages, then optionally moves the survivor…" | BP-SPELL | |
| R8.3 | direct | `match` "spells: with no enemy troop a spell cannot be cast and stays in hand" | BP-SPELL, BP-REJECT | |
| R8.4 | direct | `match` "invalid actions…" (destinations 0, 1, 2, -1, 3, "2") | BP-SPELL (every target and destination, including the one-orb target) | |
| R8.5 | direct | `match` spell tests | BP-SPELL (spell and defeated target each in the discard once) | |
| R8.6 | direct | `match` "invalid actions…" ("a rejected cast spends nothing") | BP-SPELL, BP-REJECT | |

## Requirement 9: CPU Opponent

| AC | Class | Existing tests | New | Notes |
| --- | --- | --- | --- | --- |
| R9.1 | direct | `cpu` "the CPU's choice is always a legal action…"; `sim` | BP-CPU (every difficulty, both sides, constructed and reachable states) | |
| R9.2 | direct, partly superseded | `ctl` Property 6 (the CPU gets one argument, no `seed`, `rng`, decks or Cowboy hand); `cpu` "hidden information does not change the … CPU's decision" (50 seeds, reversed order) | BP-CPU (random permutations of the opponent's hand and deck pool, own deck order, seed and rng; every level) | The spec names `publicState(state, "wizard")`. The shipped CPU also plays Cowboys in simulations and has easy, normal and hard levels. |
| R9.3 | partial | `cpu` determinism tests | | "Documented heuristic" is `docs/evidence/cpu-difficulty.md`, not a test. "Not a language model" cannot be tested. |
| R9.4 | direct | `cpu` "CPU against CPU finishes within the step bound and replays identically" | BP-CPU (decision identical across hidden-data twins) | |
| R9.5 | partial | `cpu` "with no summon or spell legal the CPU ends the phase" (title) | | Matched by title. BP-CPU only asserts that the choice is legal, so it does not claim R9.5. |
| R9.6 | partial | `ctl` Property 6 (Wizard CPU) | | Which side the page gives the CPU is wired in the entry point and not asserted here. |

## Requirement 10: Match Result

| AC | Class | Existing tests | New | Notes |
| --- | --- | --- | --- | --- |
| R10.1 | direct | `match` "result: both bases at zero in the same clash is a draw, whichever lane lands first" (title) | BP-CLASH (29 simultaneous base-zero clashes at the recorded seed) | |
| R10.2 | direct | `match` "result: exactly one base at zero loses…" | BP-CLASH | |
| R10.3 | direct | `match` "result: after round nine's clash the higher base wins and equal bases draw" | BP-CLASH (decided and tied round-limit cases) | |
| R10.4 | direct | `match` "terminal match rejects every action" | BP-CLASH | |
| R10.5 | partial, browser/manual | `card-model` "no match yet, the result labels and the message" | | Model level. The displayed Victory, Defeat or Draw and restart control are a page. |

## Requirement 11: Restart, Engine API and Replay

| AC | Class | Existing tests | New | Notes |
| --- | --- | --- | --- | --- |
| R11.1 | direct | every game test uses the four functions | | |
| R11.2 | missing (checked once by hand) | | | No test asserts that `src/game/` avoids DOM, rendering, filesystem, network and model imports. A grep of its imports at `4c0723d` shows only relative `./*.js` modules. That is an observation, not a regression guard. |
| R11.3 | direct | `match` "deterministic replay: same seed and actions give identical states and events" | BP-REPLAY (80 starts, accepted-action log replayed with identical states and events) | |
| R11.4 | partial | `ctl` "restart reuses a pinned seed and otherwise generates a new one" (title) | | |
| R11.5 | partial, browser/manual | `orbs` "reset builds exactly the view's troops and orbs; clear() leaves no piece…" (title) | | Result displays and Card_UI removal are a page. |

## Requirement 12: Playback, Input Lock and Cancellation

| AC | Class | Existing tests | New | Notes |
| --- | --- | --- | --- | --- |
| R12.1 | partial | `pres` Property 2; `ctl` Property 6 | | Whether UI code avoids the full state is a code property no test asserts. |
| R12.2 | partial | `pres` Property 2 | | Design mapping. |
| R12.3 | partial | `pres` "a displayed state that differs from `to` at drain… calls onError" | | Title. |
| R12.4 | direct | `pres` "an unsupported event type throws a development error naming it, before anything is queued" | | |
| R12.5 | partial | `ctl` "clicks, end phase and submit() during playback or the CPU turn are ignored and reach no Engine call" | | Title. |
| R12.6 | direct | `ctl` Property 6 (asserts the CPU is asked only in `cpu_turn` and when not busy) | | |
| R12.7, R12.8 | direct | `ctl` Property 5 (cut at points in a match, restart, compare with a fresh run; calls after `leave()`); `scheduler` "a guard-wrapped late callback from an old epoch is dropped" | | |
| R12.9 | browser/manual | `attack-clips` (Dragon, Mounted Billy clips only) | | The existing attack demo is checked by the browser replay, not by Node tests. |

## Asset Gaps (historical)

The "Asset Gaps" and "Missing" lists name assets that have since been supplied. Per the
task instruction they are treated as stale: no current asset gap is inferred from them.

| AC | Class | Notes |
| --- | --- | --- |
| AG.1 | direct | `card-specs` tests compare engine stats to the JSON specs, independent of models. |
| AG.2, AG.3 | superseded | Describe temporary stand-ins and plain HTML cards. Not re-audited against the current renderer. |
| AG.4 | partial | Same evidence as R5.4. |
| AG.5 | browser/manual | Same as R12.9. |

## Contradictions between the spec and the shipped code

1. **R1.1 and the card table.** Cowboy decks are now a player choice (12 of 36 cards, at most six of a type, at least one Sheriff). The spec's fixed-deck wording is correct only for the default. Covered by BP-DECK, not by the spec.
2. **R1.3 and opening policies.** Opt-in policies deal five cards to the second seat. Default behavior still matches the spec.
3. **R9.2 and R9.6.** The CPU has three levels and runs for either side in scripts. The spec describes one Wizard CPU.
4. **Introduction and Asset Gaps.** They describe branch state and missing models from an earlier date and are stale.
5. **Numbering.** The "Asset Gaps" criteria restart at 1, so a bare "AC 3" is ambiguous. This map writes them `AG.n`.

## What this map does not show

- A listed test can pass while the claim is only partly checked. "direct" means an assertion on the stated behavior that I read, not that every input is covered.
- Rows marked "title" were matched from test names and `design.md` Validates lines. Their assertions were not read for this map.
- Nothing here measures rendering, animation, readability or play quality.
