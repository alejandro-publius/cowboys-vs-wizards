# Try a deck before saving

Kiro Opus 5.5 added **Try draft** to the graybox deck builder. The action is available between matches for a legal twelve-card draft. The coordinator connected it to the existing match controller. A trial uses the current draft, carries that deck through Restart and Replay this deal, and uses the regular deck selection on New duel. Written profile progress comes from ordinary matches. Kiro reported 2.25 estimated credits.

## Record the comparison

Build with `npm run build` and open `dist/cowboys-vs-wizards-board-duel.html?seed=59`.

1. In Build Deck, load and save Deadeye Control. Load Billy Posse and select **Try draft**.
2. Show the trial notice and the opening hand with one Deadeye and one Billy. Open Main menu and Build Deck to show the saved three-Deadeye list. Resume the match to show the same trial hand.
3. Finish the trial. Replay shows the same seed-59 Billy Posse opening. New duel returns to ordinary deck selection.

The build and 45 focused Node tests passed. A Node integration check using the real graybox controller with UI stubs exercised invalid drafts, trial launch, pause and resume, restart, replay, a fresh ordinary duel, and preservation of the saved deck and profile progress. The browser interaction steps above are ready for a manual recording. Local browser access was blocked in this session.
