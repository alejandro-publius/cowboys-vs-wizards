# Showdown smoke sample in the release gate and card review

Date: 2026-11-24 (America/Los_Angeles). Author: Claude Code (Claude Opus 5.5). The work was done in a local CLI session on branch `claude/showdown-active-proof-20261124`, based on `0464dfa`. Node v26.0.0.

This was **not a Kiro run**. No Kiro hook, workflow step or native receipt ran for this change. The commands below are the local CLI runs of the commands those hooks and steps name.

## Change

Before this change:

- The release gate (`node scripts/contest-release-gate.mjs release`, which the PostTaskExec and Stop hooks and the release-preflight workflow steps use) ended with `scripts/deck-balance.mjs --decks 1 --from 0 --count 4`. That script imports the retired lane rules (`src/game/cards.js`, `deck-builder.js`, `opening-policy.js`, `state.js`) and prints `rules orb-duel-draft-1`.
- The Card Summoning Circle sample step ran `scripts/simulate-matches.mjs`, which is also lane-only.
- Neither script can play a Showdown-only card. One example is Bone Wall, which has two copies in the current Wizard even-match deck.

Both now run [`scripts/showdown-smoke.mjs`](../../scripts/showdown-smoke.mjs):

- **Engine:** the public game's `src/game/showdown/rules.js`, with the even-match `DECKS` from `src/game/showdown/cards.js`.
- **Seats:** each seed is played once from each opener.
- **Players:** the level-2 bot on both sides, through the existing `play()` in `scripts/billy-replay-engine.mjs`.
- **Records:** each game records its winner, ending, turns, the card types each side played from hand and the traps that sprang.
- **Coverage:** a deck card is `observed` only if a game played it. A deck card never played is `in-deck-unobserved`. A catalog card in neither deck is `outside-sample`. Neither of the last two gets coverage credit.

The gate validates the JSON with `smokeProblems`, which recomputes every summary from the game records. It withholds `ok: true` in any of these cases:

- the sample comes from another engine, or names another deck set or plan;
- the cohort is missing, duplicated or unfinished;
- a played card is outside the decks;
- a summary does not follow from the records;
- the validator fails.

The stamp keeps the engine file hashes, seeds, results by opener, the observed, unobserved and outside-sample lists, and the records hash. These files joined the fingerprint:

- `scripts/showdown-smoke.mjs` and `scripts/night-review.mjs`;
- the Card Summoning Circle workflow and R5, which the new test reads.

A test checks that every file the sample imports, and both of those files, is fingerprinted.

Each troop line prints the engine's stars, attack and health. Deck copies come only from the even-match `DECKS`. The card-review step therefore reports a `copies` proposal, or a stat the printed values do not show, as not measured.

## Observed

| Command | Games | Results | Coverage | Records sha256 |
| --- | --- | --- | --- | --- |
| `node scripts/contest-release-gate.mjs release` (sample `--from 0 --count 8`) | 16 (seeds 0-7, each opener 8) | Cowboy 11, Wizard 5, draws 0; first seat 7, second 9; all 16 ended on a Base | 21 of 21 deck card types observed, 7 of them Showdown-only; 8 outside the sample | `c1e0b7aaf249693b305fa725b4043bef79008cf24312adf55132a51088dce6e7` |
| `node scripts/showdown-smoke.mjs --from 0 --count 100` (the R5 step command) | 200 (seeds 0-99, each opener 100) | Cowboy 125, Wizard 75, draws 0; first seat 113, second 87; all 200 ended on a Base | 21 of 21 observed; 8 outside the sample | `c63067b2d63ea525fd8a6e33bd97d6ad0c5f72d292a02eede4c0ee5f571e70f5` |

- **Gate runs:** the gate ran twice, before and after the review fixes. Both exited 0. In each, G1-G4 passed 60 runs apiece at seed 23820, then `scripts/verify-duel.mjs` passed, then the sample.
  - Between the runs, `node scripts/contest-release-gate.mjs pre-task` reported `stamp is stale` for the edited tree.
  - After the second run, `status` reported `fresh: true` at fingerprint `55c3318d1b5c2a92b4beb5ba246cfdefdf232d5d8d56b0412f26e76f0f991eaf`, with `checks[2]` = `scripts/showdown-smoke.mjs --from 0 --count 8 --json`.
- **Bone Wall** (`wizard-bone-wall`, Showdown-only, 2 copies) was played in 13 of 16 games (19 plays) in the gate sample. That matches an independent baseline at `0464dfa`, and a plain engine loop in the test that counts summon events.
- **Bone Wall in the R5 sample:** played in 163 of 200 games (229 plays).
- **Repeat runs:** the seeds 0-99 command, run twice, printed the same records hash. The seeds 0-7 hash was the same from the CLI, the test and the gate. The test also compares two in-process runs.
- **Outside the sample, no coverage:** cowboy-captured-dragon, cowboy-captured-wraith, cowboy-gatling-crew, wizard-lantern-wraith, cowboy-six-shooter, cowboy-sheriffs-office, wizard-bone-armor, wizard-boneyard.
- **Tests:** `node --test tests/game/showdown-smoke.test.js` passed 8/8. Together with the affected suites `tests/game/showdown-fast-check.test.js`, `tests/game/showdown-balancer-loop.test.js`, `tests/match/night-shift-hooks.test.js`, `tests/match/card-forge.test.js` and `tests/game/card-specs.test.js`, 93/93 passed.

## Independent review

The finished diff was reviewed by a native Claude Code Workflow, `wf_506a98a7-097`. It used three read-only agents: a gate-wiring reviewer, a measurement and workflow-text reviewer, and one skeptic who tried to refute each finding. This was not a Kiro run. Both findings were confirmed and fixed before the final gate run:

1. **Fingerprint gap (minor):** the new test read the card-review workflow and R5, but the fingerprint did not cover either file. Both are now in `WATCHED_FILES`.
2. **Unmeasured copies proposals (important):** a `copies = N` proposal never reaches Showdown. The sync step drops `copies`, and `DECKS` is fixed, so the step would have reported a sample that left the change out. Now:
   - the CLI prints the engine values and a copies line;
   - the step receives `{{proposal}}` as labelled data, never in its command;
   - an unmeasured proposal is marked pending.

The gate reviewer found no path to `ok: true` with a bad sample. It checked exit 0 with bad stdout, a validator throw, an import failure and a timeout.

## Limits

- This is a smoke regression signal for these seeds, these decks and this bot. It is not a balance verdict and does not approve any card change. Fable's thresholds and the 100,000-game Billy evidence are unchanged and were not rerun.
- Hellfire is listed only when the enemy has a troop (`src/game/showdown/rules.js` `legalActions`). So the sample never measures an empty-board Hellfire. The open empty-board Hellfire question is unchanged.
- The Card Summoning Circle step was not executed as a Kiro Workflow. Only the command it names was run here. Whether the step's agent reports the coverage line as instructed is unverified.
