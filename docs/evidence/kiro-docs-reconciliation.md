# Docs reconciliation, November 16, 2026 (Pacific)

Docs-only pass by Kiro; no tests, build, browser, commit or settings changes. Historical sections were kept; dated current notes were added.

## Reconciled
| Fact | Sources | Updated in |
| --- | --- | --- |
| Installed Power 1.1.0 with bundled MCP; fresh installed-only Kiro sessions pass/pass, then stale/stale. Inputs were copied historical `e9aeb06` receipts, not a fresh browser run. | [kiro-power-package-fix.md](kiro-power-package-fix.md), commit `2435f5d` | queue K03, brag sheet, status, judge guide |
| Night Watch installed 0.1.2; basic `kirocrew chat` returned `CREW_READY` (9.2 s); 0 cron jobs; Kiro CLI did the bounded review, coordinator did the update and checks. | [kiro-crew-repair.md](kiro-crew-repair.md), commit `9bfd25f` | queue K13, brag sheet, status, judge guide |
| Actual Fable model authored `e65431c` (source `e30ffab`); Codex reviewed/corrected in `b2c8936` (source `14e089e`): 2:40 demo script and blank playtest protocol (one file). Earlier deck quota stop is historical. | [judge-demo-script.md](../submission/judge-demo-script.md), [fable-judge-story.md](fable-judge-story.md) | queue ownership and K08, status, judge guide |
| `c454398` changed How to Play text in `src/ui/title-menu.js`; the `e9aeb06` freeze is historical. | git log | queue, status, judge guide |

## Remaining blocks
- Fresh browser verification of the post-`c454398` build: pending (coordinator). The Power receipts do not cover it.
- Night Watch: human App Store "Trust this app alone" approval, enabling, a UI report with persisted history, and a real schedule are all not done. No unattended scheduled operation is claimed.
- Human playtest: protocol unrun, results blank; no human feedback exists. Demo script unrecorded; no public YouTube URL.
- Safari/real mobile, user visual approval, Devpost submission and eligibility remain as listed in the queue.

## Coordinator review

Codex reviewed the five changed documents against the integrated receipts. Review separated basic Crew relay connectivity from the still-disabled Night Watch app, distinguished Fable authorship from Codex factual corrections, updated the top-level Power/Crew evidence rows, labelled the old deployment snapshot historical, and removed duplicated wording. Kiro session: `sess_2774fe86-0e9d-4436-8cee-67ce97750529`. Raw output is preserved outside the worktree at `../kiro-worker-logs/docs-reconcile-20261116-202947/raw-stream.jsonl` relative to the original repository root. No game tests, builds or browsers ran for this docs-only task.
