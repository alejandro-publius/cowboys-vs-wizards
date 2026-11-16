# Orb Duel graveyards

Kiro CLI added a graveyard outside the lanes for each side. The Cowboy well sits beside the near row on the right, and the Wizard well sits beside the far row on the left. Both use a dark disc and a blue-violet rim.

Each card added to a side’s displayed discard pile plays a 760 ms absorption cue. A tribute or defeated troop starts from its vacated tile. A spent spell starts from the side’s board edge. The cue uses the match scheduler so a restart or mode switch cancels its remaining frames. Resetting the displayed state gives each graveyard a fresh discard baseline.

The flying card uses a plain mesh in its side’s color. The deck continues to display the approved horseshoe card back.

Codex corrected the shader’s rim calculation and recorded the CLI attribution before committing. Build and browser play-through are deferred at the user’s request.
