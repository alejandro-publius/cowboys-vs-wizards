# Playtest: three first-time players

The rules have only been played by bots. Before any model or animation is made for them, three people who have never seen the game play it for fifteen minutes each. This page is the whole procedure.

## Set up

1. Build the page: `node prototypes/showdown/build.mjs`. The result, `dist/showdown.html`, is one file that works offline. Send it, or open it on your own machine and hand over the mouse.
2. If someone has played on that browser before, open **Save code** in the camp and press **Start over**. That also clears the report.
3. One player at a time. Do not let the next one watch.

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

## What the result decides

- **Passed:** the rules are locked for the first release. Kiro integrates them and models can start, in the order players meet the cards.
- **A step failed:** fix that step and nothing else, then run one more player.
- **A rule nobody used or understood** (cover, traps, gear and locations are the likeliest) is cut from the first release, not explained harder.
