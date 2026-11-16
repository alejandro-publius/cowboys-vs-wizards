# Cowboys vs. Wizards morning handoff

Open the playable build on the Mac at [seed 0](http://127.0.0.1:48180/cowboys-vs-wizards-board-duel.html?seed=0). Work from the `codex/playable-duel` checkout in `.worktrees/playable-duel`. The public repository still describes the earlier attack prototype.

```sh
node scripts/verify-duel.mjs
node scripts/verify-duel.mjs --browser
```

The first command checks game rules, the match UI and assets. The second also builds and replays the duel in Chrome. Open the saved `orb-duel-replay` Workflow in Kiro when you want the judge-facing run and transcript. The [Kiro write-up](kiro-brag-sheet.md) links each claim to working code or evidence.

## The duel to film

Start with [seed 60](http://127.0.0.1:48180/cowboys-vs-wizards-board-duel.html?seed=60). Lanes are numbered left to right. These inputs were replayed in Chrome.

| Round | Cowboy action |
| --- | --- |
| 1 | Summon Sheriff in lane 1 and end the turn. |
| 2 | Summon Sheriff in lane 2, cast Deadeye on the enemy in lane 1 and end the turn. |
| 3 | Tribute the Sheriff in lane 1 for Billy in lane 3 and end the turn. |
| 4 | Tribute lanes 2 and 3 for Mounted Billy in lane 3 and end the turn. Singularity pulls him into lane 2. |
| 5 | Summon Sheriff in lane 1. Pause before End turn for the shot of Mounted Billy facing the Dragon. End the turn to play the clash. |

Mounted Billy enters with five life orbs. In the center-lane clash he still attacks, taking the Dragon from five orbs to two, and is then removed. The standalone exchange is the second camera shot for the Wizard's cast.

## Direction for the next pass

Make the central lane clash the payoff of a short haunted-Western duel. Open on the illustrated hand and a legal summon. Follow the card onto the board. Show the blue attack cue, the orb loss and the defeated card going into the graveyard. Capture the two opponents at board scale and in one close-up. This gives the Costume Contest entry a visual story that also shows the rules.

1. Get one new player through selecting a card, summoning and ending a turn from the opening screen. Watch where they hesitate. Use the two-tribute summon and Singularity relocation to test the next level of understanding.
2. Finish the Skeleton export next. The Dragon and Mounted Billy are fitted, textured Tripo models. They still need articulated clips for wing motion and a convincing mounted attack. Measure the feet or hooves and any grip from the exported mesh at the board scale before animating.
3. Use Fable’s paired opening-hand experiment to decide whether to guarantee a free opener. Under the current deals, the side without a free opener had 1 win in 126 tracked side-results. With the swap it had 59. Play the affected seeds before choosing a rule. The paired run is in Fable’s `09055dc` experiment.
4. Publish one tested release with the appropriate open-source license, the Kiro write-up, a functional judge link and a public YouTube demo under three minutes. Put the same release hash in the recording and the replay receipt. [Official rules](https://kiroween.devpost.com/rules)

Borrow the front and side comparisons and contact checks from [Lucca’s Character Factory](https://github.com/luccacerfz/character-factory-skills) and [Blender Game Skills](https://github.com/majidmanzarpour/blender-game-skills). Use a paired asset and browser receipt as in [Reference Asset Compiler](https://github.com/raydeStar/reference-asset-compiler). The game pipeline uses the existing Three.js loader and the per-action cues.
