# Trap T7: card conservation and deterministic property tests (issue #100)

Date: 2026-11-17 (America/Los_Angeles). Base: `main` at ac000c1, after T1 to T6
(#91, #93, #96, #98, #101, #102). Branch `kiro/trap-properties-100`. Work done
by Kiro in a Kiro CLI session; the coordinator reports CLI 3.4.0 and that
`--list-models` advertised `claude-opus-5.5`, and the session context names
`claude-opus-5.5` as the current model. The final Kiro V3 session stream reported **16.022394954892203 credits**
(session metadata, not a billing invoice). Headless tests only: no `src/`, renderer, card,
deck, config, CI or package change.

## Scope

One new test file,
[`tests/game/trap-properties.test.js`](../../tests/game/trap-properties.test.js),
for the opt-in A + X prototype in
[trap-prototype-contract.md](../submission/trap-prototype-contract.md)
(sections 2 to 6) and
[requirements](../../.kiro/specs/trap-zone/requirements.md) R1, R3 to R6, R8,
R9, R11 and R13 ([tasks](../../.kiro/specs/trap-zone/tasks.md) T7). No helper
file was added: the fixture is about 15 lines and stays local, as in the T3 to
T6 test files.

Fixture: anonymous trap IDs `test-fixture-t7-trap-<side>-1` and `-2`, kind
`trap`, defined only in the test file and passed through the explicit `cards`
option of `applyAction`, `legalActions` and `chooseAction`. Each opening is a
clone of `createMatch(seed, { traps: true })` with copy 1 added to each hand
and copy 2 inserted at a seed-dependent deck position, so each side holds 14
cards. The fixtures are extra cards outside the shipped 12-card decks. `CARDS`
and `DECKS` are unchanged, and a test asserts that no shipped card has kind
`trap`. **These runs are not balance evidence.**

## Properties and where they are checked

Reachable runs start from the injected opening and apply only actions from
`legalActions` or `chooseAction(publicState(...))`, each accepted by
`applyAction`. Probes are hand-built or deliberately corrupted states and are
labelled as probes in the test names.

| Property | Requirement | Checked in |
| --- | --- | --- |
| Per-side multiset of card types and of card IDs over deck + hand + board + trap + discard is unchanged after every accepted action. Multiplicity is compared, not global uniqueness: sheriff, skeleton, billy, wizard and the fixture type each have several copies | R6 | reachable cpu, reachable walk, all probes |
| Every card in a side's zones belongs to that side; boards hold only troops; the trap zone holds only a trap card; exactly 3 lanes; one trap zone per side (`null` or one `{ cardId, setRound }`, `setRound <= round`) | R1, R6 | same |
| Base orbs are integers in 0..5; troop health is in 1..printed health (at most 5) | orb rule, R1 | same |
| `applyAction` never mutates its input; rejections return the same object with no events; an accepted state is an independent copy; RNG is untouched | R6, R8 | reachable runs; rejection probe |
| A set requires an empty zone, an unused tactical action and round < 9, and records `{ cardId, setRound: round }` | R2, R13 | reachable runs |
| At every clash the `trap-trigger` events equal the expectation computed from the pre-clash board: only traps with `setRound < round`, `SIDES` order, highest printed attack (tie: lowest slot), `cancelled` equals that attack | R3, R4, R9 | reachable runs; both-armed probe; set-then-wait probe |
| Triggers come directly after `clash` and before any damage; the damage events are exactly the uncancelled troops in lane then `SIDES` order, each with its printed attack, so a cancelled troop deals nothing and no phantom damage appears | R4, R9 | same |
| A fired trap leaves the zone and adds one copy to its owner's discard; a trap that is unarmed, or armed with no enemy troop, stays as it was | R4, R6 | same |
| For each viewer, an opponent fixture ID appears in `publicState` or `publicEvents` only once it is in the opponent's discard; an opponent `trap-set` has no `cardId`; `trap-trigger` is public; own zone shows `{ cardId, setRound }` and the enemy zone `{ faceDown: true, setRound }` | R5 | reachable runs |
| The CPU's view is equal for a state with other hidden facts (seed, RNG, deck orders, one opponent hand card swapped with its deck, the other fixture copy in the opponent's face-down zone), so its choice cannot depend on them; `chooseAction` leaves its view unchanged | R11 | reachable cpu |
| Every emitted event type is one the T6 presenter plays (`summon`, `spell`, `damage`, `defeat` and the `DEFAULT_PAUSES` keys) | T6 contract | reachable runs, flag-off run |
| Replaying the recorded action list from a fresh opening gives identical events and final state | R8 | reachable runs (all 200 seeds, both modes) |
| Flag off: seeds 0 and 60 CPU matches contain no `trap` or `tactical` text and no trap event; flag on with no trap dealt gives the same events; seed 60 still ends `cowboy` by `base-destroyed` in round 9 at revision 40; `createMatch(0..199)` has no trap key | R8 | flag-off test |

