# Kiro contest gates: Showdown release hooks and fast-check properties

Date: 2026-11-21 (America/Los_Angeles). Author: Kiro (Claude Opus 5.5 worker, Kiro IDE session, own worktree). The coordinator tests, stages and commits.

**State: implemented, partly verified by the coordinator.** The coordinator reports that the first four fast-check properties (G1-G4) were verified. Nothing else below has been run by me (no shell in this session), and no hook has fired natively. The repair of this second pass (stamp hardening and the tasks.md guard) is unrun. See "Pending".

**November 23 registration check.** In a temporary workspace, Kiro CLI 3.5.0 V3's `/hooks` listed `PreTaskExec`, `PostTaskExec`, and a `SessionStart` control. The two otherwise identical probes with the longer spellings were absent. The current v1 hook files use the registered spellings. The Saloon uses `PreTaskExecution` and `PostTaskExecution` as internal journal labels so older recordings stay readable. [AWS v1 format guide](https://builder.aws.com/content/3HSSa3K02m3ExChFKTdxqHH6Gyn)

A subsequent native spec-task attempt hit Kiro's monthly usage limit before invoking a task. Actual dispatch, including the task gate's validation stamp, remains open under Pending 7.

## Files

| Path | Purpose |
| --- | --- |
| [`.kiro/hooks/contest-gates.json`](../../.kiro/hooks/contest-gates.json) | v1 hook array: PostFileSave, PreTaskExecution, PostTaskExecution, Stop, PreToolUse on `send_message` |
| [`.kiro/hooks/contest-tasks-guard.json`](../../.kiro/hooks/contest-tasks-guard.json) | standalone v1 PreToolUse guard on `fs_write`, `str_replace`, `fs_append` for `.kiro/specs/**/tasks.md` |
| [`scripts/contest-release-gate.mjs`](../../scripts/contest-release-gate.mjs) | Gate runner: modes `fast`, `release`, `pre-task`, `post-task`, `stop`, `completion`, `tasks-edit`, `status`. Exports pure helpers for the tests |
| [`scripts/contest-gate-properties.mjs`](../../scripts/contest-gate-properties.mjs) | fast-check properties G1-G4, failure formatter, replay parameters |
| [`tests/game/showdown-fast-check.test.js`](../../tests/game/showdown-fast-check.test.js) | G1-G4, planted-fault harness checks, the override guard and accepted and refused tasks.md edit payloads. `scripts/verify-duel.mjs` picks it up automatically |

## Stamp integrity (second pass)

- **Overrides cannot weaken a stamp.** `CONTEST_FC_PROPERTY/SEED/PATH/RUNS` are read only by `fast` mode, which never writes a stamp. `release`, `post-task` and `stop` always run all four properties at `FC_SEED` with 60 runs (`propertyPlan`). A property that is interrupted, runs fewer cases, or is missing from the run is a failure.
- **Child checks do not inherit the overrides.** `verify-duel.mjs` and `deck-balance.mjs` are spawned with every `CONTEST_FC_*` variable removed (`childEnv`). Otherwise this test file, run inside verify-duel, would read them.
- **`ok` is true only when no stage failed and the tree did not change during the run.** A red or filtered run writes `ok: false`.
- **Fingerprint inputs:** the Node version, everything under `src/`, `tests/`, `prototypes/showdown/` and the card specs, plus `package.json`, `package-lock.json`, `scripts/verify-duel.mjs`, `scripts/check-sourced-animation.mjs`, `scripts/deck-balance.mjs`, `scripts/play-match.mjs`, both gate scripts, and the two GLBs the preflight reads. `node_modules` is not hashed. The lockfile stands in for installed dependencies.

## tasks.md completion guard

`node scripts/contest-release-gate.mjs tasks-edit` reads the PreToolUse payload (`tool_name`, `tool_input`, optional `cwd`) on stdin. It exits 2, with an actionable stderr message, when all of the following hold:
- the edit targets `.kiro/specs/**/tasks.md`;
- the edit introduces completion, meaning the result has more `[x]`/`[X]` items than before, or an item that was `[ ]` or a status marker is now `[x]`;
- the stamp is not passing for the current tree.

Editing a status marker (`[-]`, `[~]`), notes or progress text, or rewording an already-done item, is allowed and does not compute the fingerprint. Other files pass.

Edit shapes handled:
- this session's `fs_write {path, text}` and `str_replace {path, oldStr, newStr}`;
- `fs_append {path, text}`;
- the Kiro CLI `fs_write {command: create|str_replace|append|insert, path, file_text|old_str|new_str}`.

