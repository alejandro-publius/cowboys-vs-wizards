# Even Fight preview

Play one game, a best-of-three series or a two-player game with fixed sixteen-card decks. In the illustrated Camp, open **Practice → Challenge replays → Even Fight preview**. In the graybox Camp, open **Even Fight preview** under **Experiment**. The preview keeps career progress, bounties, rewards, deck-builder choices and playtest logs intact. [Solo game](https://alejandro-publius.github.io/cowboys-vs-wizards/?even-fight=1) · [Best of three](https://alejandro-publius.github.io/cowboys-vs-wizards/?even-fight=series) · [Two players](https://alejandro-publius.github.io/cowboys-vs-wizards/?even-fight=two)

| Rule | Released game | Even Fight |
| --- | --- | --- |
| Wizard deck in the even match | 4 Skeletons and 1 Imp | 3 Skeletons and 2 Imps |
| Even-match opening | Both seats have 5 Base orbs. The second seat draws an extra card. | The second seat has 7 Base orbs and draws its extra card. |
| Spell against cover | Cover protects the Base from excess attack damage. Spells still reach a covered troop. | Cover also prevents targeted spells and Hellfire damage. Hellfire needs at least one enemy outside cover. Attacks, Sweep and traps keep their usual effects. |
| Table privacy | The other seat’s hand and traps are private. | The same privacy applies through the result and every hotseat handoff. |

Fable’s November 20 brief records Alex’s approval. Kiro implemented the first candidate on the historical branch. Fable explicitly made the optional end-of-game hand reveal separable. The current port uses the approved three gameplay changes and the seat privacy rule through the final screen. The frozen rulebook, reference referee and default gameplay still describe the released rules. [Archived brief](showdown-even-fight-kiro-brief.md) · [Historical Kiro implementation](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/170) · [Board privacy requirement BZ-09](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/183)

## Same-deal comparison on the current engine

Codex replayed both rulesets from the November 26 port based on `b7dacf6`. Level-2 bots played both starting seats on each deal. Each table cell is a win share over 2,000 games. The tuning set and independent holdout both fall inside Fable’s 45–55% target for the preview. Billy stayed at the released 2 attack for both runs. The 100,000-duel Billy experiment measures a different change.

| Deals | First seat, released | First seat, preview | Cowboys, released | Cowboys, preview |
| --- | ---: | ---: | ---: | ---: |
| 0–999 | 57.10% | 49.50% | 59.40% | 51.80% |
| 1000–1999 | 58.25% | 51.40% | 61.05% | 54.10% |

The 100-duel frozen referee check on the same port matched all 5,086 main-line positions. Its 274,273 alternative-action checks yielded 6,775 classified disagreements and zero unexplained disagreements on the released rules. The empty-board Hellfire decision remains open. [Audit method](../evidence/claude-referee-legal-branches.md)

## Before making these the default rules

Run these commands on the exact proposed release commit. The two seat runs each play 2,000 games per ruleset. The progression run compares 300 first tries with each of three player policies in every Trail, rival, bounty and Open Range fight. It holds each scripted deck and Base fixed, including the Coven’s deck. The preview rules apply to the full ladder only inside that evaluation.

```sh
node scripts/even-fight-review.mjs seats 0 1000
node scripts/even-fight-review.mjs seats 1000 1000
node scripts/even-fight-review.mjs progression 0 300
node scripts/referee/legal-branches.mjs --limit 100
npm run build
MODES=evenfight node scripts/browser-showdown-modes-check.mjs dist/cowboys-vs-wizards-board-duel.html
```

Review both seat shares and the raw progression rows before changing any public default. A shift above three percentage points in any of the six Trail duels fails the full progression command. Fable’s November 20 waiver covers three named off-Trail shifts in the original wider review, which kept its failed verdict. Those cases were the Stargazer and the first two Lantern Wraith hunts. Preserve that verdict when comparing a new commit. [Sealed historical review](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/63f8d873328bd3c0a77fcd193beb2abde7a0a048/docs/evidence/night-shift/even-fight-d5a799d6/bundle.json)

Alex owns the default release decision. The open player-research question is whether a first-time player chooses cover when facing a spell. Promotion also needs a new version of the rulebook, CSV and independent referee for the changed rules. Keep the released referee receipt reproducible. Re-run both Dragon fixtures, the Outrider demo and browser privacy checks against the promoted build. [Release design decision](showdown-remaining-handoff.md) · [Recorded referee freeze](../../proof/referee/freeze.json)
