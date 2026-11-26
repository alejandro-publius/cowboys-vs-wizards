# Kiro closeout queue, November 16 archive

November 16 integration: [November 16 parallel review](evidence/parallel-closeout-2200.md). Ownership at that time was tracked in [GitHub #24](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/24); the earlier ledger below is retained as history. #43–46 have implementation/evidence; #49 is a preview, and #35 remains the next Rachel handoff after publication.

Observed November 16, 2026 (America/Los_Angeles). This ledger records the November 16 assignments. See the [current build](PROJECT-STATUS.md#current-build) for the supported game. A checked item means reviewed output exists; publishing, user approval and live services are separate states. The user authorized the full research-derived backlog on this date. Keep one owner per path and transfer a completed task to the next dependency without rerunning old work.

## Historical ownership at the earlier closeout
- Kiro: completed readable deck UI, final replay Workflow and existing-card lore review. The separate Crew review reached its cap without a browser result; no worker is left waiting.
- Kiro: completed receipt recovery, Power reproduction and scoped Auto/Memory checks.
- Kiro: completed file/asset audit and Night Watch export fix; Codex reviewed compatibility and publication.
- Codex: integration/review, source register, submission packaging and this ledger.
- Fable: completed the judge script/protocol and repaired keyboard focus after lane selection, Cancel and summons. Combined candidate passes 9/9 keyboard checks; [execution details](evidence/fable-board-accessibility.md). Earlier deck-quota stop remains historical; the deck UI is Kiro’s implementation.

## Accepted task ledger
| ID | Deliverable | State / evidence | Dependency and next handoff |
| --- | --- | --- | --- |
| K01 | Integrate completed spec, custom-deck tests, initial evidence pack | Merged in PR #15 at c5ef69b; 9/9 focused tests pass; 128 distinct decks replay twice | Published; exact deployed HTML verified |
| K02 | Original public receipts | 12 originals recovered and hashes independently verified; residual missing records listed | Integrated; exact residual missing files remain explicit |
| K03 | Installed Power reproducibility | Installed 1.1.0 matches source; fresh installed-only Kiro sessions used bundled MCP and returned pass/pass then stale/stale | [Evidence](evidence/kiro-power-package-fix.md). Copied historical `e9aeb06` receipts, not a fresh browser run; supersedes the older installed-copy/workspace fallback limitation |
| K04 | Large readable deck builder + independent QA | Kiro implementation complete; Codex corrected boxes/artwork assertion and passed desktop/phone +11 menu checks | 1280/390 widths, 180/150 card widths, 16px type, 44px controls, save/reload, keyboard; user visual approval separately |
| K05 | Current release Workflow | Completed wf_0572a745f5194cf1 on 02b1bf8: 157 tests, 2 structure checks, 8/8 seed0 and 4/4 seed60, no console errors | [Actual state/receipts](evidence/kiro-final-polish-verification.md); [11 menu +9 keyboard checks](evidence/final-polish-web.md); publication in PR #17 |
| K06 | Fresh Crew browser review | Actual bounded Crew attempt timed out without a browser receipt or screenshot | [Inconclusive bounded run](evidence/kiro-closeout-crew-review.md); no browser availability or visual-review success claimed. Night Watch app policy is separate |
| K07 | Safari and real mobile/WebGL | Safari remote-automation setting absent; iOS simulator unavailable; real-device service access not established | Actual device/account setup required; Chrome viewport alone is not iPhone testing |
| K08 | Human onboarding and opener choice | Needs first-time player | Fable's [protocol](submission/judge-demo-script.md#three-first-time-players) is prepared and blank; collect real observation; no agent posing as a human |
| K09 | Final-build performance | Codex measured three current-build local loads: median input readiness 689ms; all startup checks passed | [Method/receipt](evidence/kiro-closeout-performance.md); not comparable to the old benchmark method |
| K10 | Final demonstration / public YouTube | 58.73s preview assembled from current menu/deck/settings plus real seed60 gameplay; public YouTube pending | Final UI and Kiro proof; no fabricated video URL |
| K11 | README / judge guide / Devpost reconciliation | Published README/judge guide plus reconciled Devpost draft | Actual Devpost form submission remains pending |
| K12 | Public build-story blog | Draft ready at submission/build-story.md | Reviewed factual story + chosen publishing destination; mention Kiroween 2026 |
| K13 | Night Watch separate app package | User enabled installed 0.1.2; approved grants confirmed. Real manual and Crew-scheduled runs each passed 65 rule tests over 1,000 seeds per revision | [Activation and original reports](evidence/night-watch-activation.md); installed UI opened, but latest-report UI reload remains visually unverified |
| K14 | Submission/bonus verification | Requirements checked; personal eligibility unresolved | User confirms current enrollment/team facts; final public URLs |
| K15 | Approved asset provenance and remaining motion gaps | Kiro verified 16/16 originals and 43 asset records; provenance gaps stated | Preserve originals; require chosen Tripo/licensed clips for new fire reaction/Dragon changes |
| K16 | Project hub organization | 20 release pointers repaired, 14 character/motion shortcuts added; 73/73 links resolve | Stable release advanced to c5ef69b and rebuilt; originals remain unchanged |
| K17 | Actual Auto/model/credit evidence | Observed Default/Auto; initial useful turn reported 0.6441 credits | Scoped turn usage only, not account totals or proof of internal routing |
| K18 | Fresh-session Memory demonstration | Blocked: fresh V3 session exposes no Memory tool | No store/retrieval claimed; global configuration unchanged |
| K19 | Workflow step-tree recording | Actual step state, sessions, outputs and report captured | Final video still needs actual Workflow footage/assembly; JSON is not video |

## Additional gaps recovered from older source material
| ID | Deliverable | State / decision |
| --- | --- | --- |
| K20 | Durable worker ledger and readiness review | This file and source register created; each future integration adds checked commands and actual receipts |
| K21 | Original Summoning Circle lore/review loop | Completed native workflow wf_ecb54a0b1a3d2a92; cap 3 rounds, executed 1, approved with no findings; eight card files unchanged. [Evidence](evidence/kiro-lore-review-loop.md) |
| K22 | Production Night Watch schedule / automatic issue filing | Enabled nightly at 2 a.m. America/Los_Angeles; actual Crew trigger saved report aa2997cc6c88 in shared history | [Schedule receipt](evidence/night-watch-activation.md); Mac/Crew must run, refs are local; future clock-time run not yet observed. Issue drafts only; no automatic public posting |
| K23 | Full November 15 issue / exact supplied YouTube metadata | Unrecovered after source lookups; retained in source register without invented contents |
| K24 | Cloud session continuity | Optional newly recovered follow-up, not a prior completed use. Existing authenticated setup needed; do not duplicate local work solely to claim a surface |

## Readiness record for this integration
- Base: deployed main `599450a27703fbdb8961d626c3e779512f54f29e`.
- Original Kiro commits: `c69a3fe`, `3f84069`, `ee601b4`. Cherry-picks preserve separate authorship/evidence.
- Codex review: no game runtime changes in those three commits. Evidence files label missing originals; simulation bounds, conservation, deterministic replay and CPU public-view boundary inspected.
- Executed: `node --test tests/game/custom-deck-simulation.test.js tests/game/deck-builder.test.js`: 9/9; 128 decks, 2199 first-pass actions, 1419 public-view perturbations.
- Executed: four evidence JSON files parse.
- Executed: Night Watch four Python tests and UI Node syntax check pass. This does not prove live Crew installation/scheduling.
- Logs: ignored `.artifacts/kiro-closeout/`. Do not call old browser reports fresh.

## Constraints that remain
No new generated animation/poses, replacement illustrations, invented mechanics or speculative dependencies. Preserve approved art. Multi-target Singularity, lasso damage, trap slots and agent-balanced random decks remain explicitly deferred. First-time human observations, current student eligibility, user visual approval, and unavailable service credentials cannot be manufactured.

[Source-to-task register](kiro-source-register.md) · [Kiro evidence map](kiro-brag-sheet.md) · [Current project status](PROJECT-STATUS.md)

## Historical frozen runtime verification

Actual Kiro Workflow completed on `e9aeb06`. Subsequent integration changes are evidence/docs and the separate Night Watch package; no game source, art, build code or dependencies changed. Standalone HTML SHA-256: `a5d0c756077e89afa4f8a107c64e863a7d09cba48456f8229a8b42b4fa208bd2`. Web HTML SHA-256: `863ab8bd525cb2e78b0e73b529406b73c6a2381f982f2854e71340df79718e02`.

## Current notes (November 16, 2026, Pacific; reconciliation)

The frozen-runtime section above is historical. `c454398` later changed How to Play text in `src/ui/title-menu.js`, so not every current file matches `e9aeb06` or its browser receipts. Combined candidate 02b1bf8 passes 11 menu and 9 keyboard checks ([web evidence](evidence/final-polish-web.md)). Details: [reconciliation receipt](evidence/kiro-docs-reconciliation.md).