For `str_replace` only the replaced fragment is compared. For a full write, the current file is the before text.

Fail closed: an unparseable payload that mentions `tasks.md`, or a covered edit with missing or unknown fields, is refused unless the stamp is fresh.

`send_message` gating is kept (`completion` mode). It refuses `severity: "success"` without a fresh stamp, which is how a workflow step marks itself completed.

**What the evidence proves, once the pending tests pass:** the decision function refuses and accepts the listed payload shapes, and the stamp-producing modes ignore the replay overrides. It does **not** prove the following:
- that Kiro invokes the hook for these tool names;
- that `matcher` is the right field;
- that Kiro sends this payload shape;
- that Kiro cancels the write on exit 2.

Those need a native receipt (Pending 8).

**Not intercepted:** a task's status in a native Kiro task or spec UI that changes without a tool call through `fs_write`, `str_replace` or `fs_append` passes the guard. Examples are the IDE "task completed" control, an editor save by the user, or a shell `sed`. I did not identify a native task-status tool or event to gate. PostTaskExecution can only report after the fact.

## Dependency needed (coordinator-owned package.json)

`fast-check` is not in `package.json`. Add it as a devDependency, pinned like the others (for example `"fast-check": "4.3.0"`, or whichever 4.x npm resolves), then install. The APIs used (`fc.record`, `fc.oneof` with weights, `fc.nat({max})`, `fc.property`, `fc.check`, `fc.assert`, `seed`/`path`/`interruptAfterTimeLimit`) exist in fast-check 3.x and 4.x. Until it is installed, the new test file fails to import, so `npm test` fails, and the gate exits 1 with `missing devDependency "fast-check"`.

## Properties (fixed seed `FC_SEED = 0x5d0c`)

Each case is a whole game. The deal comes from the existing generator (`tests/helpers/boundary-properties/showdown/generate.js`, chosen by `setupSeed`). It covers the even match, Trail duels, rivals, bounty hunts with bosses and open range. Then the generated choices run as `legalActions(state)[choice % length]`, followed by `end` until the game has a result. An optional `baseOrbs` override (an existing `createShowdown` option) makes long games reach the cap. No mechanic was added.

| Id | Requirement in the request | Checked |
| --- | --- | --- |
| G1 | hard turn cap | turn never exceeds `TURN_CAP + 1`. Past the cap the result is `turn-cap`, no action is legal, and the winner is the side with the higher Base. No turn takes more than `3 + BOARD_SIZE + 1` actions. A game with no result after `TURN_CAP × that` actions fails. The tests require both `base` and `turn-cap` endings under the recorded seed |
| G2 | orbs ≥ 0 | each Base stays in 0..its start, every troop on the board has an integer ≥ 1 orbs, and every event `left`/`targetLeft`/`attackerLeft`/`baseDamage`/`hitBack` is an integer ≥ 0 |
| G3 | deterministic full replay | two plays of one input are identical at every step. The recorded actions applied to a fresh deal reproduce every state and event, and the replay ends with a result |
| G4 | no hidden-hand leakage | `viewFor(state, side)` and every event name no card id from the other side's hand or traps or from either deck, at the deal and after every step |

These complement the existing SP1-SP7 suite (`tests/game/showdown-properties.test.js`), which uses the in-house generator and reducer. Here fast-check does generation and shrinking, and every game plays to its end.

Harness checks (disposable wrappers in the test file, not production bugs): G1 against a turn cap that never sets the result; G2 against a fatigue draw that takes a Base to −1; G3 against `f6DealKeepsHiddenState`; G4 against `f4ViewLeaksOtherHandCard` (both from `tests/helpers/boundary-properties/showdown/faults.js`). For each, the test also replays the reported `seed` and `counterexamplePath` and expects the same counterexample.

## Hooks: what each one can and cannot do

| Trigger | Command | Effect |
| --- | --- | --- |
| PostFileSave, patterns `src/game/showdown/**`, `.kiro/specs/duel-card-pipeline/cards/**` | `fast` | G1-G4, 15 runs each, at most 20 s per property. The script also skips when the hook payload names only out-of-scope paths. Failures go to stderr with exit 2. **Reports only.** A save cannot be undone |
| PreTaskExecution | `pre-task` | records the tree fingerprint and reports whether the stamp is current. Runs no checks |
| PostTaskExecution | `post-task` | release checks when the tree differs from a passing stamp, then writes the stamp. **Reports only.** A post hook cannot prevent the completion it follows |
| Stop | `stop` | exits 0 at once if the stamp passes for the current tree. Otherwise it runs the release checks, or re-reports a failure already recorded for this exact tree, and exits 2. Loop guard: after 2 failing reports on an unchanged tree, or when the payload says `stop_hook_active`, it exits 1 without running anything. Whether Kiro holds the agent at Stop on exit 2 is **unverified**. Treat it as a report |
| PreToolUse, matcher `send_message` | `completion` | when the tool input has `severity: "success"` (how a workflow step marks itself completed), it exits 2 unless the stamp passes for the current tree. Other severities and other tools pass. An unreadable payload is checked against the stamp (fail closed). This is the only hook intended to block, and only if Kiro honours exit 2 for PreToolUse on this tool |

