# The Night Shift: receipts for the combined loop

Kiro CLI coordinator job `graywave-night-join` (Claude Opus 5.5), November 19–20, 2026, America/Los_Angeles. Pull request [#163](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/163), branch `kiro/graywave-night-join` from GitHub `main` `6b6caef` (pull request 161, the slice 3 cutover). The branch merges `kiro/graywave-night-meter` (`526a2c2`), `kiro/graywave-night-review` (`c399fb6`), `kiro/graywave-night-ledger` (`7ec928b`), `kiro/graywave-showdown-mcp` (`0871a45`) and `kiro/graywave-showdown-audit` (`67627a2`). Each worker's own note: [meter](../../apps/night-watch/README.md#target-band-lean-and-receipts), [review](night-shift-review.md), [ledger](night-shift-sheriffs-ledger.md), [MCP](kiro-showdown-mcp.md).

No card, rule, reward, deck, Scout or wording change. Everything below is CPU-vs-CPU play under the stated seeds and bot. No human played.

## The loop

1. **Night Watch measures** (`apps/night-watch`). It plays each Showdown deal from both seats with the commit's own level-2 bot. It reports first-player and Cowboy shares with Wilson 95% intervals, compares them with an optional operator target band, and writes a `night-watch-receipt/1` receipt.
2. **The Night Shift reviewer checks** (`scripts/night-review.mjs`). `check` re-runs a finding's counts from a fresh `git archive` snapshot. `run` takes one draft candidate (one card, one number) and decides it on paired seeds 0–999 plus a holdout range 1000–1999. It then seals a bundle bound to the source and build hashes. Nothing is applied to the cards.
3. **The Sheriff's Ledger shows it in the Camp** (`src/ui/sheriffs-ledger.js`). It is collapsed at the end of the Camp. One payload, `src/ui/sheriffs-ledger.data.js`, is generated from one checked-in receipt (`docs/evidence/night-shift/receipt.json`), plus any sealed review bundle whose finding has the same commit and counts. `node scripts/build-sheriffs-ledger.mjs --check` and the `check-sheriffs-ledger` hook keep it current.

**Meter to reviewer connection (added by this job).** Night Watch has a new project setting, `autoIssues`, which defaults to `"off"`. With `"off"`, scheduled runs stay read-only, as before. With `"lean"`, which needs Showdown mode and a band, each **scheduled** run does three things:

- It hands each out-of-band lean finding to `night-review.mjs check`, with a 120 s limit. A missing reviewer, a timeout or a count mismatch files nothing.
- It files at most two issues per run, labelled `night-watch`.
- It deduplicates each issue by a finding marker across open and closed issues. A closed issue with the same rules-blob marker counts as resolved and is not filed again.

Night Watch never uses the `kiro` label or a `/kiro` line, which assign Kiro Web (<https://kiro.dev/docs/web/github/>). It never reads back, comments on or edits an issue it filed. Shift alerts stay as draft links. Manual `issues --publish` still exists and is not a scheduled cycle.

## What ran and what did not

| Kind | Status | Receipt |
| --- | --- | --- |
| Real on-demand run | **Ran.** `server.py evaluate --baseline 6b6caef --candidate e813ae8 --first-seed 0 --count 1000` (no band), at 11:46 PM PST on Nov 19. 2,000 games: Cowboys 1,188, Wizards 812, draws 0; first player 1,142 (57.10%, CI 54.92–59.25); Cowboy share 59.40% (CI 57.23–61.53). Rule tests 361 passed. Shift steady; lean `unconfigured`. These counts match the meter worker's run on `4d52642` (the Showdown rules blob `66538ac` is unchanged). | [receipt.json](night-shift/receipt.json) |
| Staged scheduled run | **Ran 3 times, staged.** Real `server.py run --scheduled --mode showdown` on `e813ae8` in a temporary data folder, with `autoIssues: "lean"` and an **illustrative** band of 45–55%, which is not a design target. `gh` was a local stub; nothing reached GitHub. Run 1 created stub issue #1 (faction lean toward Cowboys; first player `inconclusive`). Run 2 reused it (`exists`). The stub issue was then closed, and run 3 recorded it as `resolved` and filed nothing. The reviewer reproduced all 2,000 games every time. Each run took about 72 s, inside the job's 300 s limit. | [staged-scheduled.json](night-shift/staged-scheduled.json) |
| Real scheduled Showdown run, November 20 | **Succeeded after #163 merged.** Crew job `62736a74`, run `9d81f577a1b2`, triggered on its 02:00 Pacific schedule. Night Watch recorded report `4195c6c07cda` at 02:42:51 Pacific for `5421633`. On seeds 0–999 played from both seats, the first player won 1,142/2,000 and Cowboys won 1,188/2,000. Both shares matched the baseline. Issue publication was off and the target band was unset. | [Scheduler and Night Watch record excerpts, with replay command](night-shift/crew-scheduled-2026-11-20.json) |
| Real published issue | **None.** No band is approved, so no finding is genuine. The repository has a `kiro` label and no `night-watch` label. | — |
| Kiro Web | **Not used.** Excluded by instruction: no `kiro`-labelled issue, no `/kiro` comment, no Web assignment. The meter, reviewer and ledger ran in Kiro CLI or as plain local commands. | — |

## Guard on a deliberately failing candidate

`node scripts/night-review.mjs run --finding <staged report e6713af867dc> --card cowboy-sheriff --field health --to 4` on `e813ae8` exited 1 (**rejected**):

- Finding reproduced: yes.
- Properties: 21/21 on the baseline and 21/21 on the candidate.
- Tune seeds 0–999: Cowboy share 59.40% → 63.60%, so faction skew went from **9.40 to 13.60 pp**. First seat went from 57.10% to 57.90%.
- Holdout seeds 1000–1999: Cowboy share 61.05% → 65.30%, so faction skew went from **11.05 to 15.30 pp**. First seat went from 58.25% to 59.20%.
- `verify` passed. Bundle seal `809cb9ee…b79d`.

The Ledger shows this verdict for its run. [Bundle, proposal, patch and output](night-shift/guard-sheriff-health-3-to-4/) (the game records stay in `.artifacts/`). The review worker's earlier accepted 3→2 draft is [here](night-shift-review.md). It is bound to `3dd47f1`, so the Ledger leaves it out.

## Camp to Ledger to report: key frames

`npm run build`, then `node scripts/browser-ledger-check.mjs dist/cowboys-vs-wizards-board-duel.html .artifacts/night-shift-proof --frames`. It passed 12 checks at 390×844 and 1440×900, including "the Night Shift review state of this run is shown (rejected)". At 1440×900 it saved three JPEG frames: the Camp, the open Ledger with the measured run, and the review line. Their SHA-256 hashes and visible text are in [frames.json](night-shift/frames.json). The JPEGs themselves are not committed, and a rerun with another Chrome may produce different bytes. The built file's SHA-256 is `00bf6716…a6df`. Nobody has reviewed the frames visually.

## Checks on the combined branch

| Check | Result |
| --- | --- |
| `npm test` | 595 pass, 0 fail; GLB structure 2/2 |
| `python3 -m unittest discover -s apps/night-watch/backend -p 'test_*.py'` | 29/29. New tests: opt-in default off, reviewer gate, scheduled retries, closed findings, `/kiro` and label guard, per-run limit |
| `node --test .kiro/powers/orb-duel-review/test/*.test.mjs tests/game/showdown-properties.test.js` | 26/26 (the MCP Boot Hill proof replays; properties) |
| Browser, built graybox | showdown 22, ledger 12, modes 13, trail 16, keyboard 6, cues pass |
| `node scripts/stage-pages.mjs` and `check-pages-tree.mjs` | pass (4) |

## If Alex chooses to enrol a scheduled issue path

This is not required for the release, and nothing here enables it. All three steps are user-only:

1. Choose a band (Fable/Alex) and set it, with **Scheduled issues** on, in Night Watch's settings in Crew.
2. `gh label create night-watch --repo alejandro-publius/cowboys-vs-wizards`
3. After merge, run `git -C …/Showdown pull`, so the 02:00 job runs this code.

## Open

- Target band and whether lean findings should become issues at all: Fable/Alex.
- The Ledger text and the review line are first-draft wording for Fable.
- The installed Orb Duel Review Power is still 1.1.0. The Showdown seat tools ran from the workspace MCP config, not the installed copy.
- The Night Watch mirror repository is at `599450a` and has no Showdown mode. Compare trees after merge; it keeps its mirror-only `SOURCE.json`, `.gitignore` and `docs/`.
