# Release readiness: referee and Wizard lesson candidate

Written by a native Kiro CLI worker (claude-opus-5.5, agent `swarm-21-release-evidence-index`) on 2026-11-23, America/Los_Angeles. The worker had only read and write tools, so nothing was rerun and no hash was computed. Every value below is copied from the file it cites. Timestamps ending in `Z` are UTC, as written in the receipts.

**Verdict: not releasable.** This note claims no deployment, no passing full suite, and no footage for this candidate. The [disagreement triage](kiro-referee-disagreement-triage.md) is a separate note owned by another worker.

## 1. Referee first run (current)

| Item | Value | Source |
| --- | --- | --- |
| Receipt key | `6e2f2f90…a16fcd6`, `kind: "first-run"`, file mode read-only | `proof/referee/receipts/first-run-6e2f2f904791e114e177577277ca4efee52a59b2d9b1e23d751daba2fa16fcd6.json` |
| Run | 2026-11-23T07:32:59Z to 07:33:28Z, `complete: true`, `errors: []` | same |
| Baseline | head `4bdd86b450981bebcbd5099bc6014e16f9595009`, engine SHA-256 `b1d2d3d0…` | same |
| Frozen inputs | referee tree `b37a1478…`, corpus `81ece1a2…`, RULEBOOK `ce837fec…`, cards.csv `7a8cc9c4…`, inputs `fb37abc0…` (2,500 duels, 155,868 actions) | `proof/referee/freeze.json` |
| Coverage | 129,796 accepted and 26,072 rejected actions; 0 unsupported rules; 0 oracle violations | first-run receipt |
| Disagreements | 2,613 in 45 duels (state 2,268, rejected-by-referee 253, rejected-by-engine 92) | first-run receipt; detail in the `.mismatches.jsonl` beside it |
| Completed duels | 2,477 of 2,500 | first-run receipt |
| First divergence | seed 109, turn 1, step 1, `rejected-by-engine` (Hellfire cast onto an empty board) | `.artifacts/referee/seed-109-first-divergence.json`, [first-divergence note](kiro-referee-first-divergence.md) |

The gated receipt, `proof/referee/receipts/current-6e2f2f90…a16fcd6.json`, records the same counts and `verdict: "fail"`:

- The gate `state agreement after each action` fails: target 0, actual 2,613.
- The gate `distinct completed seeded duels` fails: target ≥ 2,500, actual 2,477.
- The `history` section is `missing`: "history.mjs must export pinnedHistories".
- The `browser` section is `missing`: "browser.mjs must export browserVerdicts".
- `firstRun.reproduced` is `null`, so no second run has confirmed the first.

## 2. Wizard lesson native receipt (pending)

Source: `.artifacts/wizard-lesson/native-training-receipt.json` (`wizard-lesson-receipt/2`).

- `status: "pending"`. The recorded reason is "rival: no grounded counterexample in seeds 0-200".
- The receipt records one native run. The coach role ran agent `wizard-lesson-coach` (`.kiro/agents/wizard-lesson-coach.json`) through `kiro-cli` 3.5.0 with claude-opus-5.5. It has run ID `wl-a5b7723edb372351`, exit 0, and ran 20,817 ms from 07:41:12Z. Its `sessionId` is `null`, so this run cannot be traced to a native session receipt.
- The coach proposed the policy `wizard-hellfire-hold` (hold below 2 targets, Base ≥ 3, max attack ≤ 2). `counterexample`, `revised`, `verification` and `lesson` are all `null`.
- The bait episode `ep1-92c0c36f` (seed 0, Wizard first, marked action 5 = Hellfire) is in `.artifacts/wizard-lesson/native-bait-episode.json`. It matches `proof/wizard-lesson/bait-search.json` (`found: true`, 1 seed tried, Node v26.0.0).
- `proof/wizard-lesson/README.md` is stale. It says no `bait-search.json` exists and the policy tests are pending. The file now exists, and this note found no test receipt either way.
- The same README says that no spec requirement ID covers the lesson policy yet. That README also lists the session and UI wiring (`src/match/showdown-session.js`, opt-in rematch, cached-vs-fresh label) as open.

