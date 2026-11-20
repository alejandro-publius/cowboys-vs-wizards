# Issue 143 slice 2: Camp (worker evidence)

Kiro CLI (claude-opus-5.5 worker), November 19, 2026, 21:08 PST (America/Los_Angeles), branch `kiro/graywave-camp`, base `24dd11c`.
Tested on top of the saves worker's commit `d5b964d` (cherry-picked locally as `96b75bc`; not authored here).
Build-log entry is left to the coordinator.

## Change

- Normal graybox Play opens the Camp (`src/ui/showdown-camp.js`): the card still on offer, the six Trail duels with what each pays, the saved deck and collection. Only the open Trail duel can start, and nothing starts while a card is on offer.
- `src/match/showdown-campaign.js` holds progress in memory and writes it through `loadCampaign`/`saveCampaign` after every change. Duels come from `duelFor`, results from `settle`, the choice from `choose`. It decides no reward.
- `src/ui/showdown-screen.js` settles a finished duel once, shows what it paid, the cards that went into the deck, the two-card choice, and grit after a loss. Then it goes back to the Camp. Each duel starts a new event log, and the view is still `viewFor` only.
- `src/match/showdown-session.js` reads Boot Hill from canonical `progress.js` (`duelFor(newSave(), "trail")`), not the prototype.
- `src/app.js` and `src/ui/graybox.html` wire the Camp in. `?mode=lanes` and the other lane modes are unchanged.
- Out of scope (slice 3 or not asked): rivals, Wanted hunts, packs, deck builder, save codes, playtest log.

## Checks run (this branch, with `96b75bc`)

- `node --test tests/match/showdown-campaign.test.js tests/match/showdown-session.test.js`: 7 of 7 pass. Covers a fresh in-memory profile winning Trail duels 1 and 2 with Covered Wagon ×2 and Outrider ×2, an offer that survives a reload, grit after a loss, the lane profile key left byte-identical, and blocked storage.
- `npm test`: 532 of 532 pass.
- `npm run build`, then `node scripts/browser-showdown-check.mjs dist/cowboys-vs-wizards-board-duel.html /tmp/camp-shots`: 20 of 20 checks pass in headless Chrome with a fresh profile, `?seed=0`, 99 real mouse clicks, 18 privacy checks, and no page errors. Boot Hill and Raven Roost are won by clicks alone, both rewards are checked in `localStorage`, the choice is made once in the result panel and once in the Camp, three reloads continue from the saved progress, and `?mode=lanes` and `?mode=match` still load the lane duel. Screenshots were not committed.

A scripted run supports claims about flow only. Layout, clarity and fun are not reviewed here; they need a rendered review and a human playtest.
