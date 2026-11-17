# Kiro verified-evidence reconciliation (issue #79)

Author: Kiro CLI 3.4.0 V3. Date: November 17, 2026 (America/Los_Angeles). Base: main `e214e8d65db4c3496d3acede5a5f191191e44d88`.
Method: text-only audit of tracked docs and local git history. Nothing was re-executed, no game or browser test was run, and no claim here comes from a new run. Earlier dated snapshots are kept as written; they were true on their dates and are only annotated.

## Stale statements this audit repaired

| Statement (where) | What the record shows now |
| --- | --- |
| Brag sheet: batch [#56](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/56) "is dispatched", "no shrinking" | Completed and merged as PR #61 (`14cc636`): [boundary properties](kiro-boundary-properties.md) with 7 properties (1,203 generated cases at the recorded seed), 6 test-only mutants each caught by its property, and a bounded shrink demonstration (24 cards to 5, 7 actions to 5, 58 of 3,000 candidate runs). The "no shrinking" limit still describes the earlier #44 contracts and the six presenter loops, not #61. |
| Brag sheet: Property tests "no generators or shrinking" | Same: true of the November 16 presenter loops; the engine/CPU boundary suite adds generators and a reducer. |
| Evidence note for #66: "no Workflow ran" | Superseded in the same note: native `independent-release-review` completed 3/3 ([note](kiro-independent-release-review-66.md)), merged as PR #76. |
| Night Watch Host guard: gateway "unverified" | Partly narrowed: a coordinator read the installed Crew proxy source and ran a loopback aiohttp check. A real enabled-app gateway request has still not been made ([host guard](kiro-night-watch-host-guard.md)). |

## Merged PRs checked (git history only)

"Author" is the party that wrote the content, taken from each evidence note. Every commit carries the same git author name, so git authorship does not distinguish people or tools.

| PR | Merge/commit | Content | Who wrote it | Who ran the checks |
| --- | --- | --- | --- | --- |
| #58 | `ebd44ab` (`8174446`) | [`docs/submission/rules-check.md`](../submission/rules-check.md): entry checked against pasted Kiroween rules text | Rachel (commit author `rachelselbrede`); not Kiro | Reading task; no executable check |
| #61 | `14cc636` (`c612687`, `d1ec4cc`, `7dabfd4`) | Boundary property tests, mutants, shrink demo, [requirement-test map](../requirement-test-map.md) | Test code and note: Kiro CLI session. Codex coordinator: integration branch name, trailing-blank-line and docs-index fixes | Kiro note records `npm test` 206/206 and 15/15 boundary tests. Not re-run here |
| #62 | `49269b5` (`a9d0ac0`) | First Spell achievement fix (`action.type==="spell"`) and test | Kiro CLI | Kiro: new test fails on old code (12 pass, 1 fail), 13/13 with fix, `npm test` 201/201. Browser menu check pending |
| #63 | `5df2dd8` (`c6f6232`, `4266e85`) | Trap-zone and pacing specs, corrected to a dedicated trap card kind | Kiro CLI | Design only; no code or tests ([plan](kiro-trap-pacing-plan.md)) |
| #65 | `7ff323f` (`4f4ccbf`, `6d528d2`) | Opt-in `?pace=fast`, `src/match/pace.js`, 5 tests | Kiro CLI; date correction by coordinator | Kiro: 5/5, `npm test` 221/221, headless Chrome seeds 0 and 60 default and fast, no console errors. No time saving measured ([note](kiro-fast-pace-preview.md)) |
| #69 | `2400fbd` (`70a80c0`) | CI also runs web build, review-server tests and Night Watch tests | Kiro CLI | Local only; GitHub Actions run not recorded ([note](kiro-ci-coverage.md)) |
| #70 | commit `6a07ccd` | Night Watch standalone Host-header guard (#68) | Kiro CLI wrote guard and 7 tests; coordinator added gateway-source review | Python 7/7 and a local curl smoke (Kiro); coordinator re-ran 7/7 and an aiohttp loopback check. Installed Crew gateway request **not run** |
| #73 | `e9c4143` (`c9e9f0f`) | Seeds restricted to 0..4294967295 | Kiro CLI | Kiro: controller tests 10/10 and `npm test`; no browser ([note](kiro-seed-range-validation.md)) |
| #74 | `63b834a` (`752f8b3`, `2cfac9a`) | Deck workbench uses game-rule constants | Kiro CLI; browser check by Codex | Kiro: 1 source-level test, `npm test` 222/222. Codex ran the existing Chrome workbench check, exit 0 ([note](kiro-deck-ui-rules.md)) |
| #76 | `e214e8d` | Executed `independent-release-review` evidence | Recipe: Kiro CLI; coordinator made `expected_sha` an input and added `--web`; run approved by coordinator | Native Workflow completed 3/3: 222/222 tests, 2/2 GLB checks, seed 0 8/8, seed 60 4/4, zero console errors. Web build identity unverified. No run ID captured ([note](kiro-independent-release-review-66.md)) |
| #77 | `64a7383` (`9a2c31b`, `1c741a1`) | Opt-in `--startup-measure` flag | Kiro CLI wrote flag (one file) | Kiro ran `node --check` only. Coordinator ran build, 222/222 tests and seed 0/60 replays; single observations, no speedup claim ([note](kiro-scene-startup-59.md)) |

Also on main and audited: #75 `667c126` (pace feedback script). Kiro wrote the harness; the coordinator ran the builds and four Chrome replays. One observation per mode, no causal speedup claim ([note](kiro-pace-feedback-66.md)).

## Current Kiro-feature status

Status words: **Run** means a receipt of an actual execution exists. **Configured** means the file is tracked and no receipt shows it taking effect. **Blocked** means the attempt is recorded without a result.

| Feature | Status | Evidence | Gap |
| --- | --- | --- | --- |
| Specs | Run (IDE session for `orb-duel`); CLI-authored specs for card pipeline, preview contracts, guided first match, deck-builder readability and trap zone | `.kiro/specs/`; `orb-duel/tasks.meta.json`; trap-zone [plan](kiro-trap-pacing-plan.md) | Trap-zone is spec only; no trap code exists. Deck-builder readability spec has no run of its own |
| Steering | Configured (5 files: `build-evidence`, `duel-iteration`, `rules-area`, `rendering-area`, `interface-area`) | `.kiro/steering/` | No receipt shows activation or an effect. The #46 note says activation was not independently observed. `build-evidence.md` is Codex-authored |
| Hooks | Run for `sync-duel-card-specs` (CLI save, pass) and `check-project-doc-links` (CLI save: failed on broken link, passed after fix). `duel-presenter` SessionStart ran 19/19 | [`kiro-ui-hook.txt`](kiro-ui-hook.txt), [card pipeline](kiro-card-pipeline.md), [brag sheet](../kiro-brag-sheet.md) | Kiro CLI 3.4.0 V3/3.3.0 only. No Kiro IDE hook run recorded |
| Custom agent | Run (`duel-presenter`) | `.kiro/agents/duel-presenter.json`; [overnight](kiro-overnight.md) | Shows scope, not output quality |
| Workflows | Run: `orb-duel-replay` (several, incl. `wf_0572a745f5194cf1`, `wf_5bd13532f5142477`), `contributor-pr-review` (`wf_0b2ce64faf14a4aa`, frozen PR #40), `card-summoning-lore-review` (`wf_ecb54a0b1a3d2a92`, 1 round), `card-summoning-circle` (trial), `independent-release-review` (3/3 on `7506599`, no run ID) | Notes linked in the [table](../submission/kiro-feature-evidence-table.md) | Scripted replays are not human playtests. Most original logs are ignored `.artifacts/` |
| CLI models and credits | Recorded for ten November 16 sessions (for example 10.695079 for #43, 13.960612 for #49) and 0.6441 for the earlier Auto turn | [usage](kiro-session-usage-20261116.md), [continuity](kiro-continuity-usage.md) | Selected session values only. No account total, no proof of model routing. Sessions after #35 (#54 to #77) are not tabulated |
| Power and MCP | Run: installed Power 1.1.0 bundled MCP returned pass/pass then stale/stale; `inspect_duel_replay` `pass`/`stale`/`fail` | [power fix](kiro-power-package-fix.md), [overnight](kiro-overnight.md) | Copied historical receipts, not a new browser run. CI runs the server's 4 tests only as configured in #69 (no Actions run recorded) |
| Crew and Night Watch | Run: balance preview; Night Watch manual and Crew-scheduled runs, 65 rule tests over 1,000 seeds; nightly 2 a.m. Pacific job registered | [activation](night-watch-activation.md), [Night Watch](kiro-night-watch.md) | No clock-time run observed. Host guard (#70) not tested through the installed Crew gateway. Latest-report UI reload unverified. A separate Crew browser review timed out |
| Property-based testing | Run: 7 boundary properties, 1,203 cases, seed 45274, 6 mutants caught, bounded shrink | [boundary properties](kiro-boundary-properties.md) | Samples, not proof. Presenter, controller and renderer criteria not covered. No product bug found |
| Deployment | Run: Pages build identity manifest; live run verified `4c0723d` and served HTML hash | [build identity](kiro-build-identity.md) | Verified for `4c0723d`; this audit did not check the current live site |
| Memory, Web, cloud sessions, cascade | **Not run.** Fresh V3 session exposed no Memory tool; cloud continuity is an optional follow-up | [closeout queue](../kiro-closeout-queue.md) K18, K24 | No claim made |

## Kiroween 2026

Checked only against [`rules-check.md`](../submission/rules-check.md) (Rachel, from rules text pasted November 16, 2026). Open per that note: public video upload, the human-written social post, published blog, team student eligibility, trademark risk in video narration, and each member's credit request by December 1, 2026, 12:00 pm Pacific. No submission was made. This audit did not re-read the live rules page.

## Remaining evidence gaps

1. Installed Crew gateway request against the Host guard (#70); future clock-time Night Watch run.
2. Kiro IDE hook run; any steering-activation observation.
3. Fresh session credit records after #35 and a Memory/Web/cloud run, if the team wants to claim them.
4. Native Workflow run ID for `independent-release-review`; web build commit identity (no embedded SHA or `build.json` in `dist/web`).
5. GitHub Actions run of the #69 CI additions.
6. Human playtest, real Safari/phone, art approval, and the public demo video.
7. Browser checks pending for #62 (First Spell) and #73 (seed range).
8. The personal reflection (below).

## Personal reflection (needed from the user)

No first-person account of what Kiro was like to use is written here and none should be invented. Suggested prompts for the user: which Kiro feature changed a decision you made, where it slowed you down, and what you would not use again.
