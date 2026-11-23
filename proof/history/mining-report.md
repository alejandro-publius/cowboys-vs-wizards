# Showdown history mining: status

## Session 2026-11-23 (Claude Code, claude-opus-5-5): real Git, archived engines, frozen referee

**Verified (sealed, reproduced) cases: 0.** The held-out set in `proof/history` stays empty and unsealed.
**Mined discrepancies replayed independently on the frozen referee and both archived revisions: 1**
(`0beb0d5` hitBack). It is reachable, but its observable is outside the state schema, so it is not counted.

### What ran (all real; nothing below is from the earlier secondhand source)

- Git is real and not shallow (`git rev-parse --is-shallow-repository` = false; objects through
  `.git/objects/info/alternates`). Every commit id in `triage.json` was checked with `git log --no-walk`.
- `git log --full-history` on `src/game/showdown/{rules,cards}.js`, `src/game/card-specs.generated.js` and
  `prototypes/showdown/rules.js`; `git log -p -U0` on `prototypes/showdown/rules.test.js` and the post-move
  Showdown rule tests, looking for removed `assert` lines; `git show`/`git diff` on each candidate.
- `node scripts/referee/history.mjs mine --repo .`: not shallow; candidates `71591d1` (test-expectation),
  `3dd47f1`, `0beb0d5`, `a7d64d3`, `6ca1f21` (engine). Each is classified in `triage.json`.
- `node scripts/referee/history.mjs verify`: exits 1, "inputs are not sealed". Correct for an empty set.
- Archive smoke (generated, `.artifacts/history-26/smoke/`): `seal --pin-referee proof/referee/referee.py`
  (the referee tree hashes to the frozen `b37a1478…`), then
  `run --referee proof/referee/referee.py --adapter scripts/referee/history-adapter.mjs --out …/run-report.json`.

### Findings

1. **After the engine move (`f44af67`) no commit fixes a duel rule.** `a2bbe19` adds `playTurn`'s `onAction`;
   `44d31ee` rebuilds the card table from generated specs; `3dd47f1` is bot-only; `a4472f3` is presenter text.
   No post-move Showdown rule test removes or changes an assertion.
