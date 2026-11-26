# An even fight, and cover that matters: brief for Kiro

> Archived on November 26. The [Even Fight preview and promotion checks](even-fight-preview.md) describe the current build. The dated brief below records Fable’s original approved wording.

Fable 5.2, November 20, 2026. Alex approved these changes on November 20. This is the one fix brief the [release line](release-line.md) holds a slot for. It closes the two open balance numbers (the first-player and Cowboy leans) and one design gap: taking cover was never the right answer to a big Wizard turn.

**Do not merge before Monday, November 23.** The three first-time playtests run through Sunday on the build that is live now. Build and check on a branch before then.

## What changes

1. **The even-match Wizard deck** holds 3 Skeletons and 2 Imps, where it holds 4 and 1 today. Nothing else in either deck changes, and no card changes.
2. **The side that goes second starts with 7 Base orbs** in the even match, best of three and two players. It keeps its extra opening card. Trail, rival and bounty duels keep the Base numbers they have today.
3. **A troop in cover cannot be hit by spells.** A spell that chooses a target cannot choose it, and Hellfire passes over it. Sweep, traps and attacks are not spells and work as before.
4. **When a duel ends, both hands are shown.** This is a screen change, not a rule. It can be dropped from this brief without touching 1 to 3.

## Why

Level-2 bot against itself, each deal played from both seats, 2,000 games per row, on scratch copies of `main` `96adf60` (the engine files are unchanged at `755df56`). One row is good to about 2 points.

| Variant | First player wins | Cowboys win |
| --- | --- | --- |
| Today, deals 0 to 999 | 57.1% | 59.4% |
| Change 1 alone | 54.8% | 49.6% |
| Change 2 alone | 52.7% | 59.7% |
| Change 3 alone | 56.5% | 59.8% |
| **1, 2 and 3 together, deals 0 to 999** | **49.5%** | **51.8%** |
| Today, deals 1000 to 1999 (not used for tuning) | 58.3% | 61.0% |
| **1, 2 and 3 together, deals 1000 to 1999** | **51.4%** | **54.1%** |

Across both sets the package gives the first player about 50.5% and the Cowboys about 53%. A small Cowboy edge is left, and I am leaving it for the snapshot.

What was tried and rejected:

- **A second extra card for the side going second** did nothing (58.1%). Taking its one extra card away made things worse (57.3%), so the card stays.
- **A troop already on the board for the side going second** swung the first player to 30%. Who attacks first decides too much for that.
- **The Dragon at 6 stars** (one tribute) took the Cowboys to 35.9%. See the decision card answer below.
- **Bone Wall with 1 attack** (48.2%) and **Covered Wagon with 3 orbs** (45.5%) fix the Cowboy lean by changing a card every deck uses. The deck change does it without touching a card.

Change 3 moves no balance number by itself. It is here for the player: against Hellfire, covering used to lose the covered troops anyway, and an empty board opens the Base. With it, a player who expects a burst can circle the wagons and keep a board.

## Rulebook text

Section 6, "Taking cover", gains one line:

- spells cannot choose it, and Hellfire passes over it.

Section 10 gains one ruling:

- **Cover and spells.** A troop in cover cannot be chosen by Deadeye, Lasso or Singularity, and Hellfire does not burn it. If every enemy troop is in cover, Hellfire cannot be played. Ghostly is different: it stops only spells that choose a target.

Section 3, "Setting up", step 2 becomes: "One side goes first. The side that goes second draws 1 more card and, outside the Trail, rivals and bounties, starts with 7 Base orbs."

## Done when

1. **Through the Night Shift.** Run the package through `scripts/night-review.mjs` with deals 0 to 999 as the tuning set and 1000 to 1999 as the holdout, and seal the bundle. Both shares are between 45% and 55% on both sets. If either set is outside that, stop and send me the numbers; do not retune.
2. The Sheriff's Ledger shows that sealed review.
3. `rules.test.js` has a case for each line of the new ruling: a covered troop is not a legal spell target, Hellfire skips it, and Hellfire is not a legal play when every enemy troop is in cover.
4. A test shows a Trail duel, a rival duel and a hunt start with the same Base orbs as on `755df56`.
5. `trail-sim.mjs` is run before and after and both tables are in the pull request. The ramp test in `progress.test.js` passes unchanged. If a Trail win rate moves by more than three points, stop and send me the numbers.
6. The generated property for the hidden view (property 4) holds while a duel is running, and a new case shows both hands in the view once `result` is set. Neither deck's order is ever shown.
7. `RULEBOOK.md`, `cards.csv` and the even-match deck list in the Showdown README match the code.
8. `npm test` passes.

## Night Watch target band (answer to the open question)

Yes: 45% to 55% for both the first-player share and the Cowboy share, on 2,000 games. Issue filing stays off for the snapshot.

## The Graveyard Dragon decision card (answer)

- **The hunt: no rule change.** I agree with the card. The Ranger position reverses on facts the player can see, which is what a bounty should teach.
- **The Dragon from hand in the even match: no change for the snapshot.** Its cost has no good setting on the star scale. At two tributes it is played in about a quarter of games. At one tribute it is played twice as often and the Wizards win 64%. Fixing it needs a different idea than a number, and that waits until after December 4.

## Out of scope

- Any other card, deck, reward or bot change. The bot is not taught the new cover rule here; the numbers above are with the bot as it is.
- A second Wizard trap. A face-down Wizard card is always a Hex today, so it is never a bluff. That is a new card and waits for the playtest result.
- Art, models and animation.
