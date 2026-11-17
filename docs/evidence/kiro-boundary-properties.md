# Boundary property tests and requirement traceability

Resource-checklist items 5 (property tests around boundaries) and 12 (honest requirement-to-test traceability).
Nothing under `src/`, `package.json`, `.github/` or the existing specs was changed. No game rule, asset, animation or UI was touched.

**Attribution.** Work done in a Kiro session that the coordinator launched as Kiro CLI. The session's own metadata names its client "Kiro IDE", so the coordinator should confirm the CLI attribution from the original CLI session record. I make no claim about IDE features and none about visual or human approval.
**Base.** `4c0723df30d7c4080ea6724441aac2a9b036c817` (branch `kiro-boundary-properties-56`), Node v26.0.0, Darwin 24.1.0 arm64. Rules version `orb-duel-draft-1`.

## Plan: properties against acceptance criteria

Existing coverage checked first (`invariants`, `custom-deck-simulation`, `cpu`, `deck-builder`, `match`, `summon`):

| Already covered | Gap this batch fills |
| --- | --- |
| 200 seeded legal-action walks on the default decks; 128 sampled custom decks played to a result; invariants after each action | Every one-Sheriff and six-copy composition (103), plus one step outside each boundary |
| Hand-written full-board tribute and spell examples; hand-listed invalid actions | Generated states: every card, tribute set and slot on a full board; about 40 invalid-action categories over constructed and reachable states; every spell target and destination |
| Hidden-information test: opponent hand and deck **reversed**, seeds 0-49, default decks | Random permutations of the opponent's hand and deck pool, the CPU's own deck order, seed and rng, at all three levels, on custom-deck, constructed and mid-match states |
| Example clashes (mutual defeat, base zero, tie) | An order-independent oracle over 400 generated clashes, lane-mirror equivalence, and counts of the boundary each case reached |
| One replay-twice test | An accepted-action log replayed from the same start with rejected and repeated actions interleaved |

| Property | Acceptance criteria | Cases |
| --- | --- | --- |
| BP-DECK | R1.1, R1.6, R1.7, R1.8, R11.1, deck rules | 103 (all of them) |
| BP-TRIBUTE | R3.1 to R3.6, R1.6 | 120 |
| BP-REJECT | R3.2, R3.4, R3.7, R3.8, R6.2, R6.4, R6.7, R8.3, R8.4, R8.6, R10.4 | 150 |
| BP-SPELL | R8.1 to R8.6, R6.2, R1.6 | 200 |
| BP-CLASH | R7.1 to R7.6, R10.1 to R10.4, R5.8 (engine side) | 400 |
| BP-REPLAY | R11.3, R6.7, R3.7, R1.6, R1.7 | 80 |
| BP-CPU | R9.1, R9.2, R9.4 | 150 |

Test names carry these IDs. "Deck rules" means the 12-card, six-copy, one-Sheriff rules of the deck builder, which are not in the orb-duel spec.

## Generators and invariants

- **Reachable states.** `createMatch(seed, { cowboyDeck })` for a random valid composition, then 0 to 20 random legal actions.
- **Constructed states.** Cards from a real deck are redistributed across deck, hand, discard and boards, with random troop health 1 to max and base orbs 1 to 5. `checkState` runs on every one. They need not be reachable from `createMatch` (for example a round-6 position with an empty deck and a full board). They are legal engine inputs by the explicit invariants, not proven reachable.
- **Invalid actions** are a separate mutation layer (`mutations.js`). The state stays legal, one field of one action is broken, and each case names the exact rejection reason.
- **Invariants** (`invariants.js`): each card ID in exactly one zone of its own side; troop health 1 to max (at most 5); base orbs 0 to 5; board length 3; result and active side consistent; per accepted action: revision plus one, seed and rng unchanged, input state unmodified, action ID recorded. Per rejected action: the exact reason, the same state object returned, a byte-identical JSON copy, and an identical outcome for the next legal action compared with an untouched copy.
- **Oracles.** The clash oracle sums what each target takes and clamps once, so it does not share the engine's per-attack loop. The spell oracle is written from R8.1 to R8.4.
- **CPU boundary.** `hiddenTwin` replaces everything the viewer may not know. The test checks that `publicState` is identical for the twin, that every level picks the same legal action, and that the view is not mutated. The CPU's own hand order is visible, so it is never permuted.

