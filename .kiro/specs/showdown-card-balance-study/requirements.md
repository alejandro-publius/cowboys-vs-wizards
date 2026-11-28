# Catalog balance study

The question is how often the owning faction wins after drawing a particular card. Drawing includes the opening hand. Each game contributes once per card type, regardless of how many copies reached the hand. The result describes these level-2 bots, deck lists and matchups. Longer games give each side more chances to draw, so this measure alone cannot establish the causal effect of a card.

- CBS-1: The control SHALL use both shipped default decks and report the cards those decks contain.
- CBS-2: For each omitted card, its faction SHALL exchange one basic Sheriff or Skeleton for one copy of the focal card and keep the other 15 cards.
- CBS-3: Each substitution SHALL preserve the opponent’s control deck and use the same seeds and starting seats as the control.
- CBS-4: A substitution SHALL report the focal card’s owner wins among games where the focal card reached the hand, using every such game, including ties, as the denominator.
- CBS-5: A card with no draws SHALL have no win-rate estimate.
- CBS-6: A full replay SHALL reproduce the card numerators, denominators and per-game outcomes from the recorded engine commit.
- CBS-7: When interpreting the 45–55% target, the review SHALL report sample sizes and distinguish observed rates from evidence that the underlying rate falls within the band.

- CBS-8: Ordinary receipt verification SHALL reject a study whose published focal estimates differ from its recorded owner wins and games drawn, even when the published counts are arithmetically possible.

The first cohort uses seeds 70000 through 70499 inclusive, each with both starting seats. All nine arms use the same original engine. For a substitution, comparing all game outcomes with the corresponding control seats estimates the effect of the deck change. Reserve seeds 75000 through 79999 for confirmation after a balance decision has been frozen.