## 3. Build and checks in this checkout

| Item | Observed | Source |
| --- | --- | --- |
| Built files | `dist/web/index.html`, `dist/web/3d/index.html` and `dist/cowboys-vs-wizards-showdown-3d.html` (each 2,362,281 bytes, same size; not hashed); also `dist/web/graybox/`, `dist/web/showdown/`, `dist/web/poker/` | directory listing of `dist/` |
| Missing outputs | `dist/web/build.json` does not exist. `dist/cowboys-vs-wizards-board-duel.html`, the input to the README browser checks, does not exist either | same listing |
| Build identity | `4bdd86b45098+local` in both Outrider ledger artifacts. Gate "10 of 10 fresh; linked case-a, case-e" | `.artifacts/outrider-ledger/dist_web_index_html.json`, `.artifacts/outrider-ledger/dist_cowboys-vs-wizards-showdown-3d_html.json` |
| Pages tree check | **Failed before running any checks** (`checks: []`). Error: `SyntaxError: Unexpected token 'o', "not found" is not valid JSON` at `scripts/check-pages-tree.mjs:79`. The likely cause is the missing `build.json`, but that is not confirmed | `.artifacts/pages-tree/pages-tree.json` |
| Referee ledger smoke | Output folder is empty | `.artifacts/referee-ledger-smoke/` |
| Node suites | No receipt in this checkout for `npm test`, for the referee tests or for the Wizard lesson tests | none found |

## 4. Earlier receipts (history, not evidence for this candidate)

These receipts predate baseline `4bdd86b4` and cover different code. Do not cite them as checks of this candidate.

- [Kiro closeout release check](kiro-closeout-release-check.md): 2026-11-16 Workflow `wf_5bd13532f5142477` at `e9aeb06` on the retired lane build.
- [Closeout deployment](kiro-closeout-deployment.md): Codex's 2026-11-16 Pages deployment of `c5ef69b`. That deployment is not a deployment of this candidate.
- [Showdown native release review](showdown-native-release-workflow.md): 2026-11-20 Workflow `wf_5fb9b905dc2ad28d` at `c529330`, Node 167/167 and six browser checks at that commit.
- [Build identity method](kiro-build-identity.md): describes how CI compares the live `build.json` and digest. No live comparison exists for this candidate.

## 5. Release blockers

1. The referee verdict is `fail`: 2,613 disagreements in 45 duels, and 23 of 2,500 duels did not complete.
2. The referee `history` and `browser` sections are missing their exports.
3. The seed 109 Hellfire question needs a Fable ruling (issue 143) before either the engine or the referee changes.
4. The Wizard lesson is `pending`. No counterexample, revised policy or verified lesson exists, and the one native run has no session ID.
5. No requirement ID covers the lesson policy. The commit rule in `.kiro/steering/goal.md` needs one, from Fable or the user.
6. The build is `+local`, so it was not built from a clean commit. The Pages tree check failed, and `build.json` is absent.
7. No Node or browser suite result is recorded for this checkout.

## Checks for the coordinator

This worker had no shell, so none of these checks ran:

```sh
node --test tests/game/wizard-lesson-policy.test.js tests/game/wizard-coach.test.js tests/game/wizard-rival.test.js
node --test tests/game/referee-corpus.test.js tests/game/referee-prove.test.js tests/game/referee-history.test.js
npm run referee:prove        # after history.mjs and browser.mjs exports land; must reproduce the first-run receipt
node scripts/stage-pages.mjs --commit <clean sha> && node scripts/check-pages-tree.mjs --commit <clean sha>
shasum -a 256 dist/web/index.html dist/web/3d/index.html   # the /3d/ copy must be byte-identical
node scripts/check-links.mjs  # this note's relative links, including the triage note once it exists
```
