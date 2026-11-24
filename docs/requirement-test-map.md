# Orb Duel requirement-to-test map

Maps each numbered acceptance criterion in
[`.kiro/specs/orb-duel/requirements.md`](../.kiro/specs/orb-duel/requirements.md)
to the tests that exercise it today. Written by hand from the test sources at
commit `4c0723d` plus the new boundary properties. It is not generated and no
script checks it, so it can drift: re-read the cited tests before relying on a
row. It claims nothing about visual quality, fun or animation.

The Showdown slice 2 spec has its own section,
[Showdown slice 2: the first hour](#showdown-slice-2-the-first-hour), with `FH-` IDs.
The Showdown card specs have the last section,
[Showdown card spec clauses](#showdown-card-spec-clauses-card-), with `CARD-` IDs.

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

## Showdown slice 2: the first hour

Maps each criterion of [`.kiro/specs/showdown-first-hour/requirements.md`](../.kiro/specs/showdown-first-hour/requirements.md)
(IDs `FH-R<n>.<m>`) to the tests that prove it. Backfilled on `kiro/graywave-integrate` `cd764f1`: the
implementation and tests existed before the spec, and this section was written by hand from their
assertions. Each Node test and browser check listed here carries a comment naming its IDs, except
`prog`, which is left untouched so FH-R4.1 ("only import paths changed") stays literally true. The
classes are those defined above.

Shorthands: `prog` = `prototypes/showdown/progress.test.js`, `store` = `tests/game/showdown-campaign-store.test.js`,
`inh` = `tests/game/showdown-inherited.test.js`, `keep` = `tests/game/showdown-keepsake-compat.test.js`, `ramp` = `tests/game/showdown-trail-ramp.test.js`,
`camp` = `tests/match/showdown-campaign.test.js`, `plog` = `tests/match/showdown-playtest.test.js`,
`B-entry` = `scripts/browser-showdown-check.mjs`, `B-trail` = `scripts/browser-showdown-trail-check.mjs`
(Run A new player, Run B lane veteran). Browser receipts:
[`browser-showdown.json`](evidence/kiro-143-slice2-integrate/browser-showdown.json) (23 of 23) and
[`browser-showdown-trail.json`](evidence/kiro-143-slice2-integrate/browser-showdown-trail.json) (16 of 16), run on `6ade89e`;
the built pages at `cd764f1` are byte-identical to the ones checked
([README](evidence/kiro-143-slice2-integrate/README.md#later-main-merge)). They were not re-run for this map.

| AC | Class | Tests | Notes |
| --- | --- | --- | --- |
| FH-R1.1 | direct | `ramp` "the prototype paths export exactly the canonical modules" | |
| FH-R1.2 | missing | none | No automated purity check. A source grep of `src/game/showdown/` for DOM, storage globals and Node imports found none on `cd764f1`; that is a one-off reading, not a test. |
| FH-R2.1 | browser | `B-entry` "Normal entry on a clean profile offers Play and the lane duel link only" | |
| FH-R2.2 | browser | `B-entry` "Play on a clean profile opens the Camp: Boot Hill open, the other five Trail duels locked"; `B-trail` Run A "Normal entry on a clean profile: Play opens the Camp…" | |
| FH-R2.3 | browser | `B-entry` "The Camp opens Trail duel 1, Boot Hill (Showdown), not the lane duel"; `B-trail` "Boot Hill opens from its Camp tile…", "Raven Roost opens from its Camp tile…", "The Bone Fence opens from its Camp tile" | |
| FH-R2.4 | browser | `B-entry` "Back to camp leaves an unfinished duel unrecorded…"; `B-trail` "Leaving The Bone Fence unfinished changes no stored progress" | |
| FH-R2.5 | browser | `B-entry` "?mode=lanes shows the lane menu, and Play opens the lane duel"; "?mode=match still auto-starts the lane duel…" | |
| FH-R3.1 | direct | `store` "a new profile loads as a new save and loading writes nothing" | |
| FH-R3.2 | direct | `store` "the v1 Trail save loads as migrate() and the legacy save code read it, and keeps its key"; `prog` "saves: the first version is carried over…" | |
| FH-R3.3 | direct | `store` "progress the next load would reset is refused and nothing is written" | |
| FH-R3.4 | direct | `store` "a stored save the load refused is kept once under its own key before it is replaced" | |
| FH-R3.5 | direct | `store` "blocked storage loads a new save and reports a failed save without throwing"; `camp` "the lane profile is left as it was, and blocked storage plays on in memory" | |
| FH-R3.6 | direct | `store` "an unclaimed card offer survives a reload, so it cannot be rolled again"; `B-trail` "Reload with the second offer unclaimed…" | |
| FH-R3.7 | direct | `store` "whatever loads can be exported and strictly imported back unchanged" | Progress only. See FH-R7.1. |
| FH-R3.8 | direct | `store` "a lane-era profile keeps its Captured cards owned in the lane store…"; `camp` "the lane profile is left as it was…"; `inh` first test; `B-trail` Run B normal-load check | |
| FH-R3.9 | direct | `plog` all three tests; `B-entry` "The Boot Hill win is logged once under cvw-showdown-playtest-v1…", "After a reload the Camp's Playtest report…", "Two wins, three reloads…" | |
| FH-R4.1 | direct | `prog`, unchanged since `0beb0d5` (before slice 2); passes through the re-exports | |
| FH-R4.2 | direct | `prog` "a cushion, then a ramp, all the way to the even match: bot players on 80 deals"; `scripts/verify-duel.mjs` discovers `prototypes/showdown/` | |
| FH-R4.3 | direct | `ramp` "the ramp's cushion: any legal play wins Trail 1 and 2 on 80 deals" | |
| FH-R5.1 | direct + browser | `inh` "a lane capture is owned by name in the Camp list…"; `B-trail` Run B "Normal load: the Captured Dragon is shown as owned…" | Node test checks `holdings()`; the "(from the lane game)" text is checked only by `B-trail` reading the Camp collection. |
| FH-R5.2 | direct | `inh` "the record only grows, and a damaged record is never overwritten"; `inh` "blocked storage keeps ownership in memory and says it was not saved" | |
| FH-R5.3 | direct | `inh` "the record persists on its own: reloads, a Trail win and a later lane-profile loss keep it" | |
| FH-R5.4 | direct | `inh` "a card owned in both games is listed once, at the Showdown count…"; `store` "an existing Showdown save is kept when a lane capture is also stored" | |
| FH-R5.5 | direct | `inh` "partial lane hunts and a clean profile create no record and write nothing" | |
| FH-R5.6 | direct | `store` "a lane-era profile keeps its Captured cards owned in the lane store across Showdown loads and saves" | |
| FH-R5.7 | browser | `B-trail` Run B, all four checks | The record assertion was added in `c74a7d6`; the pre-fix run failed as expected ([output](evidence/kiro-143-slice2-integrate/strict-runB-before-fix.txt)). |
| FH-R6.1 | browser + direct | `B-entry` "Boot Hill win pays Covered Wagon ×2 in place of Sheriff ×2…"; `B-trail` "Boot Hill won by clicks alone", "The Boot Hill win names its payment…"; `camp` "a fresh profile wins Trail duels 1 and 2…"; `prog` "a Trail win pays its card into the deck…" | Bot clicks, not a human. |
| FH-R6.2 | browser | `B-entry` "Choosing one offered card adds exactly one copy and clears the offer" | |
| FH-R6.3 | browser + direct | `B-entry` "The Camp marks Boot Hill won and opens Raven Roost", "Raven Roost win pays Outrider ×2…"; `B-trail` Raven Roost checks; `camp` first test | |
| FH-R6.4 | browser | `B-entry` "Back in the Camp the unclaimed offer comes first and every Trail tile is disabled"; `B-trail` "Reload with the second offer unclaimed…" | |
| FH-R6.5 | browser + direct | `B-entry` "After a reload the Camp keeps…", "The Camp choice clears the offer and opens The Bone Fence…"; `B-trail` "Reload: Boot Hill and Raven Roost won, The Bone Fence open…stored progress equal the reference"; `store` "Trail duels 1 and 2 each pay their card once…" | |
| FH-R6.6 | direct | `camp` "a loss pays nothing and gives the rematch one more Base orb, kept across a reload"; `prog` "a loss gives the rematch one more Base orb…" | |
| FH-R7.1 | direct (reference) | `keep` "save codes exclude keepsakes: a veteran's code equals a new player's…"; `B-trail` Run B checks that the record is in its own key | Uses `prototypes/showdown/savecode.js`; the graybox Camp offers no save code until slice 3. |
| FH-R7.2 | direct | `keep` "keepsake compat A1-A5" (14 cases), "a genuine Showdown bounty pays its Legendary to a lane veteran and a new player alike"; `store` "Fable F1: a lane capture gives no Showdown ownership, Trail progress, hunt or power"; `inh` first test | Fable's ruling, PR 148 issuecomment-7031816529. Until 2026-11-19 this row was "pending Fable F1/F2" and external A1 failed on 7 cases ([historical table](evidence/kiro-143-slice2-integrate/compat-A1-A5.md)). |
| FH-R7.3 | direct (reference) + todo | `keep` "partial lane hunts and lane Frontier cards do not carry into Showdown", "reference Start over resets Showdown progress only…"; `test.todo` "slice 3: the graybox Camp's own Start over…" | Start over is checked as the reference prototype's reset (`keep(newSave())`, `keepLog([])`); the graybox has none until slice 3. Until 2026-11-19 this row was "missing (open)". |

Not mapped, pending: human playtests of the first hour (clarity, fun, Camp wording). None run.

## Showdown card spec clauses (CARD-)

Maps clauses of `.kiro/specs/card-*/requirements.md` (IDs such as `CARD-WIZARD-HELLFIRE-07`) to tests
whose own literal title cites the ID. That is the only thing `scripts/trace.mjs` counts as proof
([how](evidence/dec4-trace.md#proof)), so this section lists exactly the IDs that appear in test titles
and nothing from prose, aliases or neighbouring tests. Written by hand on 2026-11-23 from
[`tests/game/card-specs.test.js`](../tests/game/card-specs.test.js), where the tests sit after the catalog
tests. Before them no test title cited any `CARD-` ID. Card values and rules are unchanged.

Each test builds a Showdown position with `createShowdown`, sets boards and hands, and
checks it with `legalActions`, `applyAction`, `canAttack`, `viewFor` or `presentEvent`. Expected values come
from the clauses. The properties use fast-check seed `20261123` and 150 runs. The first pass linked
20 card clauses, Lasso added seven, and the two traps added 16. `node scripts/trace.mjs --json` reports
45 clauses with named tests across all specs, including 43 card clauses. Six previously unnumbered
requirements from the retired lane duel have IDs `orb-duel/13.1` through `orb-duel/13.6`. Those six
remain unproven. The audit reports zero parser findings and zero unresolved references.

| IDs in the title | Class | Precise observable |
| --- | --- | --- |
| `CARD-COWBOY-LASSO-04` to `-08`, `-13`, `-14` | direct | In any slot with 1–4 orbs, the Wizard keeps its orbs and gains stun, the Lasso moves to discard, and one spell event announces the stun. The Wizard can take cover but cannot attack during its turn. Stun clears when that turn ends, and the Wizard can attack on its following turn. |
| `CARD-COWBOY-BEAR-TRAP-05`, `-06`, `CARD-WIZARD-HEX-05` to `-07` | direct | A second trap goes behind the first. The opponent sees a count of two and neither card identity, and the only set event names the side. The log says that side set a card face down. |
| `CARD-WIZARD-HEX-08`, `-10`, `-12`, `-14` to `-16` | direct | Against a troop, an exposed Base, or a Base targeted by a rider, the oldest Hex moves to the graveyard and produces one stopped trap event. The target keeps its orbs, the attacker has spent its action, the newer Hex stays face down, and the log reports the cancellation. |
| `CARD-COWBOY-BEAR-TRAP-07` to `-11` | direct | A Wizard with Bone Armor and 1–4 orbs attacks a covered Billy. The oldest trap springs first and deals two orbs of damage down to zero. A defeat leaves Billy untouched and sends Wizard and its armor to the graveyard. A survivor attacks with its reduced orbs. The newer trap stays face down. |
| `CARD-COWBOY-DEADEYE-04`, `CARD-WIZARD-SINGULARITY-14`, `CARD-WIZARD-HELLFIRE-13` | direct | A Deadeye kills a 1-orb Jack-o'-Lantern, a Singularity and a Hellfire kill a 1-orb Dynamiter, in any slot among random bystanders: every event is a `spell` event (no `laststand`), the victim is gone and in its owner's graveyard, and the caster's board is deep-equal to before. |
| `CARD-WIZARD-SINGULARITY-12`, `-13`, `CARD-WIZARD-HELLFIRE-11`, `-12` | direct | For a random Cowboy board, Cowboy trap row (none, one or two Bear Traps) and Wizard trap row: after the spell both trap rows are unchanged, no Cowboy trap card reached the graveyard, no `trap` or `attack` event, both Bases keep their orbs and the Wizard board is deep-equal to before. |
| `CARD-WIZARD-SINGULARITY-04`, `-05`, `-06`, `-15` | direct | The targets listed are exactly the non-Ghostly Cowboy troops in slot order, with a Covered Wagon (Guard) beside them. None are listed for an all-Ghostly or empty board, after a Wizard troop takes cover, or after Wizard gear is played. Each cast takes exactly 1 orb from its target, in cover or not, and leaves every other slot deep-equal. |
| `CARD-WIZARD-HELLFIRE-03`, `-07`, `-09`, `-10`, `-14`, `-15` | direct | For a random Cowboy board of at least one troop (Guard, cover and gear included) and one or two Hellfires in hand: exactly one action `{type, cardId}` with no `target`; events are one `spell` event per troop in slot order with its id and orbs left; each troop is 1 orb lower with its other fields unchanged, or gone at 0 with the troop and its gear, in slot order, as the whole Cowboy graveyard; the Wizard graveyard is the one Hellfire; each log line reads "The Wizards' Hellfire hit <name>: <n> orb(s) left." or "…: defeated." No Hellfire is offered once a Wizard troop has taken cover. |
| `CARD-WIZARD-HELLFIRE-05`, `CARD-WIZARD-SINGULARITY-07`, `-08` | direct | With every kind of play in hand, a Singularity or a Hellfire removes `spell`, `gear` and `location` from the legal actions and keeps `summon` and `set`. The other spell is then rejected as illegal, and a summon and a Hex set still go through without reopening the other-card play. |

Notes on what these rows do not claim:

- `HELLFIRE-03` is the offer with a Cowboy troop present. The shared other-card allowance is asserted under `HELLFIRE-05`. Its sibling `CARD-WIZARD-HELLFIRE-04` (no Hellfire on an empty Cowboy board) is an open design decision and no test asserts it either way. `HELLFIRE-03`'s "holds a Hellfire" half is not tested as an absence.
- `HELLFIRE-07`'s "in slot order" is asserted through the order of the `spell` events (and the graveyard order for defeats). The boards themselves cannot show an order.
- `SINGULARITY-04` to `-06` and `-15` take Guard and Ghostly from the catalog's `keys` (Covered Wagon, Captured Wraith). They do not re-derive those keywords.

Gaps that were already verified by an existing test that cites no `CARD-` ID. I did not cite these IDs, so they stay unproven in a trace:

| Clause | Existing assertion |
| --- | --- |
| `CARD-WIZARD-HELLFIRE-08` (Ghostly troops are hit) | `prototypes/showdown/rules.test.js` "Ghostly troops cannot be targeted by spells, but Hellfire still burns them": board health only. |
| `CARD-COWBOY-DEADEYE-05` (no gear after a Deadeye) | `prototypes/showdown/rules.test.js` "gear: a Six-Shooter adds 1 attack…" ("a spell uses it too"). |
| `CARD-WIZARD-HELLFIRE-16` to `-18` (replay and gallery) | `tests/match/showdown-3d-presentation.test.js` Hellfire gallery tests. Not re-read for this map. |
| Spell legality, events, orbs, Base and trap timing in general | `scripts/showdown-dec4-properties.mjs` properties `rb10-spells`, `rb2-frame`, `rb4-card-plays`, `rb7-traps`, `rb9-sweep-last-stand`. They run whole random games with no `CARD-` IDs, and a spell that defeats a Last Stand troop or hits a covered troop is reached only by chance. Their receipts are untouched. |

Still without a test that cites the ID, in the same spell and combat group: `CARD-WIZARD-HELLFIRE-01`, `-02`, `-04` (design decision), `-06` (hand to graveyard "before any orb is removed" is not visible in state or events), `-08`, `-16` to `-18`; `CARD-WIZARD-SINGULARITY-01` to `-03`, `-09` to `-11`, `-16` to `-22`; `CARD-COWBOY-DEADEYE-02`, `-03`, `-05`, `-06`; `CARD-COWBOY-LASSO-01` to `-03`, `-09` to `-12`, `-15` to `-17`; `CARD-WIZARD-HEX-01` to `-04`, `-09`, `-11`, `-13`, `-17`; `CARD-COWBOY-BEAR-TRAP-01` to `-04`, `-12` to `-17`; and every clause of the other card specs. `node scripts/trace.mjs --require CARD-` still exits 1.
