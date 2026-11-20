# Showdown native release review (K-048, K-050, K-054)

November 20, 2026, America/Los_Angeles. Worker: Kiro CLI 3.5.0 V3 (model claude-opus-5.5), branch
`kiro/showdown-sprint-workflow`, base `2fcf39b7fe4db6f78cb33f6b2c474e053e89bbc7`.

## What changed

- `.kiro/workflows/independent-release-review.workflow.json` now reviews **Showdown**. It is one
  `wf-code-reviewer` step with a required 40-character `expected_sha` input. The step checks HEAD, detached
  state and a clean tree. It runs `scripts/showdown-release-review.mjs`, re-checks that script's receipt and
  writes `report.md`. All output goes under `.artifacts/kiro/showdown-release-review/<sha>/`.
- `.kiro/workflows/independent-release-review-lane-3d.workflow.json` keeps the historic recipe, which runs
  the lane/3D `browser-match-check` on seeds 0 and 60. Only its `name` and `description` changed. Runs
  `wf_b7f50a2cb1f5a6a6` and `wf_f48c4d50004ff115` used that recipe under the old name.
- `scripts/showdown-release-review.mjs` is the deterministic runner.
  - Run mode refuses with exit 3 for any of these reasons: the SHA is not 40 lowercase hex characters, HEAD is
    not the expected SHA, HEAD is on a branch, or the tree has a tracked or untracked change.
  - It then runs the Showdown Node suites (`tests/game/showdown-*`, `tests/match/showdown-*`,
    `sheriffs-ledger`, `prototypes/showdown/*.test.js`).
  - It sweeps every choice at the landing of every turn in `src/match/showdown-turn.js` `TURNS`. The sweep
    checks that the other seat's hand, traps and deck and the seed stay hidden. It checks that each branch
    finishes and that replaying it gives the same result.
  - It runs one `build-graybox`, then the existing headless Chrome checks of the built page:
    `browser-showdown-check` (entry), `-trail-check` (normal Camp and Trail rewards), `-modes-check`
    (hot-seat hidden hands, packs, bounties and save isolation), `-turn-check` (the turn decision and save
    byte-identity), `-keyboard-check` and `browser-ledger-check`.
  - It checks HEAD and the tree again after the run, then writes `receipt.json`.
  - `--check-receipt` refuses with exit 4 in these cases: the receipt names another SHA, it did not pass,
    the HTML hash changed, or a browser report hash changed.
- `tests/match/showdown-release-review.test.js` has 4 tests. They cover the provenance refusals, the
  receipt refusals, the suite selection, and the sweep reaching every allowlisted turn.

The turn checks, game code and the Power are unchanged.

**Seeds.** The runner fixes no seed. Each browser check keeps its own seeds: seed 0 for Boot Hill and
seed 3 for the hot-seat match. The sweep reads seeds from `TURNS`, and on the worker revision the only entry was `dragon-c5`
at seed 3. A later turn such as seed 70 joins the sweep automatically, with all its branches, once it is
added to `TURNS`. The worker revision predates the second playable position in PR 165.

**Branch results.** The sweep's fixed policy plays attack first. Its results are not the referee results
that `tests/match/showdown-turn.test.js` asserts: for example, choice A becomes a Wizard win on turn 10
instead of a Cowboy win on turn 15. The sweep checks that each branch finishes and replays deterministically.
It does not judge balance.

## Native evidence (genuine saved Workflow runs)

One Kiro CLI V3 parent session (`sess_98f1d7e4-a218-4879-b0f4-0b8e370efdee`) ran in a detached, clean
checkout of `c529330dc724108d72035f9bc46ba726a0612d8a`. It called `run_workflow` twice with the saved recipe's
`workflowPath`. Both persisted definitions have the same steps as the recipe file.

