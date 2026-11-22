# Kiro CLI contest checks · November 22, 2026

## Release

GitHub Pages served `d0bbd142eb2d3ff64c491b892f12587a016d01e8` at the site root and `/3d/`. Both returned HTML with SHA-256 `ac82a279ad8a5e8acc6a0dbc841fd6a3e7c0d144462631798c387b8b3a062ad1`. Codex recorded the demo from those verified bytes. [Live challenge](https://alejandro-publius.github.io/cowboys-vs-wizards/) · [Pages deployment and live identity check](https://github.com/alejandro-publius/cowboys-vs-wizards/actions/runs/45076921659)

## Kiro gates

Kiro CLI 3.5.0 with Claude Opus 5.5 wrote the Stop, task and save checks and the four fast-check properties. The release stamp passed 60 cases per property at seed `23820`, ran `verify-duel.mjs` and ran the requested bounded `deck-balance.mjs` sample. The sample uses the historical lane harness. The fast-check properties exercise Showdown.

A native `PostFileSave` event on a tracked rules path ran all four properties with 15 cases each at seed `23820` and exited 0. The disposable checker recorded the hook event and the actual test output.

The native `fs_write` tool refused the unchecked-to-completed edit in `.kiro/specs/contest-gate-probe/tasks.md` when the stamp was stale. The tool reported that `PreToolUse` intercepted it and that the write did not execute. With a current passing stamp, the same edit succeeded in a fresh run. The fixture is temporary. This establishes the file-edit guard for Kiro's task checklist. Native tracker state outside those file tools is unverified.

Kiro's Stop logger recorded real read and write tool categories from `PostToolUse` and rendered two actual Stop receipts into the usage page. The offline entry checker passed its automated checks, including the tracked MIT license and tracked `.kiro/` directory. [Kiro usage](../KIRO_USAGE.md) · [Gate design and rerun commands](kiro-contest-gates.md)

## Balance run

Kiro CLI proposed the three changes in an isolated worktree at base `eedab9385931e093e156fdb7885c470eb2ec64eb`. The local reviewer played 200 deals per range from both starting seats, using level-2 bots and the fixed even-match decks. Each before and after arm had 400 games on seeds 0–199 and 400 on seeds 100000–100199. Each candidate and its baseline passed all 21 property and fair-bot checks in the reviewer.

| Attempt | One-number proposal | Cowboy wins, tuning | Cowboy wins, holdout | Gate |
| --- | --- | ---: | ---: | --- |
| 1 | Sheriff health 3 → 2 | 60.75% → 56.50% | 59.00% → 52.00% | Fail, tuning |
| 2 | Skeleton health 3 → 4 | 60.75% → 57.00% | 59.00% → 53.25% | Fail, tuning |
| 3 | Billy attack 2 → 1 | 60.75% → 50.25% | 59.00% → 51.00% | Pass |

The accepted receipt seal was `ce4c34018d5cc827dd8f91e54f944db1f63360d74c4ff4cee9638955ed38ec12`. `node scripts/contest-balance.mjs verify --attempt 3` reported `verify attempt 3: ok; recorded verdict PASS`. The win-share band applies to these match cohorts. Individual card estimates in each receipt are based on games where the side summoned the card, with sparse and unmeasured cohorts labeled. The two fixed seed ranges were reused across attempts. The Billy candidate is ready for design review.

The native fence blocked the probe write to `src/game/contest-fence-probe.txt` before execution. The agent's valid `fs_write` edited only an existing staged card JSON under the current attempt's scratch directory. The native Workflow `wf_87723b3404bba1fc` screenshot was captured from its CLI output as it moved through reset, preparation and proposal. The numeric table comes from the completed local run above. [Native workflow screenshot](kiro-night-shift-native.png) · [Completed run screenshot](kiro-night-shift-results.png) · [Workflow and replay commands](kiro-contest-balance.md)
