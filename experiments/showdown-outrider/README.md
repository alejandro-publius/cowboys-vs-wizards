# Outrider vs the Sheriffs it replaced (The Bone Fence)

Kiro CLI worker experiment, assignment 1 (K-093/K-097). A paired "shadow" comparison:
each deal is played twice, once with the deck a two-win career actually holds and once
with the two Outriders put back as the two Sheriffs they replaced. Nothing else changes.
It measures; it does not change any card, rule, deck, Trail setting or saved career.
Design and balance calls stay with Fable.

## Acceptance and seed policy (written and committed before the first run)

Setup, the same for every pair:

- Career: `newSave()` then `settle(save, "trail", true)` twice (Boot Hill, Raven Roost),
  offer cleared. In memory only; no storage is read or written.
- Treatment deck: that save's 16-card deck. It must pass `deckProblems` and must contain
  exactly 2 `cowboy-outrider`.
- Control deck: the same deck with the 2 Outriders replaced by 2 Sheriffs (the swap
  Raven Roost's reward made). It must also pass `deckProblems` for the same save.
- Duel: `duelFor(save, "trail")`, which must be The Bone Fence (Wizard deck, Wizard Base 4,
  Cowboy Base 5, Cowboys first).
- Deck order: the control deal is the treatment deal with `cowboy-outrider-1/-2` renamed
  to `cowboy-sheriff-5/-6` in place, so every card sits at the same position in hand and
  deck in both arms. The Wizard deal is byte-identical in both arms.
- Cowboy policy: one-ply greedy, deterministic, reads only a public view (own hand, own
  board, own Base, both boards, both Bases, card counts). It never sees the Wizard hand,
  Wizard deck, Wizard trap identities or its own deck order. A test checks this.
- Wizard policy (primary): the Trail's level-0 rule (any legal action, no cover, traps
  blind), but the action index comes from a hash of (seed, turn, step) instead of the
  whole position, so hidden Cowboy card names cannot steer it. Secondary: the shipped
  `playTurn(state, 0)` bot, whose hash reads the Cowboy hand and deck; reported separately.

Seed range: seeds 0 to 999 inclusive, 1000 pairs, fixed now. No seed is dropped or added
after seeing results; no second range is run to improve a number.

Counts (each with its denominator):

1. Rider drawn: games in which an Outrider reaches the Cowboy hand.
2. Ride offered: Cowboy decision points where a legal attack `{slot of an Outrider,
   target: "base"}` exists while the Wizards have at least one troop. A Sheriff never
   has that option (checked in the control arm: zero Base attacks past troops).
3. Guard prevents it: decision points where an Outrider could attack, the Wizards have
   troops, and a Guard troop among them removes the Base option.
4. Ride taken: how often the policy chose an offered ride.
5. Paired outcomes: (treatment, control) result per seed; discordant pairs reported.

Negative controls: (a) control deck vs itself must give 1000/1000 identical games;
(b) control deck vs the control deck with Sheriff copy ids relabelled (same cards,
different ids) must give 1000/1000 identical games under the primary Wizard policy.
The same relabel run under the shipped bot measures how much hidden card names move it.

Replay: the lowest seed with a ride offered is replayed to that decision point, the
offered action is checked against `legalActions`, and the visible position is printed.
If no seed offers a ride, the result is reported as null.

Pass: all setup checks hold, both negative controls are identical, the counts and their
denominators are printed, and the replay is legal (or the null result is stated).

## Commands

    node experiments/showdown-outrider/run.mjs            # full table, seeds 0-999
    node experiments/showdown-outrider/run.mjs --json     # same, as JSON
    node experiments/showdown-outrider/run.mjs --replay   # lowest seed offering a ride
    node experiments/showdown-outrider/run.mjs --replay 17
    node --test experiments/showdown-outrider/outrider.test.js