Release checks, in order, stopping at the first failure:

1. G1-G4, 60 runs each, at most 60 s per property. An interrupted property counts as a failure.
2. `node scripts/verify-duel.mjs` (all Node suites in `tests/game`, `tests/match`, `tests/assets`, `prototypes/showdown` and the GLB preflight), 300 s timeout.
3. `node scripts/deck-balance.mjs --decks 1 --from 0 --count 4`, 120 s timeout. That is 16 matches, and the script throws if a match does not finish. Note: this script drives the retired lane deck builder (`src/game/deck-builder.js`, `scripts/play-match.mjs`). It is included only because the request named it. Drop it from `BALANCE_ARGS` if the lane stays retired.

Validation stamp: `.artifacts/kiro/contest-gates/stamp.json` (gitignored). It holds the fingerprint described under "Stamp integrity", `ok`, the checks that ran and any failures.

Unverified schema details: the field names `patterns` (PostFileSave) and `matcher` (PreToolUse), the stdin payload keys (`tool_name`, `tool_input`, `stop_hook_active`), and the tool identifier `send_message` as seen by PreToolUse. All of these were inferred from the agent hook shape in `.kiro/agents/showdown-presenter.json` and from the tool list of this session. I did not read any other `.kiro/hooks/*.json` here, because I could not list the directory. The script falls back safely when the payload is absent.

## Counterexample format (hook stderr)

```
G2 FAILED: no Base, troop or event orb count goes below zero
  orbs: step 57: cowboy Base -1 outside 0..5
  counterexample: setupSeed=0 baseOrbs=null choices(0)=[]
  deal: createShowdown(<seed>, {...}) duel=even
  shrinks: <n>; replay: CONTEST_FC_PROPERTY=G2 CONTEST_FC_SEED=<seed> CONTEST_FC_PATH=<path> node scripts/contest-release-gate.mjs fast
```

This is the format only. The values are placeholders, not an observed run.

## Pending (coordinator)

1. Add `fast-check` (above), install.
2. `node --check scripts/contest-release-gate.mjs && node --check scripts/contest-gate-properties.mjs`
3. `node --test tests/game/showdown-fast-check.test.js` (record time and the diagnostics).
4. `node scripts/contest-release-gate.mjs fast src/game/showdown/rules.js`, then `fast README.md` (expect "skipped").
5. `node scripts/contest-release-gate.mjs release`, then `status` (expect `fresh: true`), then `echo '{"tool_name":"send_message","tool_input":{"severity":"success"}}' | node scripts/contest-release-gate.mjs completion` (expect exit 0). Touch a watched file and repeat (expect exit 2 and "stamp is stale").
6. Loop guard: with a failing tree, run `stop` three times (expect exit 2, 2, then 1 without re-running).
7. Native triggers: in Kiro CLI V3, save `src/game/showdown/cards.js` without changes, end a turn, and run one task. Record whether each hook fired and how exit 2 was treated. Until then, no native receipt is claimed.
8. tasks.md guard, native: with a stale stamp, ask the agent to tick `[x]` in a scratch `.kiro/specs/<scratch>/tasks.md`. Record whether the PreToolUse hook fired, the payload it received, and whether the write was cancelled. Then change `[ ]` to `[-]` (expect the edit to apply). Delete the scratch spec afterwards.
9. Probe: `echo '{"tool_name":"str_replace","tool_input":{"path":".kiro/specs/demo/tasks.md","oldStr":"- [ ] a","newStr":"- [x] a"}}' | node scripts/contest-release-gate.mjs tasks-edit; echo $?` (expect 2 without a fresh stamp). Repeat with `"newStr":"- [-] a"` (expect 0).
10. Override guard: `CONTEST_FC_PROPERTY=G1 CONTEST_FC_RUNS=1 node scripts/contest-release-gate.mjs release`, then `status`. Expect `checks[0]` to read `fast-check G1,G2,G3,G4 seed 23820 x60`.
