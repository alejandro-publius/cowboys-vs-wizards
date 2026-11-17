# Night Watch activation — November 16, 2026 (Pacific)

The user enabled Night Watch in Crew's Library. Codex verified app version 0.1.2 reports enabled, approved grants stored and no pending session approval. This supersedes the activation blockers in the historical [repair receipt](kiro-crew-repair.md).

## Verified results

- The saved config previously selected an older development branch. Codex backed it up and used the backend's validated configuration function to compare baseline b5cecc6272f53be450d51af62d9edfcd6319411b with origin/main, resolving to release 848b87b74284a713e8786fa0298329c50f5442b3.
- Documented backend CLI run at 9:02 p.m. Pacific saved [manual report f8275872e0a7](night-watch-activation/manual-report.json): 1,000 seeds per revision, 65 passing rule tests, steady.
- Codex registered the app's documented Crew command schedule for 2:00 a.m. America/Los_Angeles, job 30de99f4, managed by app:kiroween-night-watch/balance. [Schedule receipt](night-watch-activation/schedule.json).
- An actual kirocrew cron trigger invocation produced [scheduled report aa2997cc6c88](night-watch-activation/scheduled-report.json) at 9:06 p.m. Pacific in the same persistent history. It also passed 65 rule tests and compared 1,000 seeds per revision.
- Both revisions returned 425 Cowboy wins, 472 Wizard wins and 103 draws. First seat won 583 and second seat 314. No measured changes crossed the configured 10 percentage-point threshold.

## Evidence boundaries

The actual Mac screenshot showed Night Watch loaded with its earlier report, proving the installed UI opened. A fresh report after a page reload was not visually verified; the local browser-control connection was unavailable. The backend reads reports from disk for each state request, while the current UI fetches on mount or its own reload/run actions.

The manual report was generated through the documented backend CLI, not by claiming a click on the dashboard button. The scheduled report came from the real Crew scheduler triggered immediately, not from calling the backend with a fabricated source label. This verifies the command job path, not a future unattended 2 a.m. execution.

The schedule requires this Mac and Crew to be running. It checks local committed refs; it does not fetch GitHub before each run. No automatic public GitHub issue posting is enabled. These CPU results are regression evidence, not a human balance assessment or proof that first-seat advantage is resolved.

Unauthenticated direct terminal HTTP requests returned Token required. That was not a failed user approval; no browser cookies or trust grants were copied or forged. No game runtime, assets or animations changed in this activation.