Checker self-test: a probe applies 12 single corruptions (fixture vanished,
duplicated into discard, moved across sides, type swapped, second trap zone,
troop in the trap zone, trap card on the board, fourth lane, base 6, base -1,
troop above printed health, `setRound` in the future) and asserts that the
state checker fails on each, so a passing run is not vacuous.

Duplicate-ID probe: deliberately mutated (the engine never deals one ID twice)
with two copies of one fixture ID in a hand; set and trigger keep the count
at 2 and leave one copy in hand and one in discard.

Not repeated here: stale presenter callbacks after `reset()` and
`scheduler.advance()` are already covered by
[`tests/match/trap-presenter.test.js`](../../tests/match/trap-presenter.test.js)
("reset and scheduler.advance cancel a queued trap-trigger"); this file stays
in `src/game` rules and does not drive the presenter.

## Runs (this session, base ac000c1)

Seeds 0 to 199, rules version `orb-duel-draft-1+traps`, default decks plus 2
fixture traps per side. Seeded random walk: mulberry32 seeded `seed ^ 0x7a7`,
uniform over `legalActions` with the fixture catalog.

| Mode | Matches | Sets | Triggers | Armed clashes with no enemy troop | Endings |
| --- | --- | --- | --- | --- | --- |
| cpu (normal CPU both sides, public view) | 200 | 657 | 617 | 6 | base-destroyed: wizard 84, cowboy 74, draw 6; round-limit: cowboy 15, wizard 13, draw 8 |
| walk (seeded uniform legal actions) | 200 | 430 | 341 | 52 | base-destroyed: cowboy 90, wizard 86, draw 21; round-limit: wizard 2, cowboy 1 |

Probe sweep: both traps armed (round 2, `setRound` 1) for every pair of 0 to
3 troop boards drawn from each default deck (54 boards per side, at most the
one attack-3 copy), base orbs 5 and 1: 5,832 two-step rounds.

Recorded traces (SHA-256 of `[trace, events, final state]`, injected opening):

| Mode, seed | Actions | Sets | Triggers | Result | SHA-256 prefix |
| --- | --- | --- | --- | --- | --- |
| cpu 0 | 26 | 4 | 3 | wizard, base-destroyed, round 5 | 2e931bf4 |
| cpu 60 | 29 | 3 | 3 | wizard, base-destroyed, round 6 | 8b43ffbe |
| walk 0 | 11 | 1 | 1 | cowboy, base-destroyed, round 3 | 1f9623ca |
| walk 60 | 16 | 2 | 2 | wizard, base-destroyed, round 4 | 5187db0f |

These are estimates under these artificial conditions (a trap dealt to both
sides on turn 1, CPU that always sets when it can). They say nothing about
faction balance with a real trap card.

## Verification

- `node --test tests/game/trap-properties.test.js`: 9 tests, 9 pass, 0 fail,
  about 2.7 s. The first run had 6 failures from two test bugs (the expected
  trigger lacked `type`; the zone-shape check ran after the multiset count, so
  the "second trap zone" mutation threw a `TypeError` instead of an assertion).
  Both were fixed in the test; no engine failure was found and no failing
  seed exists to retain.
- `npm test` (`node scripts/verify-duel.mjs`) once: 295 tests, 295 pass, 0
  fail; GLB structure preflight 2 of 2 pass.
- `node scripts/check-links.mjs`: 167 Markdown files, 605 relative links
  and images, 0 broken. `git diff --check`: clean.

## Notes on the requested invariants

- "No duplicated or vanished fixture card" is checked as a per-side count of
  each fixture ID, not as global uniqueness, because the duplicate-ID probe
  shows the rules are copy-count based.
- "Trap card in exactly one of deck, hand, trap zone, discard" (R6) holds for
  each copy; the board check rejects a trap card on a lane.

## Remaining

The trap card name, art, copy count and deck migration (O1, O2) are still
blocked on the owner. Browser replays were not re-run: this change is
tests and docs only.


## Independent coordinator verification and authorship

After the Kiro-authored e1261e3 commit and the worker's runFinished
stream event, the coordinator inspected the new test file and evidence;
the code checks conservation **by multiplicity**, so legitimate repeated
card types are not incorrectly rejected.

Independent commands rerun against base ac000c1:

- node --test tests/game/trap-properties.test.js: **9/9 pass**.
- npm test: **295/295 Node tests pass**, plus 2/2 GLB structural
  checks (not animation quality).
- node scripts/check-links.mjs: 167 Markdown files, 605 links,
  **0 broken**.
- git diff HEAD^ HEAD --check: **pass**.
- Kiro V3 stream: runFinished, selected model claude-opus-5.5
  and 16.022394954892203 reported session credits.
- Remote main base: ac000c1821adf4d0ebc09329637892083d305e47.

This coordinator evidence update is separate from Kiro's authored tests.
No headless finding is a human balance or graphics/playability result.
