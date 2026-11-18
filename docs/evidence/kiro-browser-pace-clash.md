# Browser pace with a clash: default vs `?pace=fast` (issue #128)

Date: 2026-11-17, PST (America/Los_Angeles). Executor: Kiro (Kiro IDE session, model `claude-opus-5.5` from session context), single worker in worktree `.worktrees/kiro-pace-clash-128`. Base: main `fba0c0c06beed26d348cf14ba598839016554836` (merge of #127). No usage-credit figure was emitted by the runtime, so none is recorded. Scope: measurement tooling only. No change to `src/`, art, audio, decks, package or production files.

**Status: incomplete measurement.** The tooling change and its unit tests are done. No complete Chrome receipt for the clash route exists. The results below are partial and must not be read as a default-vs-fast comparison with n = 3.

## Change

[`scripts/browser-pace-measure.mjs`](../../scripts/browser-pace-measure.mjs) gains `--route passive|clash` (default `passive`, unchanged from #125). With `--route clash`, each Cowboy turn makes a legal free summon through real CDP mouse input before End phase: click the first hand card labelled "free summon, playable now", click the first enabled Cowboy lane, click the enabled Summon (confirm) button. The summon counts only when that lane's label stops reading "empty" and the page returns to `accepting_input` with no selection. Tributes, spells and traps are never chosen. If no free summon or lit lane is offered, the turn records the reason and only ends the phase. The End phase playback that follows then has a Cowboy troop on the board, so it can contain clash impacts.

The clash receipt reports `issue: 128`, adds three summon timing rows (click → troop on lane, DOM and next frame; click → input again), adds Summon / Same summon columns to the order table, and fails if any run misses its turn-1 summon or if the summoned card or lane differs across modes.

## Checks actually run

| Check | Result |
| --- | --- |
| `node --test tests/match/pace-browser.test.js` | 10/10 pass (includes 3 new tests: route parsing; passive receipt unchanged with no summon rows; clash receipt metrics, same-summon verdict, failure on a different lane or a missing summon) |
| Chrome run 1 (earlier in this task): `--route clash --seeds 0,60 --samples 3 --turns 2`, stderr to `/tmp/pace-clash.log` | Stopped after 5 of 12 runs, no receipt written |
| Chrome run 2 (rerun, hard 120 s cap): `--route clash --seeds 0 --samples 3 --turns 2 --out /tmp/pace-clash-128.json` | Failed after 92 s on the first run: `timeout waiting for first accepting_input (default, seed 0)` (90 s page-load limit). No receipt written |

Unit tests cover argument parsing, receipt assembly and markdown output from synthetic run records only. They do not exercise Chrome, the summon click path or the game.

Build: `dist/web/index.html` SHA-256 `b9969dd742e44e1a4ab9ae1a23b62c955a09bcd9c64c9861b8e81e79edae6753`, the same hash recorded for #125. No file under `src/` is newer than that build. Not rebuilt in this task. Chrome 157.0.8103.79 headless, darwin arm64, Node v26.0.0.

## Why run 1 stopped

`/tmp/pace-clash.log` ends after `sample 1 seed 0 fast` with no error or stack trace. The script prints a stack on any thrown error and deletes each run's temporary Chrome profile in its `close()` path. A `pace-measure-chrome-*` profile from that run was left behind in `$TMPDIR`. Both facts point to the process being killed from outside, most likely by the foreground command timeout. Timing supports this: #125 needed 3 min 05 s for 12 runs, so 12 clash runs cannot finish inside a roughly 2 minute command window. This is an inference; the kill itself was not logged.

## Why run 2 failed

The page did not reach its first `accepting_input` within 90 s. In #125 the same build loaded in a median 1116 ms (461–2744). During run 2 another tool's headless Chrome (`/tmp/fable-chrome-*` profile, about 40 processes, one with over 20 min CPU time) was running, and the 1-minute load average was about 7 just afterwards. Host contention is a plausible cause but was not confirmed. That Chrome was not started by this task and was left running.

Run 2 used 92 of the 120 s budget, so no third attempt was made.

## Partial data (run 1, End phase click → next input, ms)

| Sample | Seed | Mode | Turn 1 | Turn 2 |
| --- | --- | --- | --- | --- |
| 0 | 0 | default | 10049 | 4104 |
| 0 | 0 | fast | 7216 | 3551 |
| 0 | 60 | default | 3552 | 8217 |
| 0 | 60 | fast | 3034 | 5700 |
| 1 | 0 | fast | 7198 | 3517 |

Limits of this data: n = 1 per cell except seed 0 fast (n = 2). The progress line logs only End phase → next input. It does not show whether each turn's summon landed or was skipped, the summon timings, overlay order or same-end-state verdicts. So these numbers do not prove that a clash occurred in every turn. Under these conditions fast was quicker in every paired cell of sample 0. That is an observation from single samples, not an estimate of the effect.

## Remaining work

- Run `node scripts/browser-pace-measure.mjs --route clash --seeds 0,60 --samples 3 --turns 2 --out FILE.json` in the background with about 4 minutes allowed, on a host without a competing headless Chrome, and commit the receipt summary here.
- Check the receipt's `summonMissing` list and Same summon column before drawing any pace conclusion.
- `docs/kiro-build-log.md` was not updated; this task was limited to three files.
