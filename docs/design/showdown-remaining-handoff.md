# Showdown: remaining design handoff

Fable 5.2, November 20, 2026. Read from `main` at `c3dcab6`; nothing was run.

**Integration note from Codex.** [PR #176](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/176) has since shipped the Bear Trap message. A separate replay of the live progression code took the first offered card and opened every pack. It confirmed 22 copies after the Trail, 27 after the Stargazer, 32 after the Imp and 33 after the Bonewright. The Bonewright paid one card in its pack and the Coven’s two packs each held zero. The Camp changes below are a branch candidate, subject to the November 23 decision. Fable’s subsequent [Wizard campaign and two-player brief](showdown-wizard-campaign-brief.md) specifies Release 2 and clarifies the timing of 3D and lane retirement.


## Verdict

The core graybox is complete for December 4: no rule, card, mode or number is missing. One small gap is worth closing before the November 29 cutoff: the Camp stops guiding the player once the Trail is won. The fix is text and state only, adds no mechanic, and the snapshot does not depend on it. This is open brief 2 of 3 and closes the wording gate in the [release line](release-line.md).

| State | What |
| --- | --- |
| Live | The fight (29 cards), Trail, four rivals, two bounties, offers and packs, deck builder, even match, best of three, two players, save code, Boot Hill practice, the Dragon and Outrider turns (experiments), Sheriff's Ledger, placeholder cues |
| Candidate | The even-match package ([PR 170](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/170)), accepted by me and not live. With Kiro now: Bear Trap log, presenter guard, cue sheet |
| Missing | The Camp after the Trail (below); recorded first-time-player observations; a Showdown design for Release 2 |
| Alex decides | Merging PR 170, on or after November 23; any card change; when art and 3D start |

Wording: I approve the Camp labels, mode labels and Sheriff's Ledger text as shipped, except the strings below. I did not review the `/3d/` label.

## The gap: the Camp after the Trail

**Evidence.** After duel 6 the [Camp](../../src/ui/showdown-camp.js) (line 71) reads "You have won the whole Trail." forever, while a rival, two bosses and Open range open at once. By my reading of [progress.js](../../src/game/showdown/progress.js), 33 card copies can be earned and a player owns 22 after the Trail. Taking every offer and pack, the Bonewright's pack holds one card under "Open a pack: three cards", and the Coven's two packs hold none. "Rematch for a card." is then false too.

**Decision.** The Camp always names one next duel and never promises a card it cannot pay. The player still chooses the track: rivals (new kinds of card), Wanted (a capture in five hunts) or Open range. Nothing is locked or reordered, so existing saves play as before.

**The next line** (`#camp-next`, when no offer is pending and no pack can be opened; first matching row):

| Save state | Text |
| --- | --- |
| A rival is unbeaten | Next: **The Stargazer**, rival 1 of 4. Win to earn Six-Shooter and 1 pack. |
| Same, after a loss to it, a boss uncaptured | adds: Or hunt **The Lantern Wraith**, hunt 1 of 5. |
| All rivals beaten, a boss uncaptured | Next: **The Lantern Wraith**, hunt 3 of 5. Five capture Captured Wraith. |
| Nothing left | Every rival is beaten and both bosses are captured. Open range and two players stay open. |

It names the first open rival, then the first open hunt, in `duelList` order, with the tile's own reward text.

**Truthful pay.** "Can be earned" means the list `settle` and `openPack` already draw from.

| Where | Today | Becomes |
| --- | --- | --- |
| Locked rival | Beat the rival before | Beat The Stargazer first (the previous rival) |
| Beaten rival, fewer than two card types can be earned | Beaten. Rematch for a card. | Beaten. |
| Pack button | Open a pack: three cards | Open a pack |
| Packs held, nothing can be earned | the button | 2 packs hold nothing new: every card you can earn now is yours. (no button) |
| Open rival, no card reward, nothing can be earned | Win to earn 2 packs | Win to beat The Graveyard Coven. |

**Edge cases.**
- An offer still comes first and disables solo duels.
- Unopenable packs stay in the save and open again if beating a rival releases its card.
- A pack may show one or two cards, never none.
- The save stays version 2; `migrate`, save codes and keepsakes are untouched.
- Left as is: the result screen's "You earned 2 packs", and the reference page's old strings.

**Pass.**
- Trail won, offer taken, pack opened: row one, word for word.
- `losses["rival:stargazer"]` at 1: row two.
- Four rivals beaten, hunts at Wraith 5 and Dragon 2: "Next: **The Graveyard Dragon**, hunt 3 of 5. Five capture Captured Dragon."
- All 33 copies and `packs: 2`: no pack button, and `packs` is still 2 after a reload.

**Fail.**
- The Trail is won and the line is missing, or names a locked or beaten duel.
- "In the pack" shows no card.
- The save code changes on render.
- `settle`, `openPack` or `migrate` behave differently.

## Kiro handoff

- **Owns:** `src/ui/showdown-camp.js`, [`showdown-modes.test.js`](../../tests/match/showdown-modes.test.js), and the two string assertions in [`browser-showdown-modes-check.mjs`](../../scripts/browser-showdown-modes-check.mjs). In `progress.js` I allow one change: export the private `pool`, read-only.
- **First task:** a test that plays from a new save through all four rivals, taking every offer and pack, and records when nothing more can be earned. If it disagrees with my count, send the numbers; the strings stand.
- **Prerequisites:** none; the text does not depend on PR 170. Stay out of `presenter.js` and `showdown-cues.js`.
- **Safe now:** build on a branch. Merge on or after November 23 and by November 29, or it is out.
- **Checks:** `node --test tests/match/showdown-modes.test.js`; then `npm run build` and `node scripts/browser-showdown-modes-check.mjs dist/cowboys-vs-wizards-board-duel.html`.

## One turn, as shipped

[Dragon hunt 5, Cowboy turn 5](../evidence/showdown-turn-k095.md), seed 3. Your Ranger (2 attack, 4 orbs) faces the resting Dragon (3 attack, 4 orbs) and a Jack-o'-Lantern in cover.

- **Hit the Dragon:** it drops to 2 and hits back, leaving the Ranger on 1.
- **Hit the Jack:** it falls, nothing reaches the Base, and its Last Stand costs the Ranger 1 orb.

The recorded bot line won after the Dragon attack and lost after the Jack; on seed 70 it was the reverse. Neither is advice, and it stays an experiment.

## Open player research

1. Where a first-time player hesitates in Boot Hill and Raven Roost ([protocol](../../prototypes/showdown/PLAYTEST.md)). Completion is credited; observations are not recorded.
2. "What made you choose that target?" on the Dragon turn. Not yet asked.
3. Whether cover against spells changes what a person does.
4. What a player clicks first after the Trail.

## Freeze before any 3D

No new requirement. The 3D skin starts when Release 1 is locked, as the release line defines it: every card has a job, a counter and a seeded check, and first-time players finish the first session unassisted. Open today: those observations, Alex's decision on PR 170, the Dragon's cost and the card list. After the lock the [contract](showdown-integration-kiro-brief.md) (sixteen events, `viewFor`, three troop slots) holds still.

## After December 4, in order (hypotheses)

1. Six Wizard cards that need no new rule (already ruled).
2. The Dragon's cost: an idea, not a number.
3. What a win pays once all 33 copies are owned; Wizard cards do not grow that pool.
4. Release 2: Wizard deck building, unlocks and first session. Not designed.
5. Release 3, then the 3D board on Showdown, which retires the lane engine.

## Not checked

No test or build was run and no asset was read. The 33-copy count is by reading [cards.csv](../../prototypes/showdown/cards.csv) and `progress.js`. No person has seen these strings.
