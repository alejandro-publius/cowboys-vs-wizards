# Kiro: graybox hand readability (blocked-card reasons)

Worker: Kiro (Kiro IDE session, model Claude Opus 5.5). Branch
`kiro/graybox-hand-readability`, base `bdc9c36`, one local commit. Not
pushed or merged.

## Change

On the plain graybox hand, each card that has no legal play shows why, before
it is clicked. The text is the existing `blockedReason` message that a click
on the card already returned.

- `src/match/selection.js`: new `blockedReasons(view)` returns
  `{cardId: blockedReason(view, card)}` for each hand card that is not among
  the legal playable IDs. It returns `{}` outside the viewer's phase or after
  the result. `selectionOptions` output is unchanged; it now shares the
  `playableIds` helper.
- `src/ui/card-model.js`: opt-in `blockedReasons` option. With it, each hand
  card gets `blockedReason`: the text while input is accepted and the card is
  unplayable, otherwise `null`. Without it, hand cards keep their old shape.
- `src/graybox.js`: passes `blockedReasons(displayed)` only during
  `accepting_input`.
- `src/ui/cards.js`: in plain mode only, an unplayable card's button gets a
  `<small class="plain-card-reason">` with the reason and `aria-describedby`
  pointing at it. The `aria-label`, data attributes, enabled state and click
  and focus handling are unchanged. The illustrated (non-plain) path renders
  nothing new.
- `src/ui/graybox.css`: one rule for `.plain-card-reason`.
- Tests: one focused test in each of `tests/match/selection.test.js` and
  `tests/match/card-model.test.js`.

Legality, interactions, seeds, the 3D UI and assets are unchanged.

## Seed 14, starter deck, Cowboy opening hand

Hand order and values are from the `t.diagnostic` lines of the new card-model
test. Each line is: name | stats | cost, plus the reason line. These are the
model fields the plain card renders. They are not a browser capture.

Before (`bdc9c36`): no reason on any card. Zero legal plays. The reason
appeared only as the message after a click.

```
Billy | 2 attack · 4 life | 1 tribute
Mounted Billy | 3 attack · 5 life | 2 tributes
Billy | 2 attack · 4 life | 1 tribute
Billy | 2 attack · 4 life | 1 tribute
```

After: the same cards, each with its reason shown before a click.

```
Billy | 2 attack · 4 life | 1 tribute | Billy needs 1 tribute troop; you have 0 on the board.
Mounted Billy | 3 attack · 5 life | 2 tributes | Mounted Billy needs 2 tribute troops; you have 0 on the board.
Billy | 2 attack · 4 life | 1 tribute | Billy needs 1 tribute troop; you have 0 on the board.
Billy | 2 attack · 4 life | 1 tribute | Billy needs 1 tribute troop; you have 0 on the board.
```

## Reason cases covered by the selection test

Each case checks that `blockedReasons(view)` equals the click message for every
unplayable card, has no playable card ID and leaves the view unchanged.

- Insufficient tributes (seed 14): the Billy and Mounted Billy texts above.
- Full board: `No open tile for Sheriff.` Billy stays playable through a vacated tribute slot.
- Previously used action: `You have already summoned this round.`,
  `A spell was cast this round, and summons must come first.`,
  `You have already cast a spell this round.`
- Spell with no target: `Deadeye has no target: the enemy has no troops on the board.`
- No reasons in the Wizard phase (seed 27 Cowboy view) or after a result.

The card-model test checks four more things. Reasons appear only for
`accepting_input`, and are `null` for submitting, playing, cpu_turn and
terminal. A card the options mark playable never gets one. Opting in adds
only `blockedReason`.

## Check

```
node --test tests/match/selection.test.js tests/match/card-model.test.js
```

Run once after editing, on Node v26.0.0: tests 12, pass 12, fail 0,
duration_ms 1528.2.

## Not run

- Browser replays, the renderer build, other test files and any
  screen-reader check were not run.
- Browser scripts that compare plain hand-card text may now see the extra
  reason line on unplayable cards. This was not checked.
