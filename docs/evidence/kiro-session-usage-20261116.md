# Recovered Kiro session usage — November 16, 2026 (Pacific)

Codex recovered these values from the **original Kiro CLI 3.4.0 V3 stream logs**. No session or test was rerun to produce this note. The values come from `data.update._meta.kiro.credits`, whose unit is explicitly `credit`; they are not context-window percentages.

[Structured metadata excerpts](kiro-session-usage-20261116.json) retain the exact reported values, session IDs, original source-log SHA-256, line numbers and source-line hashes. The full original logs remain in the coordinator's ignored artifact folders. Only the latest credits record for each session is retained; the identical `promptTurnSummaries` usage is not added a second time.

| Dispatched work | Reported session credits | Result |
| --- | --- | --- |
| WebKit card fix #43 | 10.695079 | CSS repair merged; separate WebKit/Chromium checks pass |
| Preview contracts #44 | 4.427153 | Specs and 800-match seeded corpus merged; no shrinking |
| Contributor review #45 | Parent 2.611407; four additional session records 2.851535, 0.546991, 1.672043, 0.436308 | Actual native Workflow on frozen PR40, not final release |
| Area steering #46 | 0.538682 | Configuration merged; activation not independently observed |
| Initial Billy sourced pilot #49 | 13.960612 | Preview; original prop/seating mismatch found |
| Billy prop/seating correction | 4.554268 | Improved preview; grip/old-attack transition remained |
| Documentation save-hook trial | 1.512563 | Actual failure/recovery; wrapper then corrected |
| Corrected-hook recheck | 0.791562 | Actual failure/recovery on revised wrapper |
| Billy sourced-shot preview | 7.541407 | Sourced idle and shot captured; grip still unapproved |
| Initial guided-match implementation #35 | 8.243737 | 193 Node tests reported, but idle tips were hidden; correction dispatched |

The table rounds to six decimal places; JSON retains the source precision. These are **selected session-level observations**, not an account balance, monthly total, credit depletion percentage or invoice. No aggregate is claimed: the native Workflow stream includes parent and child session records, whose accounting relationship is not independently established.

No inference about Auto's internal model routing is supported by these fields. A completed CLI turn means the worker stopped successfully; it does not mean its output met visual acceptance or shipped. In particular, Billy remains a draft and the initial guide required a correction.

This recovery supersedes statements that only the earlier 0.6441-credit trial had captured usage, for these named sessions only. The 0.6441 receipt remains historical; it is not included or overwritten. Current guide-correction/build-identity runs were still executing when this snapshot was made and are excluded.
