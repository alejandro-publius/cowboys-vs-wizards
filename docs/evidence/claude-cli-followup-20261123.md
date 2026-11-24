# Showdown CLI handoff · November 23, 2026

Four Claude Code sessions ran on Claude Opus 5.5. This checkout combines their saved changes and the browser test fixture fix from Kiro. Claude Code reported that the five-hour usage window resets at 12:30 p.m. Pacific.

| Work | Verified result |
| --- | --- |
| Node checks | 1,086 tests passed on the starting candidate. The integrated changes passed all 136 focused referee and Wizard tests. |
| Illustrated browser | All six frozen-corpus canaries completed. Chrome matched the public referee state across 382 actions and passed 15,473 assertions. Seed 228 caught the empty-board Hellfire disagreement. |
| Browser cohort | The generator produced 250 distinct referee transcripts for deals that the browser can load through Camp. The complete release replay is still open. |
| Historical referee | The repaired runner replayed four archive smoke cases against the frozen referee. Zero of the five required historical defects qualify for the release gate. |
| Wizard search | 19,703 alternate branches and 1,595 Hellfire holds checked. The search reached its time bound with zero grounded counterexamples to the native coach policy. |
| Wizard browser | Nine checks passed across the illustrated root, its 3D compatibility route, and the graybox. The pending native receipt preserved the original Wizard. The accepted lesson checks used a marked simulated receipt. |

The original 2,500-duel run showed 2,613 disagreements. A temporary referee copy that rejected empty-board Hellfire matched all 155,868 actions. The gameplay ruling is still open. This checkout retains the original frozen referee and first-run evidence.

## Reproduce the checks

```sh
node scripts/referee/hellfire-parity-probe.mjs
node scripts/referee/browser-transcripts.mjs --source corpus --count 250 --out .artifacts/referee-inputs/claude-corpus-250.jsonl
node scripts/referee/browser.mjs --canary --seed 3 --transcripts .artifacts/referee-inputs/claude-corpus-250.jsonl --reduced-motion
node scripts/referee/history.mjs run --manifest .artifacts/history-archive-smoke/manifest.json --referee proof/referee/referee.py --adapter scripts/referee/history-adapter.mjs
node proof/wizard-lesson/counterexample-search.mjs --from 0 --to 119 --max 3 --branch --depth 2 --horizon 3 --nodes 3500 --budget-ms 90000
node scripts/browser-wizard-lesson-check.mjs --routes graybox,root,3d
```

Canary receipts are in `.artifacts/browser-canary-six/`. The browser failure is in `.artifacts/claude-browser-hellfire-228/`. The browser lesson report is in `.artifacts/wizard-lesson-browser/report.json`.
