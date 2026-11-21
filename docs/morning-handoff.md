# Cowboys vs. Wizards morning handoff

[Play the public release](https://alejandro-publius.github.io/cowboys-vs-wizards/). The site root is **Showdown**: Play opens the Camp. [Build instructions](../README.md#play) · [Current status and gates](design/release-line.md#current-status-november-20-supersedes-the-november-19-1015-pm-handoff)

## Showdown to film (current)

Updated November 20, 2026 (America/Los_Angeles) by Kiro CLI worker `judges` from `main` at `ea183ee`. The [judge demo script](submission/judge-demo-script.md#sequence) has the full sequence, captions and the evidence matrix. Nothing has been uploaded.

1. **Reuse the private cut for 0:00–1:21.** `judge-media/Showdown_Dragon_Decision.mp4` (85.367 s, SHA-256 `cd7353bf…7883`) already shows the title, Play, Camp, both Dragon deals and the Ledger opening. Do not recreate it.
2. **Capture about 15 seconds on the public game.** Play → Camp → **Sheriff's Ledger** → hold on **Night Shift review** ("cowboy-sheriff health 3 → 4: rejected …"). Note the commit from `build.json`.
3. **Capture about 25 seconds in Kiro.** Show the saved run `wf_0756c413da3e189f` with its three completed steps and the rejected verdict. If the run view is unavailable, show its [receipt](evidence/night-shift-native-showdown.md#native-run) and caption it as a receipt.
4. **Close for about 15 seconds** on the caption in the script. The shares on screen (57.1% and 59.4%) are outside Fable's approved 45–55% band. [PR 170](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/170) waits for Alex's merge gate on or after Monday, November 23. Results for PR 181 are pending the score worker. Leave both out of the video.

To confirm the game route on a local build before filming (rerun on `ea183ee`: 29/29 and 12/12):

```sh
npm run build
node scripts/browser-showdown-turn-check.mjs dist/cowboys-vs-wizards-board-duel.html
node scripts/browser-ledger-check.mjs dist/cowboys-vs-wizards-board-duel.html
```

Owner only: voice, the two captures, editing, the YouTube upload and the Devpost form.

## Earlier lane duel, 3D build (historical)

Everything below films the retired three-lane duel in the earlier illustrated build at [`/3d/`](https://alejandro-publius.github.io/cowboys-vs-wizards/3d/). It is kept for that build and its existing links. It is not the December 4 fight. Its local checks:

```sh
node scripts/verify-duel.mjs
node scripts/verify-duel.mjs --browser
```

The first command checks game rules, the match UI and assets. The second also builds and replays the duel in Chrome. Open the saved `orb-duel-replay` Workflow in Kiro when you want the judge-facing run and transcript. The [Kiro write-up](kiro-brag-sheet.md) links each claim to working code or evidence. [Release verification](evidence/kiro-submission-preflight.md#live-release)

## The duel to film

*Lane duel, `/3d/` build only.* Capture the verified route from the project root.

```sh
npm run build:art
node scripts/browser-match-check.mjs --showcase --summary
```

The Chrome run saves the mounted summon, center-lane faceoff and clash result
with a build-hash receipt in `.artifacts/kiro/showcase/`.

Open the built 3D game with `?seed=60` appended. Lanes are numbered left to right. These inputs were replayed in Chrome.

| Round | Cowboy action |
| --- | --- |
| 1 | Summon Sheriff in lane 1 and end the turn. |
| 2 | Summon Sheriff in lane 2, cast Deadeye on the enemy in lane 1 and end the turn. |
| 3 | Tribute the Sheriff in lane 1 for Billy in lane 3 and end the turn. |
| 4 | Tribute lanes 2 and 3 for Mounted Billy in lane 3 and end the turn. Singularity pulls him into lane 2. |
| 5 | Summon Sheriff in lane 1. Pause before End turn for the shot of Mounted Billy facing the Dragon. End the turn to play the clash. |

Mounted Billy enters with five life orbs. In the center-lane clash he still attacks, taking the Dragon from five orbs to two, and is then removed. The standalone exchange is the second camera shot for the Wizard's cast.

## Direction for the next pass

*Historical, lane-era direction, kept unchanged. Its Costume Contest, opening-holdout and "existing Devpost submission" notes predate the Showdown choice. The current owner fields are in the [Devpost packet](submission/devpost-packet.md#required-form-fields-and-owner-inputs-still-open).*

Make the central lane clash the payoff of a short haunted-Western duel. Open on the illustrated hand and a legal summon. Follow the card onto the board. Show the blue attack cue, the orb loss and the defeated card going into the graveyard. Capture the two opponents at board scale and in one close-up. This gives the Costume Contest entry a visual story that also shows the rules.

1. Get one new player through selecting a card, summoning and ending a turn from the opening screen. Watch where they hesitate. Use the two-tribute summon and Singularity relocation to test the next level of understanding.
2. Use seed 0 to show the fitted Skeleton and seed 60 to show the Dragon and Mounted Billy attacks. [Character evidence](evidence/kiro-character-assets.md)
3. In Fable’s 16,000-match holdout, a fifth card for the second seat narrowed the win-rate gap from 28.3 to 19.9 points. Pair that rule with a free opener for the next human playtest. The combined variant had zero dead opening hands and a 22.0-point gap. [Holdout evidence](evidence/fable-opening-holdout.md)
4. Upload the short demo to YouTube as a public video and add its URL to the existing Devpost submission. The game, MIT-licensed repository and Kiro write-up are published. [Official rules](https://kiroween.devpost.com/rules)

Borrow the front and side comparisons and contact checks from [Lucca’s Character Factory](https://github.com/luccacerfz/character-factory-skills) and [Blender Game Skills](https://github.com/majidmanzarpour/blender-game-skills). Use a paired asset and browser receipt as in [Reference Asset Compiler](https://github.com/raydeStar/reference-asset-compiler). The game pipeline uses the existing Three.js loader and the per-action cues.