| Run | expected_sha | Status | Outcome |
| --- | --- | --- | --- |
| `wf_3f3cc7a5856eef24` | `2fcf39b…` (main, wrong) | failed (step `error` via `send_message`) | Script exit 3: "HEAD c529330… is not the expected 2fcf39b…". No receipt; report ends `refused` |
| `wf_5fb9b905dc2ad28d` | `c529330…` | completed | Node 167/167. `dragon-c5` (seed 3): 5 branches, 0 problems. Build exit 0. Six browser checks exit 0 with 0 page errors: entry 22, camp-trail 16, modes 13, turn 18, keyboard 7, ledger 12. Receipt check exit 0. Report ends `pass` |

Standalone HTML: `6e849fe1fca29b635b3ce8b5d8fc5e3eca624e81ff2dc81c6fe2601d7c3e9a77` (107,727 bytes). The
parent ran 16:44:26–16:47:09 UTC and exited 1 with `runError: workflow run incomplete (1 failed)`. That
failure is the required refusal. The checkout was clean afterwards.

Proof: [launcher](showdown-native-release-workflow/launcher-receipt.json),
[definition](showdown-native-release-workflow/workflow-definition.json),
[positive state](showdown-native-release-workflow/positive-workflow-state.json),
[refusal state](showdown-native-release-workflow/bad-sha-workflow-state.json),
[receipt](showdown-native-release-workflow/positive-receipt.json),
[positive report](showdown-native-release-workflow/positive-report.md),
[refusal report](showdown-native-release-workflow/bad-sha-report.md),
[manifest](showdown-native-release-workflow/source-manifest.json). Path prefixes are replaced, and no
fields are removed. The raw stream, logs and screenshots are not copied.

## Scripted evidence (direct commands, not a Workflow)

The same detached checkout was used.
- `--expected 2fcf39b` (short SHA): exit 3.
- `--expected <main SHA>`: exit 3.
- Run on the branch checkout itself: exit 3, with both the branch and dirty-tree reasons.
- `--expected c529330…`: exit 0 in 108 s, with the same counts as the native run.
- `--check-receipt` with the main SHA: exit 4.
- `--check-receipt` after one comment was appended to the HTML: exit 4.
- `--check-receipt` after the HTML was restored: exit 0.

The native run later replaced that receipt.

## Repeat on a combined commit

Run these from the repository root with the combined commit's 40-character SHA as `SHA`:

```sh
git worktree add --detach .worktrees/review-$SHA $SHA
mkdir .worktrees/review-$SHA/node_modules
for x in node_modules/* node_modules/.bin; do ln -s "$PWD/$x" ".worktrees/review-$SHA/$x"; done
cd .worktrees/review-$SHA && git status --porcelain --untracked-files=all   # must print nothing
mkdir -p .artifacts/kiro
kiro-cli chat --v3 --no-interactive --trust-workspace --output-format stream-json \
  --trust-tools 'fs_read,fs_write,execute_bash,run_command,introspect,*workflow*' \
  "Use run_workflow once with workflowPath \"$PWD/.kiro/workflows/independent-release-review.workflow.json\", inputs {\"expected_sha\": \"$SHA\"}, runLabel \"independent-release-review-showdown-$SHA\". Do not read or edit files yourself. Wait for its terminal notification, then give the workflowId, status and the report's last line." > .artifacts/kiro/release-workflow-stream.jsonl
```

`node_modules` may also be a symlink when Git ignores it. The fresh checkout must resolve its dependencies and produce an empty `git status --porcelain --untracked-files=all`. Repeat the command with a wrong 40-character SHA to see the refusal.
In that case the parent exits 1 with `runError … (1 failed)`. A PTY is not needed. `--trust-workspace`
applies to this launch only.

## Limits and pending

- Every check is a scripted headless Chrome or Node check on one Mac. They support flow, storage and
  hidden-information claims only.
- Human playtest (clarity and fun), art-owner rendered review and devices (phones, Safari, other GPUs):
  **pending**.
- Deployed Pages identity is not checked; use the lane recipe or `verify-build-identity.mjs` for that.
- `pageSha256Matches` is `null` in the receipt because no browser check reports the hash of the page it
  loaded. The checks are bound to the build by path and by the receipt's HTML hash. They do not use an
  in-page hash.
- Kiro app (IDE) invocation and Crew scheduling were not exercised.
