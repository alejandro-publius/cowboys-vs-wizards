# Issue 143 slice 3: Camp modes in the graybox (Kiro CLI modes worker)

Kiro CLI worker session (Claude Opus 5.5), 2026-11-19 PST, branch `kiro/graywave-modes`, base `main` `4d52642`.
Governing rulings: Fable on PR 148 (issuecomment-7031816529) and issue 143 (issuecomment-7031863563).

## What moved into the graybox Camp

Reference behaviour from `prototypes/showdown/main.js`, on the canonical modules, with no rule, reward or Scout change:

| Mode | Graybox files | Canonical rules used |
| --- | --- | --- |
| Rivals, Wanted hunts (repeat to five), the even match | `src/ui/showdown-camp.js`, `src/ui/showdown-screen.js`, `src/match/showdown-campaign.js` (`duel(id, deck)`) | `progress.js` `duelList`, `duelFor`, `settle` |
| Packs | Camp claim area, `campaign.openPack()` | `progress.js` `openPack` |
| Deck builder and side deck | `src/ui/showdown-builder.js`, `campaign.withDeck()` | `progress.js` `deckProblems`, `withDeck` |
| Best of three, side-deck swap between games | `src/match/showdown-match.js` (pure), screen | flow as in the prototype's `advance`/`nextGame` |
| Two players on one screen, privacy curtain | `src/match/showdown-session.js` (`players: 2`), screen `#sd-curtain` | `contract.js` `viewFor` for the active seat only |
| Save code, Start over | Camp `#camp-save`; `campaign.replace()`, `campaign.reset()`, `playtest.clear()` | `savecode.js`, moved unchanged to `src/game/showdown/` (prototype path re-exports) |

Not changed: the Trail, keyboard focus, cues, keepsakes and storage keys from PR 148; the lane duel and `?mode=` routes; the reference page `prototypes/showdown/`; any 3D, art or model file.

## Receipts (final build `dist/cowboys-vs-wizards-board-duel.html` sha256 `7fcd835f…1c12`)

- `npm test`: 606 pass, 0 fail, 0 todo (the slice 2 Start over `test.todo` is now a real test). `sh scripts/check-card-specs.sh`: exit 0.
- `node scripts/browser-showdown-modes-check.mjs` (new): 13/13 and no page errors. Receipt: [showdown-modes-143/browser-showdown-modes.json](showdown-modes-143/browser-showdown-modes.json). Runs, each a fresh Chrome profile with its own fixture built by `progress.js`:
  - gated (new profile): rivals, Wanted, the even match and best of three are locked; two players is open; Build deck Cancel saves nothing.
  - packs (post-Trail): the pack equals `openPack()`; kept after reload.
  - builder (post-Trail): 15-card deck refused with its reason; 16 + side 1 saved, listed, kept after reload.
  - rival: the Stargazer won (seed 0, 1 game); her card and pack paid; the Imp opens; the rematch is offered.
  - bounty: Lantern Wraith hunt 1 won, repeated from the result as hunt 2 and won; hunts 2 after reload. From a 4-of-5 fixture the fifth hunt captured the Captured Wraith; no repeat offered.
  - bo3 (`?seed=4`, side deck): W W; one swap screen (17 cards refused, 16 accepted); Wizards opened game 2 after losing game 1; nothing stored between games; one settle; two playtest lines.
  - hotseat (`?seed=3`, best of three): Cowboys 2-0; a curtain at every hand-over with no hand, board or card id in the page; each seat saw only its own hand ids; the loser opened game 2; localStorage byte-identical afterwards.
  - saves: preview, Cancel and a damaged code change nothing; Replace loads; Start over (confirm accepted) writes only the Showdown save and playtest keys; `cvw-player-v1` and `cvw-showdown-inherited-v1` byte-identical; the keepsake still shown.
- Existing graybox checks on the same build: `browser-showdown-check.mjs` 23/23 (includes `?mode=lanes`, `?mode=match`), `browser-showdown-trail-check.mjs` 16/16, `browser-showdown-keyboard-check.mjs` 6/6, `browser-showdown-cues-check.mjs` 5/5 (its harness campaign gained `duel: () => null`).
- Reference page `dist/showdown.html` (sha256 `4f258529…2e46`): access 34, onboarding 31, hotseat 47, savecode 27, bo3 47, campaign 55, all exit 0.

All browser runs are bot-driven. They support flow, privacy-in-DOM and storage claims only. Clarity and fun need the human playtest, which is pending.
