# Kiro Power reproduction and receipt recovery

Date: 2026-11-16 (America/Los_Angeles). Branch `kiro/evidence-reproduction`.

**Who did what.** Codex set up the worktree and cherry-picked the public evidence pack (`c69a3fe`, now `b7ab959`). Kiro, in this session, searched for the historical receipts, copied them, inspected the installed Power, and made the MCP calls below. The wf_30bc03349c699917 run itself was a Kiro CLI Workflow run (agent `wf-coder`, run label `orb-duel-replay-verification`).

**Scope.** This is a fresh MCP inspection of historical replay evidence. No browser or build ran in this session. It supports no claim about the current release, appearance or fun.

## Environment

| Item | Observed |
| --- | --- |
| Session client | Kiro CLI 3.3.0, explicitly launched with `chat --v3 --no-interactive` by Codex. No model override was passed; the actual model id was not recorded in the observed output. The original worker note misidentified this as the IDE; Codex corrected it during review. |
| Installed apps | `/Applications/Kiro.app` CFBundleShortVersionString 1.4.178 (installed copy; not proof of the running build). `kiro-cli --version` prints 3.3.0. |
| Worktree HEAD | `b7ab959` on `599450a` |

## Part A: recovered historical records

Manifest with original SHA-256, byte counts, redactions and limits: [05-recovered-originals.json](kiro-public-evidence/05-recovered-originals.json). Files: [originals/](kiro-public-evidence/originals/). The index at [kiro-public-evidence/index.md](kiro-public-evidence/index.md) is updated.

| Requested record | Result |
| --- | --- |
| Workflow `wf_30bc03349c699917` original log/report | **Recovered, no transcripts.** The run directory under the Kiro session store has `workflow-state.json` (captured step outputs, agent, timestamps, credits), `sessions.json`, `workflow-definition.json`. The step-3 report is `report.md` in the `kiro-showdown-workflow` worktree. Run window 2026-11-16T20:52:06Z to 20:54:20Z. |
| Compaction receipt `861af78-1794855476196` | **Recovered.** `duel-compaction.jsonl` in the `kiro-continuity` worktree: a `before` line (`hasSummary:false`) and an `after` line with that id (`hasSummary:true`). No summary text. |
| Seed-60 `browser-run.json` of the 112-test run | **Recovered**, with the seed-0 receipt. Commit `c24ff07`, `uncommittedChanges: true`, build SHA-256 `b4e913df…f3129`, 4 of 4 steps, 0 console errors. |
| Crew balance preview | **Recovered receipt and log** (seeds 0 to 999: baseline 472 Wizard wins, Skeleton 4 orbs 663). Fuller per-variant JSON not copied. |
| Night Watch | **Partial.** Duel test log (107 tests) copied. Scheduled report `34eb6c4957b1` not found. Screenshots not copied. |
| Browser reports named in preflight doc | **Recovered** the e1e901d seed-0 and seed-60 receipts (HTML `d28cf20a…`). |

Still missing: per-step CLI transcripts of the workflow, the first pre-fix run, that run's Node test log (112 appears only in captured step output), and report `34eb6c4957b1`.

Redactions: only absolute path prefixes (`<worktree:NAME>/`, `<repo-root>/`). The two machine blocks in browser receipts (Mac model, CPU, memory, macOS, Node versions) were kept. No credentials or private data were found in the copied files.

Search scope: `git worktree list` paths' `.artifacts` trees by filename, plus `~/.kiro/sessions/*/workflows/wf_30bc03349c699917` found by exact ID name. No home-wide content scan.

## Part B: installed Power

Installed location: `~/.kiro/powers/installed/orb-duel-review` (listed in `~/.kiro/powers/installed.json`, no registry id). Plugin `orb-duel-review` **version 1.0.0**, `plugin.json` SHA-256 `08120fc16e76…` (identical to tracked).

| File | Installed SHA-256 | Tracked `.kiro/powers/orb-duel-review` SHA-256 |
| --- | --- | --- |
| `skills/review-duel-replay/SKILL.md` (procedure) | `714d44396ffb47fff24fe71d1fecd2548dd52187096116f29ac6b8594d8dcf7d` | `0cfd462818801343dc7fff0fb529ecb437c439841cbef3eed5aca9339b4828ef` |
| `server.mjs` | `c859b20e9cc0670c727652bcfc605a04aae6ca0ea11dd08302344bfc1a416e5a` | `0aa1615f3336cec0852244c9cc59c2715353fceb523f9963eddc250e41c72c61` |
| `plugin.json` | `08120fc16e76b61d2aa8d52b46bf9ed31624fce0ff48be067d0acac61184f7a6` | same |

