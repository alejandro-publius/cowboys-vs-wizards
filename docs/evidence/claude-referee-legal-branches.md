# Legal-branch referee audit: wire forms and listed-order tributes finished

2026-11-25 (America/Los_Angeles). Claude Code, model claude-opus-5-5. This finishes the held audit in `scripts/referee/legal-branches.mjs`, started at checkpoints `45a6817` and `22cb291` (from `e6386173`). It changes no frozen referee file (`proof/referee/`), no Showdown rule and no corpus file. The empty-board Hellfire question (C1) stays open for Fable (issue 143). It is counted and not classified any differently.

## What changed

- **Wire forms (F1, F2).** A summon with no `tributes` field no longer crashes `classify`. For every F1 and F2 candidate, `byForm` compares the referee's full result (verdict, error code and state digest) with its result for the exact canonical counterpart. Any difference counts as `refereeDiffersFromCanonical` and makes the report fail. A disagreement is classed F1 or F2 only when engine.mjs refuses the wire form, the referee's result equals the canonical one exactly, and both sides accept the canonical action with equal states. It is classed F1+C2 or F2+C2 only when that canonical action is itself C2. Anything else is unexplained.
- **C3 by digest, every branch.** `listedOrderView` builds the only difference ruling R6 allows. It starts from the referee's own state for the slot-order list. That state is either the engine's state, when the two digests are equal, or for a later copy the referee's full state from the oracle. It finds the tributed troops, each followed by its gear, as one block in the summoner's discard and reorders the block into the listed order. Nothing else changes. C3 and C2+C3 are named only when the referee's digest equals that expected state. If the block is missing, split, incomplete or ordered differently, or any other field differs, the branch stays unexplained.
- **C2+C3.** The corpus deck lists hold one copy of each two-tribute troop (Mounted Billy, Gatling Crew, Dragon), so the corpus never reaches C2+C3. A test duel with two Dragons drives that path against the real referee.

## Controls (tests/game/referee-legal-branches.test.js, 14 tests, all pass, 11.4 s)

- In unit tests, the following are all unexplained: the slot order kept, gear before its troop, the listed order with one other field changed, no listed-order evidence, an engine state that moved, sides that disagree on the slot-order list, and the first copy's state used for a later copy.
- In end-to-end runs on the quick corpus against the frozen referee, three wrong listed-order rules were swapped in: the slot order kept, the listed block reversed, and one other field changed. Under each, every real C3 becomes unexplained (C3 + C2+C3 = 0, unexplained = baseline + the former C3 count). An engine that put a two-tribute discard block out of order produces unexplained different-state branches.
- The seed 5 F1/F2 case, the seed 109 C1 opening and the older refused-cover and wrong-base controls also pass.

## 100-duel trials (4 referee processes, about 7 s each)

| Corpus | Main line | Candidates | Disagreements | C1 | C2 | C3 | C2+C3 | F1 | F1+C2 | F2 | F2+C2 | Unexplained |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| frozen, seeds 1–100 (`--limit 100`), run twice | 5,086/5,086 | 274,273 | 6,775 | 39 | 749 | 469 | 0 | 2,612 | 488 | 2,418 | 0 | 0 |
| holdout smoke, seeds 1000000–1000099 | 5,204/5,204 | 280,863 | 6,307 | 39 | 783 | 430 | 0 | 2,622 | 581 | 1,852 | 0 | 0 |

In the frozen trial, both sides accepted 22,920 candidates with equal states and both rejected 244,578. F1: 14,482 candidates, all equal to their canonical form. F2: 11,106, all equal. The engine accepted no wire-form candidate. There were 0 referee crashes, 0 Duel.run self-check failures and 0 engine self-check failures. In the sampled C3 diffs, only `players.<side>.discard[i]` paths differ. Both frozen runs produced identical counts.

The earlier 6.47M-candidate result was produced before this fix. It carried no wire forms and no listed-order digest check, so it is superseded.

## Run the full audits

```sh
node scripts/referee/legal-branches.mjs --out .artifacts/referee/legal-branches-frozen.json
node scripts/referee/legal-branches.mjs --seed-start 1000000 --count 10000 --out .artifacts/referee/legal-branches-seeds-1000000.json
```

Exit 0 means pass, 1 an unexplained disagreement or other problem, and 2 a failed precondition. Only the full frozen run also checks the regenerated input digest against `freeze.json`.
