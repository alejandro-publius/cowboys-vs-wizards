# Kiro preview contracts (issue #44)

Author: Kiro CLI, assigned through Codex. Base: Rachel's frozen #40 head `4fb0f88eeb5109d38db367f1fbcaf4c4fe8589ce`. Date: November 2026 (America/Los_Angeles). Kiro IDs, credits and model details are not recorded because none were observed.

## What was added

| Path | Status |
| --- | --- |
| `.kiro/specs/clash-log-preview/` | Retrospective acceptance documentation for #29. Not spec-first: the code existed first. |
| `.kiro/specs/cpu-difficulty-preview/` | Plan for #34. Nothing implemented; all checks pending Rachel's work. |
| `.kiro/specs/guided-first-match/` | Plan for #35. Nothing implemented; all checks pending Rachel's work. Issues #19 and #20 were not read. |
| `tests/match/clash-log-properties.test.js` | Generated property suite for `clashLog`. |

The #34 and #35 briefs tell Rachel not to create `.kiro/` files. These specs were created because issue #44 assigns the folders to Kiro CLI. No file under `src/` changed.

## Property suite

Dependency-free seeded loop, not a property-testing library. **No shrinking exists.** On failure the message prints `replay: CLASH_LOG_SEED=<seed> pairing=<cowboy/wizard> batch=<n>`, the event and the line. No formal proof is claimed.

Cases (observed with a one-off count on this run): seeds 0 to 199 times four cpu/random pairings = 800 complete engine matches, 4,031 clash batches. Batches contain 3,037 with a simultaneous same-lane exchange, 4,528 Base hits, 8,300 troop hits, 1,722 spells (270 with a move) and 2,075 defeats. Deck is the engine default; rules version `orb-duel-draft-1`.

Properties, tied to `.kiro/specs/clash-log-preview/requirements.md`:

| Property | Requirement |
| --- | --- |
| Deterministic, and deep-frozen input is not mutated | CL-5 |
| One line per described event, in order; the integers on each line equal exactly the event's lane+1, before, after (and destination+1); card names on a line belong to that event | CL-2, CL-3 |
| Lane with damage in both directions gives both lines, and the two lines differ | CL-4 |
| Adding `hand`/`deck` fields to events changes nothing; draw events carry no card; a name not in any event does not appear | CL-3 |
| No `clash` event gives `null` | CL-1 |
| Coverage guard: all event kinds appear in the generated data | CL-6 |

Command and result (run once after the final correction):

```text
node --test tests/match/clash-log-properties.test.js
tests 6, pass 6, fail 0, about 1.2 s
```

One correction was needed before this: the first draft of the hidden-data property compared an event card id with a literal and failed on seed 4, pairing cpu/random, batch 3. That was a test defect (the card id is not `"dragon"`), not a clashLog defect. It was fixed to compare card names.

## Mutation evidence (not a production defect)

Isolated copy in ignored `.artifacts/mutation-clash-log/` containing `src/game`, `src/match/clash-log.js`, `scripts/play-match.mjs`, the new test and `package.json`. The fault, saved as `fault.diff` in that folder, drops every second damage event per lane before describing events, so a simultaneous clash loses its hit-back line.

| Run | Command (in the copy) | Exit | Result |
| --- | --- | --- | --- |
| Unmodified copy | `node --test tests/match/clash-log-properties.test.js` | 0 | 6 pass |
| With the fault | same | 1 | 4 pass, 2 fail: "one line per described event ..." and "a clash that damages both troops ...". First reported: `replay: CLASH_LOG_SEED=0 pairing=cpu/cpu batch=1 (line count)` |

The real `src/match/clash-log.js` was never edited (`git status` shows no change under `src/`). Raw outputs: `.artifacts/mutation-clash-log/{baseline,mutant}.txt`, `status.txt` (ignored, not committed). The existing seed 60 test was not run against the mutant, so this does not show whether it would also catch it.

## Pending

- `node scripts/verify-duel.mjs` was not run (docs and one new test only).
- CL-7 and CL-8 browser and screen-reader checks; all #34 and #35 checks; human playtests.
