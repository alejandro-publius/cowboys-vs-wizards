# Can the even-match duel sample establish individual card balance?

Status: blocked

Codex reviewed the measurement section of the Night Shift balance contract against the shipped even-match decks at `07e2b79`. The question is whether scaling this particular experiment can establish a 45–55% win rate for all 29 cards.

## Findings

- Eight cards never enter either deck. The missing Cowboy cards are Captured Dragon, Captured Wraith, Gatling Crew, Six-Shooter and Sheriff's Office. The missing Wizard cards are Lantern Wraith, Bone Armor and Boneyard. The deck lists are fixed before the shuffle, so increasing the number of seeds cannot change this coverage.
- Every included card appears in its faction's deck in every duel. This gives Sheriff and Lasso identical in-deck win rates even when only one was drawn. A change to either card can move both rates together. Neither statistic identifies which card affected the outcome.
- Restricting the sample to games in which a card was played changes the question. A seven-star troop needs two tributes, so games where it reached the board select for players who had already developed their board. Comparing that win rate directly with a free troop's would mix card strength with board position.

Keep the faction and opening-seat requirements as measured. For the separate card target, record the deck list, replacement card, seat and seed for each comparison. Choose the per-card pass criterion before running the holdout. A paired substitution can estimate the change in match outcomes for that deck and matchup.

[Decks and tribute costs](../../../src/game/showdown/cards.js) · [Duel runner and counting rules](../../../scripts/balance-evidence.mjs) · [Balance requirements](requirements.md)
