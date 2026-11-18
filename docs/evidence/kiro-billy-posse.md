# Billy Posse and Deadeye Control on the same seed

Kiro Opus 5.5 added **Load Billy Posse** to the graybox Build Deck screen. The list keeps six Sheriffs and two Deadeyes and turns the starter's Mounted Billy into a fourth one-tribute Billy. Hold or pressure a lane with Sheriff, then spend one weakened defender to put a stronger attacker there.

The earlier paired study scored this deck at 53.86% on Normal and 48.05% on Hard, versus 49.39% and 48.80% for starter (2,048 bot matches per row). A later 384-match screen per row found that both candidates with only one Deadeye scored at most 36.5% across the two settings. These results support keeping two shots in the trial. Human balance remains open. [Mounted Billy study](fable-mounted-billy.md) · [Launch-deck research](clash-royale-launch-decks.md)

## Record the comparison

Run `npm run build`. Open `dist/cowboys-vs-wizards-board-duel.html` with one of these query strings. Start both clips by summoning Sheriff in lane 1 and ending round 1.

| Style | Query string | Round two | Observed after the clash |
| --- | --- | --- | --- |
| Deadeye Control | `?mode=match&seed=59&deck=deadeye-control` | Summon Sheriff in lane 2, cast Deadeye on the Skeleton in lane 1, then End turn. | Both Bases stay at five. Lane 1 clears and Sheriff holds lane 2 on two orbs. |
| Billy Posse | `?mode=match&seed=59&deck=billy-posse` | Select Billy, tribute the one-orb Sheriff in lane 1, summon Billy in that lane, then End turn. | Billy clears lane 1 and survives on three. The Cowboy Base takes one orb from the open lane. |

These are two choices on one seed with the same Wizard policy. The clip establishes the play styles and their immediate trade, while match balance needs a wider sample.

In Safari, Codex verified the two routes above and that an unsaved Billy Posse draft disappears when leaving Build Deck. Saving the draft made the next seed-59 duel use Billy Posse. The pinned Control link temporarily used Control, **Replay this deal** retained its two-shot opening, and the saved Posse deck persisted. The build and all 35 focused tests passed. Kiro reported 2.87 estimated credits for the preset implementation. Codex added the two pinned preset links for recording and repeatable playtests.
