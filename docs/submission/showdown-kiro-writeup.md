<!-- Draft by a Kiro CLI evidence reviewer, 2026-11-20 (America/Los_Angeles). Coordinator owns the Replay Room section and any new numbers. -->

# How we used Kiro on Showdown

Cowboys vs. Wizards is a haunted-Western browser card duel. In Showdown you choose every attack and troops shield your Base. Fable 5.2 wrote the rules; Kiro integrated and checked the [public game](https://alejandro-publius.github.io/cowboys-vs-wizards/).

## Try one decision (two minutes)

Open [seed 3](https://alejandro-publius.github.io/cowboys-vs-wizards/?turn=dragon-c5). Select the Ranger and attack the resting Dragon. Press Retry and attack the Jack-o'-Lantern instead. Then open [seed 70](https://alejandro-publius.github.io/cowboys-vs-wizards/?turn=dragon-c5-70). The Dynamiter is replaced by a Covered Wagon, no Bear Trap is set and the Wizard Base has one more orb. Under our recorded bot line, the Dragon attack wins seed 3 and the Jack attack wins seed 70. Both open from Camp without touching the saved career. [Search and replay](../../experiments/showdown-dragon-strategy/rival-README.md) · [browser checks](../evidence/showdown-turn-k095.md)

A new player gets two replayable [Boot Hill practice deals](../evidence/showdown-boot-hill-practice.md), and the Guard explanation is now on the focused target. We have no observed evidence that these changes help first-time players.

## Eight answers

1. **Surfaces.** Kiro CLI workers built most features. Kiro IDE wrote the Bear Trap spec and launched two workflows. Kiro Crew ran Night Watch and a [one-shot rival check-in](../evidence/showdown-rival-checkin.md) on schedule. We have no recorded Kiro Web run.
2. **Custom agents.** `showdown-presenter` denies writes to the rules file, and a [native trial](../evidence/showdown-presenter-guard.md) was refused. `showdown-strategy-reviewer` has no tools. It judged [sanitized boards blind](../../experiments/showdown-outrider/decision/reviewer/RECEIPT.md).
3. **Hooks.** A post-write hook skipped an unrelated edit, failed when we removed the Guard cue and passed once we restored it. [Guard check](../evidence/showdown-guard-access/README.md)
4. **Spec vs direct.** The Bear Trap fix used an IDE Bug Fix spec. Across 80 games, only the 12 fatal messages changed. [Spec](../evidence/showdown-bear-trap.md) Smaller fixes, such as [keyboard focus](../evidence/kiro-graywave-focus.md), went direct.
5. **Steering.** In native sessions, reading an engine file loaded the rules guidance. Reading a UI file loaded the interface guidance and left the rules out. [Controls](../evidence/showdown-scoped-steering.md)
6. **MCP.** Through three seat tools, Kiro won Boot Hill in 28 legal moves while seeing only the Cowboy view. [Receipt](../evidence/kiro-showdown-mcp.md)
7. **PBT.** Seven generated engine properties pass. [Tests](../../tests/game/showdown-properties.test.js)
8. **Powers.** In an isolated profile, Orb Duel Review 1.3.0 played Boot Hill. It passed the matching receipt and marked it stale after a rules edit. It never loaded its skill automatically. [Run](../evidence/showdown-installed-power.md)

## Tests, mutants and real defects

Hidden-information tests re-deal hidden cards and require an identical view. The MCP check compared 362 paired states and caught a planted Wizard-hand leak. Planted mutants only prove a check can fail: each property caught its seeded fault but found no product bug. The real defects we found and fixed were keyboard focus lost on redraw, reward focus that landed on Main menu, a fatal Bear Trap logged as "cancelled" and an empty Guard description.

## Orchestration beyond Night Watch

Native workflows [refused a release review at the wrong commit](../evidence/showdown-native-release-workflow.md), replayed [practice deals 0 and 60 in parallel](../evidence/showdown-practice-workflow.md), split the [Outrider search](../../experiments/showdown-outrider/decision/receipts/parallel-search.md) across two workers, and [rejected a staged Sheriff buff](../evidence/night-shift-native-showdown.md) on both seed sets.

Every run here was automated. Alex confirmed playtests were completed, but no first-time player observations are recorded.
