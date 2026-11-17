# Evidence: competitive research for issue #80

**Actor:** Kiro CLI 3.4, in the isolated worktree `.worktrees/kiro-competitive-benchmark-80`, branch `kiro/competitive-benchmark-80`, started from `main` at `e214e8d`. **Date:** November 17, 2026, about 09:30 PST (America/Los_Angeles). **Result file:** [kiroween-competitive-benchmark.md](../submission/kiroween-competitive-benchmark.md).

## Method

Read-only. Public HTTPS GET with `curl` to `api.github.com` and `raw.githubusercontent.com`, in a temporary directory outside the repository that was deleted afterwards. No clone, no authentication, no asset download, no look at author profiles or private data.

For each repository: repository metadata, newest commit, a commit count (first 100 only), the recursive file tree, and the README. For three, also one Kiro evidence file (Lantern `docs/kiro-evidence.md`, Last Rites `docs/kiro-log.md`, CivKiro `docs/KIRO_USAGE.md`) and the generated verification report of the dinosaur entry. Only the first ~1,000 characters of each were read. For two entries with a live site, one HTTP request checked the status code.

## Sources and observed state

| Repository | Newest commit seen | Commit date (UTC) | Commits seen | `.kiro` files | Test-named files |
| --- | --- | --- | --- | --- | --- |
| DragonKingIO/slice-and-shout | `e63971a` | 2026-11-03 | 5 | 5 | 0 |
| Lainholic/kiroween-dinosaur-mud-3d | `dfbafa6` | 2026-11-07 | 2 | 15 | 25 |
| roeku/lantern | `b98d38d` | 2026-11-13 | 8 | 12 | 15 |
| Rafa-Innerchispa/ghostbridge-kiroween-2026 | `c5f01f7` | 2026-11-11 | 51 | 19 | 13 |
| dismality/last-rites | `873c1b4` | 2026-11-17 | 100 or more (cap) | 65 | 334 |
| LMH-gh/civkiro-1991-kiroween2026 | `bd1ef43` | 2026-11-03 | 5 | 3 | 2 |

Base URL for each: `https://github.com/<owner>/<repo>`. "Test-named files" counts tree paths containing "test"; it is not a test run and not coverage.

HTTP status checks: `https://last-rites.vercel.app` 200; `https://lmh-gh.github.io/civkiro-1991-kiroween2026/` 200; `https://kiroween.devpost.com/rules` 200 (status only; its text was not read, see below).

Our own facts come from [README](../../README.md), [AGENTS.md](../../AGENTS.md), [rules-check.md](../submission/rules-check.md), [PROJECT-STATUS.md](../PROJECT-STATUS.md), [JUDGE-GUIDE.md](../JUDGE-GUIDE.md), [judge-demo-script.md](../submission/judge-demo-script.md) and [kiro-task-01.md](../kiro-task-01.md), as of `e214e8d`.

## Limitations

- **Six entries, not the field.** Nothing here ranks entries, estimates a score, or says anything about prize likelihood.
- **Unverified:** `kiro-interactionkit` and `spookbnb`. The GitHub API returned "Not Found" for the bare names. I did not search for owners.
- **I ran none of the games.** Descriptions are of each README and file tree, not of play. I did not check whether the sites work beyond an HTTP status, and I saw no video content.
- **Official rules text not re-read.** The rules page answered 200 to a plain request, but [rules-check.md](../submission/rules-check.md) records that automated readers are blocked. Rule statements in the benchmark rely on that pasted-text record, dated November 16, 2026. Rules were marked updated that day, so they may have changed since.
- **Commit counts** are capped at the first 100 per repository. Repository state can change after the snapshot.
- **Kiro usage in competitors** is what their files claim. I did not verify that any logged action took place.
- **Last Rites README** still contains template placeholders for its play and video links, though the repository homepage field points at a live site. I report both.
- **CivKiro** has a mismatch between repository name, description and README title. The `.kiro` tree I saw is smaller than its README lists. That may be a partial upload or a later push; I did not check.
- **Credentials.** One README prints a demo login for judges. I did not use it and did not copy it.
- **Playtest metrics and text changes are proposals.** No human playtest, timing, or recording was performed. Nothing in the benchmark is a verified outcome of our own game.
- **Not examined:** our game itself was not run for this task.

## Checks run

- `node scripts/check-links.mjs` (existing docs link checker). Result on November 17, 2026: 148 Markdown files, 479 relative links and images, 0 broken (exit 0), run with the two new files staged.

## Files

New, only these two: `docs/submission/kiroween-competitive-benchmark.md` and `docs/evidence/kiro-competitive-research.md`. No game source, tests, assets, art, specs, or other documents were changed. No competitor repository was modified or cloned.
