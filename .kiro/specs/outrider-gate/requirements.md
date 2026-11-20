# K-011 Outrider decision gate: requirements and acceptance

Owner of this spec: gate worker (Kiro CLI). Design owner: Fable. This is an experiment for review in the graybox
Camp. It changes no rule, card, deck, Trail setting, reward or saved career, and it is not advice or a bounty.
Fable decides whether any case becomes advice or a bounty.

Inputs come from the search worker (`experiments/showdown-outrider/decision/`, interface in `../gate-contract.md`
outside this repo). A claim is: "at case X, the ride arm and the fight arm each end as `results.json` records,
under the recorded continuation policy and the shipped Trail bot".

## Requirements

- **G1 Semantic freshness.** A claim is fresh only when both arms, replayed through the shipped session in the
  current tree, reach the measured outcome (winner, final turn, both Bases) and the line recorded in the receipt
  (sha256 of each arm's event transcript). File hashes are recorded but decide nothing.
- **G2 Fail closed.** Missing files, a missing receipt, a throw, an illegal arm or continuation action, or any
  difference makes the claim stale. A stale or missing claim ships no Camp control and no `?outrider=` link.
  The rest of the game builds and plays unchanged.
- **G3 Mutation and control.** A genuine gameplay change that alters an arm is stale even after the receipt's
  source hashes are refreshed, and the receipt writer refuses it. An unrelated edit stays fresh.
- **G4 Public payload.** The page carries only the verified cases' setup (id, Trail position, seed, Cowboy
  prefix, turn). No outcome, transcript, arm label or result reaches the page. The landing view has no seed and
  shows the Wizard hand, deck and traps as counts only.
- **G5 Neutral presentation.** Control labels and lesson text name no outcome, recommendation or seed. Before the
  player chooses, the screen offers the Base and the troops as the normal game does.
- **G6 Save isolation.** Opening, choosing, Restart, Retry, Back to camp, direct URL and reload leave a saved
  career byte-identical. Only a verified id opens; any other `?outrider=` value opens the normal menu.
- **G7 Native hook.** A PostFileSave hook runs the gate check on saves of the engine, session, decision files and
  receipt, and does not run for unrelated files. Native triggers are recorded with the Kiro session id; manual
  runs have none.
- **G8 No invented fallback.** Without frozen cases from the search worker the build ships no Outrider control.
  Test fixtures are labelled and only build into `.artifacts/`.

- **G9 Curated presentation (repair).** The Camp shows one neutral Outrider control (case-e). The collapsed Sheriff's
  Ledger shows two opposite reversals (case-e fight-only, case-a ride-only) as public positions with links to the same
  ids; measured results and the search's limits appear only after an explicit reveal, only when both are fresh. All
  measured cases stay in the research record and the gate check.
- **G10 Night Watch relation.** The Ledger states whether the engine files the checked-in Night Watch receipt ran are
  byte-identical in this build (and its rules blob), keeps that receipt's date, source, bot, seeds and "whole ruleset"
  limit, and names the Outrider files it did not exercise. It never uses the ruleset shares as evidence about one move.
- **G11 Stale Ledger.** When stale: a readable status, no results or research numbers, no reveal, no links.

## Acceptance mapped to proof

| Req | Proof | Status |
| --- | --- | --- |
| G1 | `tests/match/showdown-outrider-gate.test.js` "positive"; `node scripts/outrider-gate.mjs --check` | passed: fixture, and 10/10 imported cases (both arms) |
| G2 | same test file "fail closed", "changed branch outcome"; browser check on the no-case build | passed |
| G3 | same test file "genuine gameplay mutation", "negative control" (disposable copy of `src/`); clean-worktree mutation on the real cases | passed |
| G4 | same test file "build ships nothing...", "only a verified id opens" | passed |
| G5 | same test file; `scripts/browser-showdown-outrider-check.mjs` lesson and label asserts | passed: fixture page and real-case build |
| G6 | `scripts/browser-showdown-outrider-check.mjs` (headless Chrome, fresh profile) | passed: 85 checks on the clean c4e9723 build with the 10 cases |
| G7 | `.kiro/hooks/check-outrider-gate.json`, `.artifacts/outrider-gate-hook/receipts.jsonl` | native trigger and skip observed, see evidence |
| G8 | `npm run build` log line; browser check "Camp shows no Outrider control" | passed |

| G9 | `tests/match/showdown-outrider-gate.test.js` "imported search cases", "Ledger section"; browser check Ledger steps | passed (clean ce6bdfe, 23/23) |
| G10 | same tests; build receipts fresh/unrelated/stale in `docs/evidence/outrider-gate/` | passed: same 4 files at ce6bdfe; differs after rules edits |
| G11 | same tests; browser check on the mutated build (6/6); native hook receipt "Ledger: stale" | passed |

Evidence and exact commands: [`docs/evidence/outrider-gate.md`](../../../docs/evidence/outrider-gate.md).
