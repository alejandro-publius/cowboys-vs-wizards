# CARD-WIZARD-LANTERN-WRAITH design

## Entrance

`duelFor` builds a hunt with `opening: {wizard: [{type: "wizard-lantern-wraith", health: orbs}]}`. `createShowdown` places each opening troop with `arrive(type + "-0", 0, {health})`. `arrived: 0` means the boss never counts as having arrived this turn, so it attacks on the Wizards' first turn. The opening health is not capped at the printed 4 orbs.

Compare the Graveyard Dragon (`card-wizard-dragon`), which arrives later through `arrivals` and rests on landing.

| | Lantern Wraith | Graveyard Dragon |
| --- | --- | --- |
| Entrance | `board`: slot 0 before turn 1 | `lands`: Wizard turn 4 or later |
| Rests on entry | No | Yes |
| Hunt orbs | 4, 5, 6, 7, 8 | 2, 3, 3, 4, 4 |
| Keyword | Ghostly | Sweep |
| Reward | Captured Wraith | Captured Dragon |

## Ghostly

`legalActions` skips a troop with `ghostly` only when building targets for a spell whose effect has `target: true` (Deadeye and Lasso for the Cowboys). Attacks, Sweep and traps never check it.

## Interactions with other card types

| Other card | Result |
| --- | --- |
| Deadeye, Lasso | Cannot target it. |
| Cowboy attacks | Can target it, unless an escort Bone Wall is up: then the Bone Wall must be attacked first. |
| Gatling Crew, Captured Dragon (Sweep) | Hit it for 1 when they attack another Wizard troop. |
| Bear Trap | Springs on its attack. |
| Escort Bone Wall | Guards the Wraith from Cowboy attacks. |
| Escort Hex | Cancels the first Cowboy attack. |

## Visible results

The Wraith's attack has its own timing `[1010, 550]` in `event-positions.js` (shared with the Captured Wraith). This spec adds no animation.

## Design notes for Fable (not requirements)

- The escort pairs a Ghostly boss with 2 Bone Walls. The Graveyard Dragon escort dropped its Bone Wall because it made that hunt close to unwinnable (`progress.js` comment). No similar measurement is recorded for the Wraith. `docs/evidence/graywave-scout-sims.md` has win-rate rows for Wraith hunts; confirm which build and rules it measured before relying on it.
