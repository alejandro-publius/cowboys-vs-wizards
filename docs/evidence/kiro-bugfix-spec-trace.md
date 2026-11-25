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
| Index | `scripts/trace.mjs` `parseBugfix`, `collect` | Reads `bugfix.md` only where `.config.kiro` declares a bugfix spec. Expected (2.N) and Unchanged (3.N) lines are clauses. Fails closed: a `.config.kiro` that isn't JSON, or a bugfix spec without `bugfix.md`, exits 2. A clause without SHALL, a number that doesn't match its section, a numbered SHALL line outside the two sections, or no clause at all is a problem (exit 1) |
| Independent check | `tests/game/showdown-bear-trap.test.js` | The three seeded tests now cite 2.1, 3.1, 3.2, 3.3 and `CARD-COWBOY-BEAR-TRAP-14`. A fast-check property (seed `0x1b3a`, 300 runs) proves 2.2 and 3.6 against a line built from the card table. It also shows that the pre-fix ordering fails, with the bug condition (`left` 0, `stopped` true) as its counterexample. A test over seeds 0–79, with no clause cited, checks the trap event the line reads: its exact fields, the contract text, that a Bear Trap stops exactly at 0, and that a Hex always stops with the attacker standing |
| Linkage gate | `tests/game/dec4-trace.test.js` | Three tests: the bugfix grammar on a fixture, the CLI metadata rule and its exit-2 cases in a temporary root, and the live checkout. The live test expects 8 clauses, no problems, and 2.1, 2.2, 3.1–3.3, 3.6 and `CARD-COWBOY-BEAR-TRAP-14` linked to the Bear Trap tests |
| Receipt | [showdown-bear-trap.md](showdown-bear-trap.md) | Its 80-seed corpus digests, re-run below on this tree |

No rule, card, presenter, wording, UI, CI workflow, spec text or hook changed.

## Observed

- `node --test tests/game/showdown-bear-trap.test.js`: 5/5 passed.
- `node --test tests/game/dec4-trace.test.js`: 11/11 passed (8 existing, 3 new).
- `node scripts/trace.mjs --require showdown-bear-trap-log/2. --require showdown-bear-trap-log/3.`: 45 specs, 728 clauses, 63 proven, 665 orphans, 0 duplicates, 0 problems, 0 unresolved. `2.`: all proven. `3.`: 3.4 and 3.5 unproven. The plain `node scripts/trace.mjs` still exits 0.
- Mutation probe: with the presenter temporarily put back to `stopped` first (the pre-fix order), the 2.1 and 2.2 tests failed and the other three passed. The edit was reverted, and `git status` shows no change under `src/`.
- `node scripts/showdown-trap-corpus.mjs . .` (the existing harness, run on this tree against itself): 80 seeds, 1,026 turns, 4,934 events and lines, 100 traps, 12 fatal.
  - Raw digest: `5618efb57f450433b5a2be3ba75c09796f554fbbb9ac46c37e43189c602e578a`, equal to the receipt's.
  - Lines digest: `5ff360aca06242527d72c053756546ff7e0db75a64ac2e83fb522f056e2847ae`, which matches the receipt's shortened "new" value (`5ff360ac…847ae`).
  - The harness then printed `FAIL 12 fatal trap lines but 0 changed lines`. That is expected when one tree is compared with itself, because the script requires the fatal lines to differ between parent and new.

## Independent review

One read-only reviewer ran as Claude Code Workflow `wf_6168780d-e7e`. This was not a Kiro run. It re-ran the two test files (16/16), the trace with both gates, `node --version` and the corpus harness. Its results matched this note. Its findings and what happened to them:

1. **Important, fixed:** 3.4 was over-claimed. "The same values as before" is about the pre-fix tree, just like 3.5, and the 80-seed test doesn't check `side`, `target` or the orb loss against game state. The test no longer cites 3.4.
2. **Nit, fixed:** the test checked only `left > 0` but claimed "Hex takes none". The wording now says the Hex leaves the attacker standing.
3. **Nit, fixed:** a sub-heading inside a behavior section, or a numbered SHALL line outside one, could drop a clause with no problem reported. A deeper sub-heading now stays inside its section, and a numbered SHALL line outside the sections is reported. The fixture covers both. Two cases stay as documented limits in [dec4-trace.md](dec4-trace.md): an indented numbered line continues the clause above, and an unclosed fence hides the rest of the file.

The reviewer couldn't check the 44/720/56 figures for `9b45272`, which I observed before editing, or the presenter mutation probe, which needed a temporary edit under `src/`.

## Limits

- **3.4 and 3.5 stay unproven.** 3.4 says the trap event keeps "the same values as before", and 3.5 says no other event's text changed. Both compare with the pre-fix tree, and CI checks out one commit, so a test can't reach the parent. The receipt measured both once. The raw state and event digest was equal between parent and fix, and only the 12 fatal trap lines changed. The matching digests above tie those measurements to this tree for those 80 seeds only.
- A trace shows that a test cites a clause. It does not show that the test proves the clause. The mutation probe is a single run on the real presenter.
- In a native `bugfix.md`, SHALL prose outside the Expected and Unchanged sections is not checked; only numbered lines there are. The native introduction restates 2.2 in prose. The hand-written `showdown-camp-return-focus/bugfix.md` uses another layout and has no `.config.kiro`, so it is still not read.
- This check doesn't change the open empty-board Hellfire question.
