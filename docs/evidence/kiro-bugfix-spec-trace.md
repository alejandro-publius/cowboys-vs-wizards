# Native Kiro bugfix spec linked to the shipped Bear Trap log decision

Date: 2026-11-25 (America/Los_Angeles). Author: Claude Code (Claude Opus 5.5), local CLI session in its own worktree, branch `claude/competitive-kiro-20261125`, based on `main` `9b45272`. Node v26.0.0.

**This was not a Kiro run.** No Kiro hook, workflow or spec task ran, and no Kiro credits were used. The native Kiro artifact here is the existing bugfix spec. [Kiro IDE 1.4.178's Bug Fix flow](showdown-bear-trap.md#native-spec-and-independent-check) produced it on 2026-11-20. Everything below is a CLI check of that spec, which was left unchanged.

## Gap

The shipped decision: Fable approved this fix, and `a4472f3` made the Showdown log say "defeated before it struck" when a Bear Trap takes an attacker's last orb, by checking `left === 0` before `stopped` in `src/game/showdown/presenter.js`. The fix was specified by the only spec in `.kiro/specs/` whose `.config.kiro` says `"specType": "bugfix"`: [`showdown-bear-trap-log/bugfix.md`](../../.kiro/specs/showdown-bear-trap-log/bugfix.md).

Before this change, `scripts/trace.mjs` read only `requirements.md`. So that spec had no indexed clause and no linked test, and `--require showdown-bear-trap-log/` could only report that no clause has the prefix. On `9b45272` the trace reported 44 specs, 720 clauses and 56 proven, with none from this spec. Its three seeded tests cited no ID, so `CARD-COWBOY-BEAR-TRAP-14` (the same log line in the card spec) was also an orphan.

## Change

| Link | Where | What it checks |
| --- | --- | --- |
| Requirement | `bugfix.md` 2.1, 2.2, 3.1–3.6 (unchanged) | Kiro IDE output. `.config.kiro` marks it as a bugfix spec |
| Index | `scripts/trace.mjs` `parseBugfix`, `collect` | Reads `bugfix.md` only where `.config.kiro` declares a bugfix spec. Expected (2.N) and Unchanged (3.N) lines are clauses. Fails closed: a `.config.kiro` that isn't JSON, or a bugfix spec without `bugfix.md`, exits 2. A clause without SHALL, a number that doesn't match its section, or no clause at all is a problem (exit 1) |
| Independent check | `tests/game/showdown-bear-trap.test.js` | The three seeded tests now cite their clauses. A fast-check property (seed `0x1b3a`, 300 runs) proves 2.2 and 3.6 against a line built from the card table, and also shows that the pre-fix ordering fails with the bug condition (`left` 0, `stopped` true) as its counterexample. A test over seeds 0–79 proves 3.4 (event fields, Bear Trap stops exactly at 0, Hex always stops and takes none, contract text) |
| Linkage gate | `tests/game/dec4-trace.test.js` | Three tests: the bugfix grammar on a fixture, the CLI metadata rule and its exit-2 cases in a temporary root, and the live checkout (8 clauses, no problems, 2.1, 2.2, 3.1–3.4 and 3.6 plus `CARD-COWBOY-BEAR-TRAP-14` linked to the Bear Trap tests) |
| Receipt | [showdown-bear-trap.md](showdown-bear-trap.md) | Its 80-seed corpus digests, re-run below on this tree |

No rule, card, presenter, wording, UI, CI workflow, spec text or hook changed.

## Observed

- `node --test tests/game/showdown-bear-trap.test.js`: 5/5 passed.
- `node --test tests/game/dec4-trace.test.js`: 11/11 passed (8 existing, 3 new).
- `node scripts/trace.mjs --require showdown-bear-trap-log/2. --require showdown-bear-trap-log/3.`: 45 specs, 728 clauses, 64 proven, 664 orphans, 0 duplicates, 0 problems, 0 unresolved. `2.`: all proven. `3.`: 3.5 unproven. The plain `node scripts/trace.mjs` still exits 0.
- Mutation probe: with the presenter temporarily put back to `stopped` first (the pre-fix order), the 2.1 and 2.2 tests failed and the other three passed. The edit was reverted, and `git status` shows no change under `src/`.
- `node scripts/showdown-trap-corpus.mjs . .` (the existing harness, run on this tree against itself): 80 seeds, 1,026 turns, 4,934 events and lines, 100 traps, 12 fatal.
  - Raw digest: `5618efb57f450433b5a2be3ba75c09796f554fbbb9ac46c37e43189c602e578a`, equal to the receipt's.
  - Lines digest: `5ff360aca06242527d72c053756546ff7e0db75a64ac2e83fb522f056e2847ae`, which matches the receipt's shortened "new" value (`5ff360ac…847ae`).
  - The harness then printed `FAIL 12 fatal trap lines but 0 changed lines`. That is expected when one tree is compared with itself, because the script requires the fatal lines to differ between parent and new.

## Limits

- **3.5 stays unproven.** It says no other event's text changed "as before", so it is about the pre-fix tree. CI checks out one commit, so a test can't reach the parent. The receipt measured it once: between parent and fix, only the 12 fatal trap lines changed. The matching digests above tie that measurement to this tree for those 80 seeds only.
- A trace shows that a test cites a clause. It does not show that the test proves the clause. The mutation probe is a single run on the real presenter.
- In a native `bugfix.md`, SHALL text outside the Expected and Unchanged sections is not checked. The native introduction restates 2.2. The hand-written `showdown-camp-return-focus/bugfix.md` uses another layout and has no `.config.kiro`, so it is still not read.
- This check doesn't change the open empty-board Hellfire question.
