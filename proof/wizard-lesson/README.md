# Wizard lesson policy

Owner: native Kiro CLI worker (claude-opus-5.5), 2026-11-22 America/Los_Angeles.
Code: `src/game/showdown/wizard-lesson-policy.js`. Tests: `tests/game/wizard-lesson-policy.test.js`.

## Status

| Item | State |
| --- | --- |
| Module and tests written | done |
| `node --test tests/game/wizard-lesson-policy.test.js` | **pending**: the worker session could not run shell commands (non-interactive permission refusal) |
| Authentic bait from seed search (`find-bait.mjs`) | **pending**: not run, so no bait seed is claimed |
| Native Kiro coach, rival and reviser runs | **pending**: none run; no lesson bundle exists, cached or fresh |

There is no `bait-search.json` or lesson bundle in this folder yet. Add one only from a real run.

## What it changes

It changes only the Wizard CPU strategy, and only when a player opts in. Cards, decks, rules and art are not touched. Without a policy, `wizardTurn` runs the same plan-and-replan loop as `playTurn(state, 2)`, and the tests compare the two to check they match.

Policy rule (`kind: "wizard-hellfire-hold"`):

1. Emergency (always on). The Wizard casts Hellfire when the Cowboy board's estimated next-turn Base damage is at least the Wizard Base and Hellfire would bring it below that.
2. Hold. The Wizard plans the turn with Hellfire removed from its own hand when the Cowboys have fewer than `holdBelowTargets` troops, the Wizard Base is at least `holdWhenBaseAtLeast`, and no Cowboy troop has more than `holdWhenMaxAttackAtMost` attack.
3. Otherwise, the original planner decides.

Every action passes the real `legalActions` check before `applyAction`. The planner sees `lessonView`, where the Cowboy hand, deck and traps are `"hidden"` placeholders of the same length.

## Interface contract

Data (plain JSON, version 1):

```text
Episode  {version:1, seed:uint32, setup, actions:[{side:"cowboy"|"wizard", action}], markedIndex, tag:"bait"}
Setup    {first:"cowboy"|"wizard", cpu:{side:"wizard", level:2}, baseOrbs?, decks?, opening?}
Policy   {version:1, kind:"wizard-hellfire-hold", holdBelowTargets:1-3,
          holdWhenBaseAtLeast:0-10, holdWhenMaxAttackAtMost:0-10, emergencyLethal:true}
Bundle   {version:1, episodeKey, source:"cached"|"fresh",
          proposal:{policy, provenance}, counterexample:{episode, provenance}, revised:{policy, provenance}}
Provenance {tool:"kiro-cli", native:true, role:"coach"|"rival"|"reviser", runId, model, finishedAt}
```

Any unknown key, any non-integer value, or free text anywhere is rejected. An action uses the engine's own shape (`summon`, `spell`, `gear`, `location`, `set`, `attack`, `cover`, `end`).

Functions:

| Export | Use |
| --- | --- |
| `createEpisodeRecorder(seed, setup)` | UI: freeze the setup at deal time, call `record(side, action)` for every applied player and CPU action, then `toEpisode(markedIndex)` |
| `validateEpisode`, `replayEpisode(ep, {policy})` | Check shape, then replay on the engine. Each Wizard action must be the CPU's real choice. Returns `turnStart`, `marked` and `final` |
| `baitReport(ep)` | Says whether the marked action is the original Wizard casting Hellfire on one non-lethal troop |
| `findBaitEpisode({from, to})` | CLI: search seeds for an authentic bait. Returns `{episode: null}` when there is none |
| `validatePolicy`, `loadRematchPolicy(p, {optIn:true})` | Returns null unless `optIn === true` |
| `wizardTurn(state, {policy, level, onAction})` | Drop-in for the Wizard's `playTurn`. `onAction(before, applied, action)` |
| `decideHellfire(state, policy)` | Returns `force`, `hold` or `baseline` plus public facts, for UI explanation |
| `checkCounterexample(ep, policy)` | Rival check. The episode must be reachable with `policy` on earlier Wizard turns, the policy must hold, and the Cowboy bot must then win, where the original Wizard would not lose |
| `verifyLessonBundle(bundle, baitEpisode)` | Returns `{ok, source, revised, report}`. Load `revised` only if `ok` and the player opted in. Show `source` as given |
| `episodeKey(ep)` | Matches an episode to a precomputed bundle when offline |

## Unsupported or limited

- The policy runs only on the level-2 Wizard. Levels 0, 1 and 1.5 ignore it.
- `boardThreat` is a public-board estimate. It ignores Cowboy cards still in hand, traps, troops that fall mid-turn and Sweep, so "lethal" means lethal on the board.
- Replay of a full-game episode needs the CPU's Wizard turns to match the engine exactly. An episode from a duel with `arrivals` (bosses) is rejected because `setup` does not accept `arrivals` yet.
- In `checkCounterexample` and the seed search, the level-2 bot stands in for the Cowboy player. A human counterexample is replayed but judged against that bot's reply.
- Provenance fields are checked for shape only. Nothing here can confirm that a Kiro run actually happened, so the coordinator must keep the receipt next to each bundle.

## Open integration points (other owners)

- `src/match/showdown-session.js`: call `wizardTurn` in place of `playTurn` for the Wizard seat when an opted-in policy is loaded, and feed `createEpisodeRecorder`.
- UI (illustrated Pages): mark-as-bait control, opt-in rematch, and a cached-vs-fresh label taken from `bundle.source` plus provenance.
- CLI: a native Kiro workflow writes coach, rival and reviser outputs as JSON. Run `verifyLessonBundle` before anything is loaded. Model output is never evaluated as code.
- Precomputed offline lesson: needs a real bait from `find-bait.mjs` and real native runs. Neither exists yet.
- Release: no spec requirement ID covers this yet, so goal.md commit rules need one from Fable or the user before a commit.
