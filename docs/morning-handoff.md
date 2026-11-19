# Cowboys vs. Wizards morning handoff

[Play the public release](https://alejandro-publius.github.io/cowboys-vs-wizards/) or open the local build with `?seed=0`. [Build instructions](../README.md#play) · [Release verification](evidence/kiro-submission-preflight.md#live-release)

```sh
node scripts/verify-duel.mjs
node scripts/verify-duel.mjs --browser
```

The first command checks game rules, the match UI and assets. The second also builds and replays the duel in Chrome. Open the saved `orb-duel-replay` Workflow in Kiro when you want the judge-facing run and transcript. The [Kiro write-up](kiro-brag-sheet.md) links each claim to working code or evidence.

## The duel to film

Capture the verified route from the project root.

```sh
npm run build:art
node scripts/browser-match-check.mjs --showcase --summary
```

The Chrome run saves the mounted summon, center-lane faceoff and clash result
with a build-hash receipt in `.artifacts/kiro/showcase/`.

Open the built game with `?seed=60` appended. Lanes are numbered left to right. These inputs were replayed in Chrome.

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
2. Use seed 0 to show the fitted Skeleton and seed 60 to show the Dragon and Mounted Billy attacks. [Character evidence](evidence/kiro-character-assets.md)
3. In Fable’s 16,000-match holdout, a fifth card for the second seat narrowed the win-rate gap from 28.3 to 19.9 points. Pair that rule with a free opener for the next human playtest. The combined variant had zero dead opening hands and a 22.0-point gap. [Holdout evidence](evidence/fable-opening-holdout.md)
4. Upload the short demo to YouTube as a public video and add its URL to the existing Devpost submission. The game, MIT-licensed repository and Kiro write-up are published. [Official rules](https://kiroween.devpost.com/rules)

Borrow the front and side comparisons and contact checks from [Lucca’s Character Factory](https://github.com/luccacerfz/character-factory-skills) and [Blender Game Skills](https://github.com/majidmanzarpour/blender-game-skills). Use a paired asset and browser receipt as in [Reference Asset Compiler](https://github.com/raydeStar/reference-asset-compiler). The game pipeline uses the existing Three.js loader and the per-action cues.
