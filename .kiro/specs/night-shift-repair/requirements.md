# Night Shift repair protocol

## Introduction

This spec fixes how one Night Shift balance repair is found, nominated and
confirmed. Seed ranges live in `protocol.json` next to this file. Decisions use
NSB-1 and NSB-2 exactly as written in
`.kiro/specs/night-shift-balance-contract/requirements.md`; this spec adds no
threshold of its own. Nothing here edits a real card, the balance contract or
earlier evidence.

## Shared interface

- `scripts/field-trial-engine.mjs` exports
  `async openTrialEngine(dir, ref, change = null, expectedInputs = null)`
  returning `{rules, inputs}`. `dir` is a new private temp path. `ref` is the
  frozen git commit. `inputs` maps each path to its git object ID for
  `src/game`, `.kiro/specs/duel-card-pipeline/cards`,
  `scripts/sync-card-specs.mjs` and `prototypes/showdown/rules.js`. `change` is
  `{card, field, from, to}`; `null` opens the baseline.
- It also exports `playTrial(rules, seed, first, onStep?)` returning
  `{winner, endTurn}`. `onStep(before, applied, action?)` is called on each
  applied engine action. The historical `playTurn` in `rules.js` emits only
  the before and after states and their events, so `action` may be absent; the
  witness uses the authentic `applied.events` and never fabricates an action
  payload.
- `scripts/field-trial-scout.mjs`, `scripts/field-trial-confirm.mjs` and
  `scripts/field-trial-witness.mjs` are independent scripts. None imports
  another's results or state.

## Requirements

1. First-brief diagnosis. The repair agent's first brief contains the baseline
   scout measurements for both scout ranges. The agent states its diagnosis
   from that brief before it proposes any edit.
2. Open choice among adjacent edits. The agent chooses which card and field to
   change. Each proposal is one `{card, field, from, to}` change where `from`
   matches the frozen value and `to` is an adjacent value of that field. The
   protocol does not preselect the card or field.
3. Two existing rules. A candidate passes only if NSB-1 and NSB-2 both hold on
   every scout range, measured against the baseline on the same range.
4. Nomination. The agent nominates at most one passing candidate. Scouting
   ends at nomination.
5. Independent terminal fresh confirmation. After nomination, the confirm
   script runs baseline and candidate on both confirm ranges in a new private
   directory at the same `ref`, passing the nominated `inputs` as
   `expectedInputs`. NSB-1 and NSB-2 decide the result on each confirm range.
   That result is final for this repair.
6. Fresh outcomes stay unseen by tuning. Confirm-range outcomes are never shown
   to the agent before nomination and are never used to choose, adjust or
   replace a later edit. A failed confirmation ends the repair; any new attempt
   needs new confirm seeds recorded before it starts.
7. Honest, legal, playable evidence. Every reported game is a real
   `playTrial` run whose actions the witness replays as legal from the recorded
   `before` state. Each receipt records `ref`, `inputs`, `change`, seeds,
   seats and per-game `{winner, endTurn}`. A missing input, mismatched object
   ID, illegal action or non-finite measurement fails the run. Reports state
   only results that were actually run.