Differences (from `diff -r`): the installed copy is the older revision. It has only `inspect_duel_replay` with targets `standalone` and `web`, no `showcase` target, no `inspect_character_asset`, and its SKILL.md lacks the showcase and character-asset sections. The tracked copy adds all three. `~/.kiro/powers/data/orb-duel-review` is empty. Nothing was installed or overwritten.

**Activation.** I loaded `plugin::orb-duel-review::skill::review-duel-replay` with `load_resource`. The text returned matches the installed SKILL.md by inspection (standalone and web only, 8 steps; I did not hash the returned text). That is the installed procedure, loaded in this session.

**MCP.** I loaded `tool::orb-duel-review::inspect_duel_replay`. Its schema offered `standalone`, `web` and `showcase`, so the executing server is the **tracked workspace server** from `.kiro/settings/mcp.json` (`node .kiro/powers/orb-duel-review/server.mjs`), not the installed Power's server. This is the same fallback the historical runs used. It is not an installed Power server, and I did not test whether the installed server starts.

Because the installed procedure has no showcase step, I called `showcase` because the task asked for the seed-60 receipt. The tool schema, not the installed SKILL.md, permits it.

### Inputs (copied only into this worktree; originals untouched)

Source worktree `kiro-showdown-workflow`, commit `c24ff07` (2026-11-16 12:42:32 -0800), which has uncommitted workflow and log edits. Receipts dated 12:53:01 PM PST (seed 0) and 12:53:58 PM PST (seed 60).

| Fixed path (ignored by git) | SHA-256 | Verified before calling |
| --- | --- | --- |
| `dist/cowboys-vs-wizards-board-duel.html` (56,423,498 bytes) | `b4e913df65d68a83d6c43541e764a0678ae5c71277aaf79530228692e84f3129` | equal to source and to receipt `page.sha256` |
| `.artifacts/kiro/replay/browser-run.json` | `c44ca09b26864a42009c9854a2550a98eb4dccb27f8a3f6d47434a047062cfe4` | equal to source |
| `.artifacts/kiro/showcase/browser-run.json` | `51c43815578729c340be52b5caf5bd14d97a9cf3d2ef29f12f2a58064069cbb7` | equal to source |

### Results

Full JSON: [06-power-mcp-calls.json](kiro-public-evidence/06-power-mcp-calls.json).

| Order | Call | HTML SHA-256 | Verdict | Reasons |
| --- | --- | --- | --- | --- |
| 1 | `{"target":"standalone"}` | `b4e913df…f3129` | **pass** | none. Seed 0, 8 of 8 steps, 0 console errors, `coversCurrentBuild: true` |
| 2 | `{"target":"showcase"}` | `b4e913df…f3129` | **pass** | none. Seed 60, 4 of 4 steps, 0 console errors, `companion.sameBuild: true` |
| 3 | `{"target":"standalone"}` after appending `\n<!-- stale-check -->\n` (+22 bytes) to the copied HTML | `a5e151f33b3a183a52ed911f2d24bee97786fe1d704a9cda5b98306feb818ae3` | **stale** | `receipt hash differs from the current build (stale receipt)` |
| 4 | `{"target":"showcase"}` same stale copy | `a5e151f3…18ae3` | **stale** | same reason |

I then restored the copied HTML from the source and re-verified SHA-256 `b4e913df…f3129`. Source files in `kiro-showdown-workflow` were not modified.

## Limits

- The pass verdicts say the receipt hash equals the HTML hash. They do not show the current release replayed cleanly, and the receipts carry `uncommittedChanges: true`.
- The workspace server, not the installed server, produced the verdicts.
- No visual, fun or current-release claim is made. Receipts do not show appearance.
- `docs/kiro-build-log.md` and other shared docs were not edited here; the coordinator owns them.

## Coordinator review and launch-record limitation

Codex observed the actual CLI V3 process (PID 66719, runner 66716), the running receipt at 2026-11-17T01:32:20.369507+00:00, and the run log showing Kiro Powers loading, Tool Load and four MCP calls before completion. On the next check, commit `4321ba4` existed and both processes had exited, but the ignored `.artifacts/kiro-evidence-reproduction` launch/log directory was gone. The exact exit code and full current-session transcript therefore cannot be recovered from that launcher. [07-coordinator-observation.json](kiro-public-evidence/07-coordinator-observation.json) records those observations, explicitly as a coordinator summary, not original CLI output. The recovered historical originals and copied matching replay inputs remain available.

Codex also checked every manifest file against its published SHA-256 and included the two evidence `.log` files omitted by the repository-wide ignore rule. These review corrections are Codex work; the recovery and Power/MCP execution remain Kiro work.
