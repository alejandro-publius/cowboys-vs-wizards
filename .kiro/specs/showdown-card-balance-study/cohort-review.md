# First catalog balance cohort

Status: changes requested

Codex reviewed engine `07e2b791a08b29e72bd07a840b1759ecf4897d81` on 500 seeds played from both seats. Each of the nine arms finished 1,000 games. The table counts a win only if the card reached its owner’s hand. For a substituted card, the last column gives all-game outcomes that flipped to an owner win / away from an owner win versus the control on the same seed and seat.

## Verification follow-up

Ordinary verification accepted an altered but arithmetically possible owner-win count in the published card summary. Full replay caught the discrepancy. The receipt verifier now compares the summary with the recorded draw counts before replay. All nine cohort receipts passed the stricter check, and the regression test rejected an altered numerator. This checks consistency within a receipt. Full replay still independently checks the underlying game outcomes and draw counts.

## Contested location follow-up

On the same 500 seeds from both seats, replacing one Sheriff with Sheriff’s Office gained 73 net Cowboy wins per 1,000 games against the default Wizard deck (226 gains, 153 losses). Against a Wizard deck with one Boneyard replacing one Skeleton, the same change gained 76 net wins (242 gains, 166 losses). The observed difference between the two deck effects was three games in this cohort.

Office’s owner won 416 of 689 games when Office was drawn against the Boneyard deck (60.38%), down from 509 of 708 (71.89%). Drawing Office selects a different subset of games in each matchup. The paired all-game comparison above gives little indication that adding Boneyard removed the benefit of the Office substitution. These exploratory games reuse the original study seeds. The reserved confirmation seeds remain available.

Reproduce from the PR checkout with `node docs/evidence/contested-locations/measure.mjs`. The script checks the engine against the original cohort commit. [Recorded comparison](../../../docs/evidence/contested-locations/result.json)

## Findings

- The control Cowboys won 613 of 1,000 games. All ten control Cowboy cards exceeded 55% when drawn and all eleven control Wizard cards fell below 45%. Adjusting individual outliers before testing the known Billy proposal could obscure a shared faction imbalance.
- Bone Armor and Captured Wraith were the only two cards inside the target band. Boneyard exceeded the upper boundary by 0.46 percentage points. The two seats share a seed, so a holdout analysis should preserve those pairs when estimating uncertainty.
- Sheriff’s Office had the highest observed rate at 71.89% across 708 games where it reached the hand. The opposing default deck has no location card. Measure it against an opposing location as well before attributing that whole difference to the card.

| Card | Owner wins when drawn | Games drawn | Observed rate | Paired gains / losses |
| --- | ---: | ---: | ---: | ---: |
| cowboy-bear-trap | 481 | 701 | 68.62% | control |
| cowboy-billy | 561 | 915 | 61.31% | control |
| cowboy-captured-dragon | 440 | 708 | 62.15% | 213 / 209 |
| cowboy-captured-wraith | 379 | 708 | 53.53% | 172 / 229 |
| cowboy-covered-wagon | 580 | 891 | 65.10% | control |
| cowboy-deadeye | 471 | 705 | 66.81% | control |
| cowboy-dynamiter | 392 | 688 | 56.98% | control |
| cowboy-gatling-crew | 465 | 708 | 65.68% | 207 / 178 |
| cowboy-lasso | 451 | 690 | 65.36% | control |
| cowboy-mounted-billy | 425 | 688 | 61.77% | control |
| cowboy-outrider | 580 | 929 | 62.43% | control |
| cowboy-ranger | 419 | 665 | 63.01% | control |
| cowboy-sheriff | 611 | 993 | 61.53% | control |
| cowboy-sheriffs-office | 509 | 708 | 71.89% | 226 / 153 |
| cowboy-six-shooter | 477 | 708 | 67.37% | 216 / 175 |
| wizard-bone-armor | 323 | 669 | 48.28% | 235 / 148 |
| wizard-bone-wall | 345 | 902 | 38.25% | control |
| wizard-boneyard | 371 | 669 | 55.46% | 272 / 137 |
| wizard-dragon | 279 | 696 | 40.09% | control |
| wizard-headless-horseman | 263 | 729 | 36.08% | control |
| wizard-hellfire | 284 | 699 | 40.63% | control |
| wizard-hex | 260 | 647 | 40.19% | control |
| wizard-imp | 306 | 756 | 40.48% | control |
| wizard-jack-o-lantern | 255 | 710 | 35.92% | control |
| wizard-lantern-wraith | 275 | 669 | 41.11% | 208 / 169 |
| wizard-raven-familiar | 250 | 697 | 35.87% | control |
| wizard-singularity | 280 | 692 | 40.46% | control |
| wizard-skeleton | 383 | 993 | 38.57% | control |
| wizard-wizard | 357 | 915 | 39.02% | control |

[Measurement protocol](requirements.md) · [Nine game receipts](../../../reports/balance/) · [Billy proposal and held-out results](../../../docs/evidence/billy-seat-audit/README.md)
