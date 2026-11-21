# How we used Kiro on Showdown

Showdown is a haunted-Western card game for people who want to play a complete duel in a browser and understand what their attacks did. One common question is easy to ask and hard to answer from a combat log: “What if I had attacked the other troop?”

## Try the decision before opening the results

Open **Replay Room** in Kiro Crew. In the browser build on this branch, open **Play → Camp → Experiment → Replay Room**. Your Ranger can attack a Dragon with four life left or a Jack-o’-Lantern with one. Pick a target. Compare the two boards at the end of the Cowboy turn, advance to the Wizard turn, then try the other table. To take over from the recorded decision, choose **Play this turn yourself**. The public game also opens both original positions directly. [Table A](https://alejandro-publius.github.io/cowboys-vs-wizards/?turn=dragon-c5) · [Table B](https://alejandro-publius.github.io/cowboys-vs-wizards/?turn=dragon-c5-70)

Fable 5.2 designed the rules. Kiro found a second deal where the same attack produces a different winner, replayed both branches through the game engine, and built the shared Crew and browser interface. The four snapshots per branch cover turns 5–8. The final winner comes from playing out the rest under fixed bot policies. Several things change between the two deals, so the recordings cannot say which change decided the game. [Experiment](../../experiments/showdown-dragon-strategy/rival-README.md) · [Replay Room evidence](../evidence/showdown-replay-room.md)

## Eight answers

1. **Surfaces.** Kiro CLI workers built most features. Kiro IDE wrote the Bear Trap spec and launched two workflows. Kiro Crew hosts Replay Room and Night Watch. A [one-shot rival check-in](../evidence/showdown-rival-checkin.md) ran on schedule. Kiro Web use is unverified.
2. **Custom agents.** `showdown-presenter` denies writes to the rules file, and a [native trial](../evidence/showdown-presenter-guard.md) was refused. `showdown-strategy-reviewer` has no tools. It judged [sanitized boards blind](../../experiments/showdown-outrider/decision/reviewer/RECEIPT.md).
3. **Hooks.** A post-write hook skipped an unrelated edit, failed when we removed the Guard cue and passed once we restored it. [Guard check](../evidence/showdown-guard-access/README.md)
4. **Spec vs direct.** The Bear Trap fix used an IDE Bug Fix spec. Across 80 games, only the 12 fatal messages changed. [Spec](../evidence/showdown-bear-trap.md) Smaller fixes, such as [keyboard focus](../evidence/kiro-graywave-focus.md), went direct.
5. **Steering.** In native sessions, reading an engine file loaded the rules guidance. Reading a UI file loaded the interface guidance and left the rules out. [Controls](../evidence/showdown-scoped-steering.md)
6. **MCP.** Through three seat tools, Kiro won Boot Hill in 28 legal moves while seeing only the Cowboy view. [Receipt](../evidence/kiro-showdown-mcp.md)
7. **PBT.** Seven generated engine properties pass. Each rejected an intentionally broken rule. [Tests](../../tests/game/showdown-properties.test.js)
8. **Powers.** In an isolated profile, Orb Duel Review 1.3.0 played Boot Hill. It passed the matching receipt and marked it stale after a rules edit. That session required explicitly loading its skill. Version 1.6.0 now supplies the public replay position and the post-choice record. [Run](../evidence/showdown-installed-power.md)

## What we cut after testing

Fable 5.2 reviewed the new CLI coach before Kiro built it. We kept it as an experimental CLI transcript. The native permission prompt shows only the Power name. Denying it withheld the answer. In 60 hint and uncertainty trials the coach never requested an outcome. It reported both outcomes accurately in 20 committed trials. A blinded model matched its selected snapshots to 12 of 12 scripted predictions with distinct time windows. For a new player the useful change was simpler: cover, resting and Bear Trap are defined at the board, and the player can inspect both continuations without opening an AI tool. [Native trials and limits](../evidence/showdown-replay-room.md)

## Tests, mutants and real defects

Hidden-information tests re-deal hidden cards and require an identical view. The MCP check compared 362 paired states and caught a planted Wizard-hand leak. Planted mutants only prove a check can fail: each property caught its seeded fault but found no product bug. The real defects we found and fixed were keyboard focus lost on redraw, reward focus that landed on Main menu, a fatal Bear Trap logged as "cancelled" and an empty Guard description.

## Orchestration beyond Night Watch

Native workflows [refused a release review at the wrong commit](../evidence/showdown-native-release-workflow.md), replayed [practice deals 0 and 60 in parallel](../evidence/showdown-practice-workflow.md), split the [Outrider search](../../experiments/showdown-outrider/decision/receipts/parallel-search.md) across two workers, and [rejected a staged Sheriff buff](../evidence/night-shift-native-showdown.md) on both seed sets.

Alex played the campaign and confirmed other playtests took place. Individual first-time observations and a comparison with the panel alone are still missing. The project demonstrates repeatable decisions and accessible controls. Its effect on learning is unmeasured.
