<!-- PUBLISH START -->
# One attack point turned a Cowboy win into a Wizard win

On turn seven, Billy hits Bone Wall. At two attack, the wall falls and the Cowboys win on turn thirteen. Give Billy one attack and the wall survives with one orb. Play out the same deal and the Wizards win on turn twenty. The first 29 events are identical. You can step through both endings in the Sheriff’s Ledger. [Play the replay](https://alejandro-publius.github.io/cowboys-vs-wizards/?replay=billy)

That deal gave us a reason to test Kiro’s proposed change across more opponents’ opening hands. We held the decks and two level-2 bots fixed, dealt 25,000 fresh seeds, let each faction go first, and played each version of Billy. Across those **100,000 bot duels**, the Cowboy win rate fell from **59.792% to 51.920%**. The opening player still won **58.136%** of the games with the proposed Billy. [Protocol, outcomes and both seat splits](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/dad6175/docs/evidence/billy-seat-audit/README.md)

## What Kiro was allowed to change

The Kiro CLI agent could edit one number in a scratch copy. A separate reviewer checked two rules written before the run. Each faction had to win 45–55% of the games. The opening player’s distance from 50% could grow by at most one percentage point. The reviewer recomputed the results from the saved outcomes before checking the proposal. Billy at two attack failed the first rule. Billy at one passed both. The live game still gives him two attack while the design decision is open. [Recorded Kiro decision](https://alejandro-publius.github.io/cowboys-vs-wizards/?saloon=review) · [Written rules](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/dad6175/.kiro/specs/night-shift-balance-contract/requirements.md)

We also gave Kiro six attempts to choose its own card and stat. The reviewer rejected all six. During development, a separate task hook blocks a newly checked-off spec task until there is a fresh passing test stamp. Both decisions leave something a reader can inspect. [Six rejected proposals](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/dad6175/docs/evidence/billy-seat-audit/README.md#native-free-choice-workflow-six-proposals-six-rejections) · [Task hook](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/dad6175/.kiro/hooks/contest-tasks-guard.json)

## Where the referee disagreed

We replayed 100 seeded duels through a frozen snapshot of the rules engine and an independent Python referee. The two agreed on all **5,086 positions actually reached**. At the 4,986 positions where play could continue, the audit tried **274,273 candidate moves**. It classified all **6,775 disagreements**. One rule still needs a design call. On an empty board, the engine rejects Hellfire and the referee accepts it. We can reproduce that exact disagreement before changing the rulebook. [Referee report and controls](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/dad6175/docs/evidence/claude-referee-legal-branches.md) · [Open design discussion](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/143)

## Who built what

| Contributor | Work you can inspect |
| --- | --- |
| Kiro CLI | Proposed the stat edit and ran the bounded workflow. The balance contract and its executable check are in [PR 187](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/187) and [PR 190](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/190). |
| Claude Code | Built Billy’s interactive replay and audited alternate moves against the frozen referee. [PR 188](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/188) · [PR 203](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/203) |
| Fable in Claude Code | Led rules and progression design. Card changes go back to Fable and Alex for a decision. [Design record](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/142) |
| Codex | Integrated the public build, implemented combat previews and checked the published player routes. [PR 213](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/213) · [PR 217](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/217) |

Play **Ride or Fight?** from the title. Select the Outrider, hit the Wizard Base, then choose **Try fighting instead** and attack the Skeleton. It takes one turn to see what trading a hit costs. [Play Showdown](https://alejandro-publius.github.io/cowboys-vs-wizards/)
<!-- PUBLISH END -->

Editorial note for Alex. Claude Code drafted the earlier article. Codex revised this draft from the published `dad6175` build and reran the 100-duel referee check. The pinned sources identify that recording. The [live manifest](https://alejandro-publius.github.io/cowboys-vs-wizards/build.json) identifies the current deployment. Confirm the new replay link has deployed before publishing. [Asset credits](../../README.md#assets-and-attribution)
