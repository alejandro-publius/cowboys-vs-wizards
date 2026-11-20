# Parallel search receipt (native Kiro workflow)

Recipe: `.kiro/workflows/showdown-ride-search.workflow.json` (K-034 parallel-node shape, joinPolicy all).
Run: `wf_418f67ecbabfcf7a`, launched from the Kiro IDE session sess_25192995-bd53-44ef-99bc-73a68b4a76a1, status completed.

| step | agent | session | started (UTC) | ended (UTC) | exit | owned file |
| --- | --- | --- | --- | --- | --- | --- |
| range-a | wf-coder | sess_85946fe6-d417-4879-bb3d-8e55847a5990 | 2026-11-20T20:53:49Z | 2026-11-20T20:53:49Z | 0 | results/search-1000-1099.json |
| range-b | wf-coder | sess_a488472f-4526-46a3-889e-b0d62081930a | 2026-11-20T20:53:49Z | 2026-11-20T20:53:50Z | 0 | results/search-1100-1199.json |
| join | wf-code-reviewer | sess_171f753e-cdd7-430b-99f2-828ec345ea61 | | | | none |

Times are the workers' own `date -u` reports. Both branches report the same start second.
After the run `git status --short` showed only the two owned results files, plus the reviewer
agent file the coordinator wrote. Neither worker committed anything. The coordinator then
reran both ranges locally, and `cmp` found both files byte-identical to the workers' output.

Counts as printed:
- A: `{"tried":100,"branch":62,"noBranch":38,"kinds":{"both-cowboy":55,"fight-only":4,"both-wizard":1,"ride-only":2}}`
- B: `{"tried":100,"branch":62,"noBranch":38,"kinds":{"both-cowboy":50,"fight-only":5,"ride-only":5,"both-wizard":2}}`

Limitation: each run takes about a second, so "simultaneous" is backed by matching start
seconds and the parallel node, not by measured overlap.
