I wrote the report to `.artifacts/kiro/replay/report.md`.

Both runs exited 0 on revision e9aeb06 with 0 console errors, and no values are pending. I only built the report from the two step results. I didn't run any checks or hash the file myself.

| Run | Observed steps | Receipt path |
|---|---|---|
| Seed 0 (`node scripts/verify-duel.mjs --browser`) | 8 of 8 | `.artifacts/kiro/replay/browser-run.json` |
| Seed 60 (`node scripts/browser-match-check.mjs --showcase --summary --out-dir .artifacts/kiro/showcase`) | 4 of 4 | `.artifacts/kiro/showcase/browser-run.json` |

- **Node counts:** the seed-0 step reported 157 tests with 157 passing and 0 failing, cancelled or skipped.
- **Hash comparison:** both runs printed the same build SHA-256, `a5d0c756077e89afa4f8a107c64e863a7d09cba48456f8229a8b42b4fa208bd2`. That means both used the same standalone duel HTML.