2. **`0beb0d5` hitBack (parent `c40a767`, public via PR #142 merge `735cb096`).** A blind 12-action legal prefix
   from ordered decks (seeds 4101 and 4104) reaches the regression test's position: a 1-orb Skeleton attacks
   Mounted Billy. On the archived engines the attack event reports `hitBack` **1 at the parent and 3 at the fix**
   (`/steps/11/engineEvents/0/hitBack`). Every state value agrees: at `/steps/11/state/players/wizard/discard`
   the referee, the parent and the fix all give `["wizard-skeleton-5","wizard-skeleton-1"]` (`no-difference`).
   The frozen schema has no events, so the referee cannot judge it: `candidate-unsupported`, not sealed.
3. **Changed test expectations are rules revisions, not corrections.** `5a2166b` widens "after an attack only
   attack or end" to also allow cover. That commit introduces Cover, and the parent `4c47a39` has no
   rulebook and no cover action. In the test's own position both assertions pass. Replayed as seed 4102:
   the referee and the fix accept cover after an attack (`/steps/6/accepted` = true), and the parent is
   `unsupported-historical-api:cover`, so it is not a rejection. `a7d64d3` swaps the test's attacker from Mounted
   Billy to Billy because Mounted Billy gained Ride.
4. **`71591d1` and `6ca1f21`, new from the miner:** Kiro task-gate tests that live in a Showdown test file, and
   the retired lane engine. Excluded.

### Bridge repairs (scripts/referee/history.mjs, new scripts/referee/history-adapter.mjs)

- `runReferee` runs `python3 -I referee.py --stream` with exactly one NDJSON duel line and requires exactly
  one result line. Before this change it passed no flag, and `referee.py` then prints its help and exits 2,
  so no case could ever reach the referee.
- `runAdapter` requires `runDuel(engineRoot, duel)`. A module with only `replay(duel)`, such as the pinned
  `adapter.mjs` (which imports the current engine statically), is refused with that reason, never used.
- `history-adapter.mjs` loads `rules.js`/`cards.js` from the archive (`src/game/showdown` or
  `prototypes/showdown`). It deals the input order through the revision's own `createShowdown` and refuses
  (`unsupported-historical-api`) a revision whose constructor cannot deal those cards with that first side.
  Action types missing from the revision's `applyAction` stop the replay at that step with no
  `accepted`/`state`. Schema fields the revision cannot express are omitted and listed in `unsupported`.
- `materialize` also extracts the revision's `package.json`. `judge` returns `unsupported` when a revision has
  no value at the pointer. `seal --pin-referee` pins the referee only if its tree matches `freeze.json`.
  `run --out` writes the report.

### Open

- An event-level observable such as hitBack needs a referee schema with per-action events. That belongs to
  the referee owner, and the frozen schema must not change to fit this.
- Nothing else in the real history is a fix of a state-level duel rule, so five verified cases cannot be
  mined from this history as it stands. More would need new historical fixes, not reclassification.

---

The sections below are earlier sessions. They were written without Git or Node access and are superseded
where they disagree with the section above.

Kiro CLI worker (claude-opus-5.5), 2026-11-22 America/Los_Angeles, worktree
`contest-swarm/referee-lesson-swarm/candidate`.

## Result: 0 verified cases of the 5 required

| Count | What |
| ---: | --- |
| 13 | Commits in the supplied log that touched the Showdown engine or its rule tests |
| 4 | Commits whose diff the source file contains (only these were analysed) |
| 1 | Real engine defect found: the `hitBack` attack-event value. Its observable is an event field, so the state-only referee cannot judge it (`candidate-unsupported`) |
| 0 | Rules/state defects (state after an action differs between parent and fix) |
| 0 | Corrected existing test expectations |
| 0 | Sealed, verified cases |

`inputs.json` and `answers.json` stay empty and the manifest stays unsealed, so `history.mjs verify`
and `run` still fail with "not sealed". The per-commit record is in [`triage.json`](triage.json).

## Source and method

The source is `.artifacts/referee-work/history-source.md`, the coordinator's output of `git log`
and `git show` from a full clone (not shallow, per its header). This session's shell tool was
refused again (`tool permission approval is not supported in non-interactive mode`), so I ran no
`git` or `node` command. Everything below is read from those diffs. No engine was run at any
revision.

## Findings by commit

### `0beb0d5` "Showdown: fix what an independent review found" (parent `c40a767`)

This is the only commit in the log whose subject matches the miner's fix pattern. It changes
`prototypes/showdown/rules.js` and `prototypes/showdown/rules.test.js` in three places:

1. **`hitBack` in the attack event (real engine defect, reporting only).** At the parent the
   value is `attacker.health - outcome.attackerLeft`: the orbs the attacker lost, capped by the orbs
   it had. The fix reports the defender's attack, or 0 when the target is the Base, is covered, or is
   destroyed. The new test states the case: a 1-orb Skeleton attacking Mounted Billy reports 1 at the
   parent and 3 at the fix. `defender.health` and the attacker's health come from `attackOutcome`,
   which neither diff touches, so the state after the attack is the same at both revisions. The
   defect was introduced in `cb6c402` (parent `b8528fa`), which added the field.
   - It is an **engine** defect, not UI-only: the value is in the engine's event output.
   - It is **not a state defect**: under the boundary contract the normalized output tracks state
     and has no event log, so the referee has no value to compare.
   - The test is a **newly added regression test**
     (`the hit back an attack reports is the defender's attack, and the bot leaves a finished game alone`).
     It does not correct an existing assertion, so it is not a test-expectation case.
   - A reachable fixture is not built. The test reaches the position with a hand-built `position()`
     helper. Both revisions predate `f44af67`, which moved the engine to `src/game/showdown/`. Their
     `createShowdown` takes deck counts and shuffles by seed; it does not take ordered decks. A legal
     prefix from ordered decks would need an adapter for that older API, and I could not run one.
2. **`openingHand` replaced by `arrivals`.** Boss arrival rules. Excluded: boss scope.
3. **`playTurn` returns at once on a finished game.** CPU only; `applyAction` is unchanged.
   Excluded: bot policy.

### `3dd47f1` "Showdown level-2 bot: stop the plan at a Scout draw…" (parent `a9aa828`)

The fix stops the bot from reading its own deck order through Scout. This is a real fairness
defect in the CPU, but only `planTurn`, `playTurn` and the new helpers `knowable` and `hideDraw`
change. A blind input lists every action, so the referee never calls the bot. The test file
`tests/game/showdown-fair-bot.test.js` is new and corrects no existing assertion.
Excluded: bot policy.

### `a2bbe19` (parent `e0f1db2`) and `cb6c402` (parent `b8528fa`)

`a2bbe19` adds an optional `onAction` callback to `playTurn`. `cb6c402` adds the `hitBack` field with
the formula that `0beb0d5` corrects, so it is where the defect started, not a fix. Excluded.

### Not examined

The source lists 9 more commits without their diffs: `5e9da0b`, `44d31ee`, `f44af67`, `ed38905`,
`f3f9dc3`, `5a2166b`, `4c47a39`, `a7d64d3` and `f3cae35`. Their subjects describe features, moves
and art direction rather than fixes. I have not read their diffs, so I make no claim about them.
`5e9da0b` changes the seeded generator. That can change seeded deals, but inputs with ordered
decks do not depend on the shuffle.

## Changes to the runner

- `history.mjs` now mines `prototypes/showdown/rules.js` and `cards.js` as engine paths. Before
  this change, `mine` would have classified `0beb0d5` as test-only. `materialize` extracts whichever
  of `src/game` and `prototypes/showdown` a revision has; before, it failed on every revision older
  than `f44af67`.
- `tests/game/referee-history.test.js` covers the old engine path and checks that `triage.json`
  counts nothing as verified unless the case has a sealed answer.

## Open integration points

- **Event-level observables.** To judge `hitBack`, the referee's normalized output would need a
  per-action event record. That schema belongs to the referee owner. Until it is frozen with events,
  this case stays unsupported.
- **Adapter for the pre-move engine.** The engine adapter must take ordered decks on revisions where
  `createShowdown` accepts only counts and a seed. It might do that by setting `sides[side].deck`
  after creation, but nobody has checked that this matches dealing order at those revisions.
- **More candidates.** The rest of the history needs `git log -L` on `attackOutcome`, `legalActions`
  and the trap, Lasso, cover and location branches of `rules.js`, plus `git log -p` on
  `prototypes/showdown/rules.test.js`. Look for changed `assert` lines, not added ones. The 9
  commits listed above also need their diffs read.

## Checks

None ran in this session. These need to be run:

- `node --test tests/game/referee-history.test.js`
- `node scripts/referee/history.mjs mine --repo .`, to confirm that `0beb0d5` is now an
  `engine-defect-candidate`
- `node scripts/referee/history.mjs verify` should still exit non-zero with "not sealed". That is
  the correct result for an empty set.

## Session 2026-11-23 07:28 America/Los_Angeles (Kiro CLI, claude-opus-5.5)

Result: still 0 verified cases. Nothing above was changed, and `inputs.json`, `answers.json`,
`manifest.json` and `triage.json` were left as they were.

Blocker: the shell tool refused every command again with `tool permission approval is not
supported in non-interactive mode. Use --trust-all-tools to auto-approve tool use, or drop
--no-interactive.` So this session could not run `git log`, `git show`, `git log -L`,
`node scripts/referee/history.mjs`, `python3 proof/referee/referee.py` or either archived JS
revision.

Read-only checks this session made with the file reader:

- `.git/objects/pack/` in this checkout is empty. `.git/objects/info/alternates` points to
  a separate Showdown maintenance checkout's `.git/objects` directory.
  Git stores those objects zlib-compressed, so no parent or fix source can be read without `git`.
- `.artifacts/referee-work/history-source.md` has not changed since the first session (mtime
  07:07, before this report's 07:10). It holds no diffs beyond the four analysed above.
- The frozen referee pin is in `proof/referee/freeze.json`: entry `proof/referee/referee.py`,
  `treeSha256` `b37a1478c683a42b61b1fa51c83ee07cf4f7dd2486bb5b5d5d7fde64ea611f8d`, adapter
  `scripts/referee/adapter.mjs` `79c9f083…ab30`. The manifest's `referee.sha256` stays null
  until a run checks that the tree still hashes to that value.

No candidate was promoted. The `hitBack` case stays `candidate-unsupported` for the reasons in
`triage.json`: it is an event field outside the state schema, and those revisions predate the
ordered-deck engine API.

### To continue (needs a shell with tool approval, for example `--trust-all-tools`)

1. `git log --format='%H %P %s' -- src/game/showdown/rules.js prototypes/showdown/rules.js src/game/showdown/cards.js prototypes/showdown/cards.js .kiro/specs/duel-card-pipeline/cards/`
   and `git log -p -- prototypes/showdown/rules.test.js tests/game/showdown-properties.test.js`.
   Look for changed `assert` lines (test-expectation cases) and changed branches in
   `attackOutcome`, `legalActions`, and the trap, Lasso, cover and location code (engine cases),
   not only subjects that contain "fix".
2. Prefer fixes at or after `f44af67`, where `createShowdown` lives in `src/game/showdown/`, so
   that `scripts/referee/adapter.mjs` can take ordered decks without the unchecked pre-move adapter.
3. For each candidate: `node scripts/referee/history.mjs materialize` (or `git archive`) at the
   parent and the fix, replay one minimal legal prefix on both, and keep it only if a state field
   differs at a named JSON pointer in the referee's normalized output.
4. Write the blind duel to `inputs.json` and the parent, fix, pointer, rule and test to
   `answers.json`, then `node scripts/referee/history.mjs seal`, `verify`, and
   `run --referee proof/referee/referee.py --adapter scripts/referee/adapter.mjs`.
