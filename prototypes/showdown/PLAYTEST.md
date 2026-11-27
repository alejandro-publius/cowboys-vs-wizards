# Playtest: three first-time players

Ask three to five people who have never seen Showdown to play for fifteen minutes each. Alex’s saved Camp report records his own two Trail wins. The project still needs dated observations from first-time players. [Playtest issue](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/20) · [Maintainer playtest](../../docs/design/release-line.md)

## Set up

1. Record the date, device, browser and commit from the [live build manifest](https://alejandro-publius.github.io/cowboys-vs-wizards/build.json). Open the [published game](https://alejandro-publius.github.io/cowboys-vs-wizards/) and start at Camp for the Trail session.
2. Give each player a fresh browser profile or a new private session after closing the previous private window. This keeps each session’s progress separate and preserves existing saves.
3. Run one player at a time, out of sight of the others. Ask before recording. For an offline prototype session, build `dist/showdown.html` with `node prototypes/showdown/build.mjs` and record the exact local commit and route.

## What to say

> "This is an early card game. Play for fifteen minutes. Say what you are thinking out loud if you can. I am not allowed to answer questions."

Then say nothing. When they ask what to do, say "what would you try?" Write down every question they ask: each one is something the screen failed to say.

## What to watch for

Tick these as they happen, with the minute.

| Moment | What it tells you |
| --- | --- |
| They attack with a troop without being told how | The core action is findable |
| They pay a tribute on purpose | Tributes are understood, not stumbled into |
| They notice the new card after a win and read it | The reward lands |
| They choose between the two offered cards and say why | The choice means something |
| They hover or read a keyword | Keywords are being learned, not ignored |
| They use Take cover, or ask what it is | Cover is discoverable (it may be too hidden) |
| Their first loss: what they say and do next | Whether the rematch bonus is enough to keep them |
| They open "All the rules" | The one-line lesson was not enough |
| They stop before fifteen minutes | Where, and what was on screen |

## Afterwards, ask

1. What is this game about? Tell me how you win.
2. What does Guard do? (If they met it.) What does a tribute cost you?
3. What was the best moment?
4. What was confusing or annoying?
5. Would you play another fifteen minutes right now? Why or why not?

Then open **Playtest report** in the camp, select all, copy, and keep it with their answers.

## The line to pass

All of these, across the three players:

- All three win Trail duels 1 to 3 inside fifteen minutes with no help.
- No one is stuck for more than a minute on what to click.
- At least two can say how you win and what a tribute costs.
- At least two say yes to another fifteen minutes.

## First-time session results

No first-time participant rows have been documented here. Use P1, P2 and P3 as anonymous labels. Add rows for a fourth or fifth session if observed. Enter the player's own words and leave unobserved cells blank.

| Player | Date and build commit | Device and browser | First unassisted attack / time | First hesitation or exact quote | Trail wins / elapsed time | Would play again and why |
| --- | --- | --- | --- | --- | --- | --- |

## Original prototype decisions

The criteria below were written before the illustrated release. The [release record](../../docs/design/release-line.md) documents the implementation and subsequent design decisions.

- **Passed:** the rules are locked for the first release. Kiro integrates them and models can start, in the order players meet the cards.
- **A step failed:** fix that step and nothing else, then run one more player.
- **A rule nobody used or understood** (cover, traps, gear and locations are the likeliest) is cut from the first release, not explained harder.
