# CARD-WIZARD-WIZARD design

## Where the card lives

`wizard-wizard.json` is a lane card that also carries a `showdown` block, so it appears in both `CARD_SPECS` (with `copies: 3`) and `SHOWDOWN_SPECS` (without `copies`). `cards.js` `entry()` gives it `keys: ["raise"]`. Raise is the only keyword-driven code that reads a graveyard.

## Summon and Raise sequence

`applyAction` with `{type: "summon", cardId: "wizard-wizard-N", tributes: [slot]}`:

1. For each tribute slot: emit `tribute`, then `defeat()` pushes the troop id and its gear ids to `own.discard` and empties the slot.
2. Remove the Wizard from the hand and place it with `arrive(..., {paid: true})` in `own.board.indexOf(null)`. Emit `summon`.
3. Scout does not apply.
4. Raise: `own.discard.findLastIndex(id => kind === "troop" && tag === "Undead")`. If found and `own.board.includes(null)`, splice that one id out and `arrive(id, turn, {health: 1})` in the next empty slot. Emit `raise`.

Step 1 happens before step 4. That is why a tributed Skeleton is the troop Raise returns (requirement 12). `arrive` defaults `paid` to false, so the returned troop rests (requirement 13).

## Board arithmetic

| Troops before | Legal? | Board after (Wizard + raised) |
| --- | --- | --- |
| 0 | No (requirement 05) | — |
| 1 | Yes | Wizard + raised troop, 1 slot free |
| 2 | Yes | Wizard + other troop + raised troop, full |
| 3 | Yes, 3 choices | Wizard + 2 others, full: Raise does nothing (requirement 14) |

## Interactions with other card types

| Other card | Result |
| --- | --- |
| Skeleton, Bone Wall, Headless Horseman, Lantern Wraith | Undead: can return with 1 orb. |
| Imp, Jack-o'-Lantern (Fiend), Raven Familiar, Dragon (Beast), Wizard (Mage) | Never returned. |
| Bone Armor | Goes to the graveyard with its carrier and stays there when the carrier is raised. |
| Hellfire, Singularity, Hex, Boneyard in the graveyard | Skipped by the search. |
| Boneyard in play | A raised Undead troop has +1 attack, but it still rests that turn. |
| Cowboy Bear Trap | A tribute-paid Wizard that attacks at once still springs the oldest trap first. |

## Visible results

- Log lines come from `presenter.js`: "... was paid as tribute.", "... arrived.", "Raise: The Wizards' <name> returned from the graveyard with 1 orb."
- `event-positions.js` turns `raise` into a `raise` beat from `source(side, "discard")` to the board slot. The beat reuses the engine's after-state troop, so it shows 1 orb.

## Design notes for Fable (not requirements)

- Paying a Skeleton for a Wizard returns that Skeleton at 1 orb. The tribute therefore costs only 2 orbs of Skeleton health, not a troop. The rulebook spells this out as a ruling, so it is intended. A playtest question remains whether players read it as a cost at all.