## Boundary categories actually reached

Recorded base seed `0xB0DA` (45274). Full counts: [`category-counts-seed-45274.json`](boundary-properties/category-counts-seed-45274.json), produced by `node scripts/replay-boundary-case.mjs --summary`. Each property declares the categories it must reach, and the test fails if one is missing. The check is "reached at least once"; it sets no count floor. 100 category tags are declared and all were reached, none unexercised. Excerpts:

| Property | Reached (cases) |
| --- | --- |
| BP-DECK | one Sheriff 33, six-copy cap 88, both at once 18, seventh copy refused 88, no Sheriff refused 33, 11 and 13 cards refused 103 each |
| BP-TRIBUTE | cost-1 summon into a vacated slot 69, cost-2 63, zero-cost blocked on a full board 73, non-vacated slot refused 100, both boards full 27 |
| BP-REJECT | 38 invalid-action categories, 145 states with at least one rejection; 75 constructed, 70 reachable. Rarest: destination for a defeated target 7, destination occupied 11 |
| BP-SPELL | one-orb Deadeye kill 91, one-orb Singularity kill 90, one-orb target with destination refused 181, survivor relocated 17, caster board empty 67, second cast refused 38 |
| BP-CLASH | mutual lane defeat 181, defeated attacker still attacks 283, overkill without base spill 211, base exactly zero 120, base clamped 88, both bases zero (draw) 29, one base zero 171, round-limit tie 99, round-limit decided 27, match continues 74, no troops 29 |
| BP-REPLAY | 40 reachable starts, 40 constructed, rejected action interleaved 68, all 80 played to a result and replayed identically |
| BP-CPU | 134 decision points per level at easy, normal and hard; enemy hand differs by card name 121; custom boundary deck 111; own board full 18; enemy holds a spell 71 |

Counts are cases or decision points, not distinct games, and are estimates of generator reach, not of how often players meet these states.

## Replay

```
node --test tests/game/boundary-properties.test.js                       # recorded seed
BOUNDARY_SEED=12345 node --test tests/game/boundary-properties.test.js   # another stream
node scripts/replay-boundary-case.mjs --property BP-CLASH --index 17     # one case, categories printed
node scripts/replay-boundary-case.mjs --summary                          # all category counts
node scripts/replay-boundary-case.mjs --fixture docs/evidence/boundary-properties/shrink-m1.json --which minimized --engine m1
```

A failure reports `[<property> case <n>] <kind>: <message>`, and `--property <id> --index <n>` regenerates exactly that case (the case stream is a hash of base seed, property and index). Other `BOUNDARY_SEED` values were also run once each: 1, 2, 3, 7, 99, 12345 and 777777 before a generator change, then 2, 5, 6, 8 to 15 and the recorded seed after it. The only failure was a rare category (`no-troops-clash`) missing at seed 2. I raised its reach (6 percent of clashes start with empty boards) and every later run passed. No seed produced an engine failure.

## Failure reduction

`shrink.js` reduces `{ starting state, actions }` inputs. Actions carry no revision or ID, which are stamped on replay, so deleting an action leaves the rest replayable. A candidate is accepted only if (1) its start passes `checkState`, (2) the unmodified engine accepts every action and holds every invariant, and (3) the engine under test breaks the same invariant kind. Moves: delete actions, delete cards, delete troops, hand the phase to the first remaining action's side, set base orbs to 5, set troop health to 1. Budget: 3000 candidate runs.

