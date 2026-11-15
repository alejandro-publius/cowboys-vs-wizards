# Cowboys vs. Wizards playtest

Open the built HTML in Chrome or another current desktop browser. Duel plays
the full draft rules against the Wizard. Bounty loads **Save the Saloon**, a
one-turn puzzle from a real seeded match. Its final clash tests tribute, lane
placement and Deadeye together.

Select a card, pick any required friendly tributes, choose a highlighted lane
or target, then confirm. End turn advances play. The gold and violet orbs show
remaining health. Replay seed repeats a deal; New duel generates another one.

From the repository root:

```sh
npm ci
node playtest/build.mjs
node --test playtest/bounty.test.js
```

The build creates `dist/cowboys-vs-wizards-playtest.html`, with all code and art
embedded. The default duel uses seed 6. The bounty uses seed 554 at revision 37.
Both run Fable's engine and CPU from `c1ea873`. The player-facing branch is under
`playtest/`, independent of Kiro's card-interface implementation.

Codex built the playtest and bounty. The board, Billy and Wizard images render
the project's Tripo models, and the deck uses the approved Amethyst Horseshoe
Arcana image. Billy and Wizard use the existing models in the WebGL view. The
fallback uses sprites rendered from those models. The other troops are tokens.

On November 15, 2026, Chrome's fallback view played seed 6 to a Cowboy victory
in round 8 (2–0) and the bounty to both defeat and victory. The winning bounty
spent one tribute and cast Deadeye. WebGL was disabled in that browser, so the
live 3D view still needs a visual check on a WebGL-capable device. The engine
suite passed 38 tests. This is a playtest of the draft rules, with art and
balance still in progress.