**Harness verification, not a product bug.** The engine under test is disposable mutant **M1** (`mutants.js`, test code only): a two-tribute summon drops its second tribute card from the discard. A generated random walk fails on it (conservation) at step 6. Reduction result, receipt in [`shrink-m1.json`](boundary-properties/shrink-m1.json):

| | Original | Minimized |
| --- | --- | --- |
| Actions | 7 | 5 |
| Cards in all zones | 24 | 5 |
| Troops on boards | 5 | 2 |
| Mutant M1 | violation, `conservation`, step 6 | violation, `conservation`, step 4 |
| Unmodified engine | pass | pass |

Candidate runs used: 58 of 3000. The reduction is locally minimal for these moves, not a proven global minimum. The five remaining actions are a real dependency chain: the Wizard's summon blocks a lane so that the clash does not end the match, the Singularity moves a Cowboy troop to slot 0, and the Cowboy's tribute list `[0, 2]` then names the moved troop and the other one. The reducer does not rewrite action arguments, so it cannot shorten that chain. Data (cards 24 to 5) shrank more than actions (7 to 5). The test regenerates the demonstration and compares it with the committed receipt, so a drift in the generator or reducer fails the test with the command that refreshes the file.

**Detection by mutant** (all `HARNESS-VERIFY` tests, each failing the stated property on the first case it reaches):

| Mutant | Caught by | As |
| --- | --- | --- |
| M1 drops a second tribute card | BP-TRIBUTE | `tribute-discard` |
| M2 a rejection advances the RNG | BP-REJECT | `atomicity` |
| M3 accepts a destination for a one-orb Singularity target | BP-SPELL | `rejected` |
| M4 both bases at zero reported as a Cowboy win | BP-CLASH | `result` |
| M5 events carry `Math.random()` | BP-REPLAY | `replay` |
| M6 CPU reads the opponent's hand | BP-CPU | `cpu-information-leak` |

Six mutants show that those properties can fail. They do not show that every real fault would be caught.

## Findings

- **No product bug found.** Every property held on the real engine at the recorded seed and on the extra seeds above. Nothing to preserve or minimize.
- **Harness faults I fixed during development, not engine faults:** an invalid-action case built from a state that the intervening action had ended (reason `match-over`, not `stale`); and the `no-troops-clash` category too rare at seed 2.
- **Spec contradictions** are listed in [`docs/requirement-test-map.md`](../requirement-test-map.md): custom decks versus R1.1, opening policies versus R1.3, the CPU levels versus R9.2 and R9.6, and the stale Asset Gaps list.
- **Gaps surfaced by the map:** no engine-level test that `createMatch` throws on a missing or non-integer seed (R1.9); nothing asserts that `src/game/` has no DOM, filesystem or network imports (R11.2, observed once by grep); no timing-free assertion for R6.5.

## Checks run

Commands run from the worktree root. Exit codes are as observed.

| Command | Result |
| --- | --- |
| `node --test tests/game/boundary-properties.test.js` | exit 0, 15 tests, 15 pass, 0 fail, about 0.4 s |
| `npm test` (`node scripts/verify-duel.mjs`), run once after the docs were written | exit 0, 206 tests, 206 pass, 0 fail, 0 skipped, about 5.8 s, then the Dragon and Mounted Billy GLB structure preflight passed (2 of 2) |

Not run: the browser replay (`--browser`), renderer build, any visual or human check.

## Limits

- Property tests sample. Passing at one seed and a dozen others is not a proof, and generator reach is limited to the categories listed.
- Constructed states are legal by invariant, not by reachability. A bug that appears only in a state the engine can never reach would not matter, and one reachable only by a long play-through may not be generated.
- The CPU test checks decisions for the generated positions. It does not prove the CPU code cannot read hidden data in some other way, such as a cache that outlives a call.
- Only the engine and CPU are covered. The Presenter, controller, selection and renderer acceptance criteria have no new tests here.
- `docs/requirement-test-map.md` was written by hand. Rows matched only by test title are marked as such.
