# Showdown: the deck built after Raven Roost is the deck The Bone Fence deals (K-006, K-034, K-036)

Scripted headless-Chrome check, not a human playtest. It says nothing about clarity or fun.
Performed by Kiro, native Workflow child agent `wf-coder` (workflow `wf_0caa098302291536`, child 1 of 2, the implementer); an independent reviewer child owns the verdict. Date 2026-11-20 (America/Los_Angeles), build `7fdc234a59ba` (branch `kiro/showdown-deck-to-combat` from `7fdc234`).

## Reproduce

```
node scripts/build-graybox.mjs
node scripts/browser-showdown-deck-check.mjs dist/cowboys-vs-wizards-board-duel.html [outDir]
DECK_CHECK_EXPECT=default  node scripts/browser-showdown-deck-check.mjs dist/cowboys-vs-wizards-board-duel.html .artifacts/deck-neg-default   # must fail
DECK_CHECK_EXPECT=offByOne node scripts/browser-showdown-deck-check.mjs dist/cowboys-vs-wizards-board-duel.html .artifacts/deck-neg-off       # must fail
```

Script: [`scripts/browser-showdown-deck-check.mjs`](../../scripts/browser-showdown-deck-check.mjs). Fresh temporary Chrome profile, built page over a `127.0.0.1` HTTP server, empty storage asserted at start. The test writes no save; storage is only read for comparison. No `src/` file changed and the page has no test hook.

## Steps and results

| # | What | Result | Label |
|---|------|--------|-------|
| 1 | `?seed=0`, mouse on Play, then Boot Hill. Won on seed 0 (1 game). Offer `[Covered Wagon, Deadeye]`, took **Covered Wagon** | won | OBSERVED |
| 1 | `?seed=0`, Play, Raven Roost. Won on seed 0 (1 game). Offer `[Outrider, Deadeye]`, took **Outrider** | won | OBSERVED |
| 1 | Stored save deep-equals `progress.js` replay (`settle` and `choose`) of those results and picks. Deck Sheriff 4, Billy 5, Deadeye 3, Covered Wagon 2, Outrider 2; collection Deadeye 3, Covered Wagon 3, Outrider 3 | equal | OBSERVED |
| 2 | Keys: Tab ×3 to `#camp-build`, Enter; Enter on Sheriff deck "−"; Tab ×8 to Covered Wagon deck "+", Space; builder reads "Deck 16 of 16 · side deck 0 of 4.", Save enabled; Tab ×5 to `#builder-cancel`, Enter | legal draft, cancelled | OBSERVED |
| 2 | Stored save (304 bytes) byte-identical before and after Cancel; Camp lists "Sheriff ×4, Billy ×5, Deadeye ×3, Covered Wagon ×2, Outrider ×2"; focus on `#camp-build` | unchanged | OBSERVED |
| 3 | Keys: Enter on `#camp-build` (focus already there); Enter on Sheriff deck "−"; Tab ×11 to Outrider deck "+", Space; Tab ×1 to `#builder-save`, Enter | saved | OBSERVED |
| 3 | Stored deck entries, in order: Sheriff 3, Billy 5, Deadeye 3, Covered Wagon 2, Outrider 3. Nothing else in the save changed. Focus back on `#camp-build` | equal | OBSERVED |
| 3 | Reload at `?seed=3`; Tab ×1 to `#menu-play`, Enter; the Camp lists "Sheriff ×3, Billy ×5, Deadeye ×3, Covered Wagon ×2, Outrider ×3"; save byte-identical to the one stored before the reload | kept | OBSERVED |
| 4 | Enter on `#camp-trail [data-duel=trail]` (focus already there). Status "The Bone Fence · turn 1 · your turn" | opened | OBSERVED |

Seed 3 is the first Bone Fence seed for which Node's deal of the edited deck holds `cowboy-outrider-3` (a card only the edited deck has) and whose card names differ from the default and off-by-one decks' hands. It was picked in Node before the reload (INFERRED from Node, then OBSERVED in the page).

## Boundary proof

(a) Duel creation. The check enables the CDP Debugger after the reload. It finds the minified `createShowdown` in the inline bundle by its unique `secondPlayerCards:` parameter pattern and sets a logpoint at the function body's entry (`Debugger.setBreakpoint`, condition logs `arguments[0]` and `Object.entries(arguments[1].decks.cowboy)`, then returns false; resolved at line 130, column 9379 of the page). Only the Cowboy deck is recorded. OBSERVED: exactly one call while The Bone Fence opened, `seed: 3`, Cowboy deck in order `[["cowboy-sheriff",3],["cowboy-billy",5],["cowboy-deadeye",3],["cowboy-covered-wagon",2],["cowboy-outrider",3]]`. That equals the independently computed edited deck. The default and off-by-one decks are not equal to it.

(b) Public trace. These are the player's own hand buttons at turn 1, and each shows its card name:

| Deck | Cowboy opening hand, seed 3 | Source |
|------|------------------------------|--------|
| On screen | outrider-3, outrider-1, deadeye-3, billy-5 (Outrider, Outrider, Deadeye, Billy) | OBSERVED |
| Edited (Sheriff 3, Billy 5, Deadeye 3, Covered Wagon 2, Outrider 3) | outrider-3, outrider-1, deadeye-3, billy-5 | Node `createShowdown(3, duelFor(save, "trail").options)` |
| Default (Sheriff 4, Billy 5, Deadeye 3, Covered Wagon 2, Outrider 2) | outrider-2, covered-wagon-2, deadeye-2, billy-4 (Outrider, Covered Wagon, Deadeye, Billy) | Node, same seed and options |
| Off-by-one (Sheriff 3, Billy 6, Deadeye 3, Covered Wagon 2, Outrider 2) | outrider-2, covered-wagon-2, deadeye-2, billy-5 | Node, same seed and options |

The Bone Fence is duel id `"trail"` at `wins: 2` (`duelFor(save, "trail")`; there is no `"bone-fence"` id). The check also asserts that Node's deal with the saved deck equals its deal through `duelFor` options.

## Negative controls

- In every run, both the capture and the on-screen hand are asserted not to match the default deck or the off-by-one deck. OBSERVED: they did not match.
- `DECK_CHECK_EXPECT=default` gave exit 1 with `AssertionError: captured {"seed":3,"cowboy":[["cowboy-sheriff",3],…,["cowboy-outrider",3]]}, expected [["cowboy-sheriff",4],…,["cowboy-outrider",2]]`. OBSERVED.
- `DECK_CHECK_EXPECT=offByOne` gave exit 1 with the same captured deck against expected `[["cowboy-sheriff",3],["cowboy-billy",6],…,["cowboy-outrider",2]]`. OBSERVED.
- These two runs stop at the capture assertion, so their hand assertion is not reached. The hand mismatch for the wrong decks is covered by the in-run controls above.

## Runs (2026-11-20, about 11:40 PST)

- `node scripts/build-graybox.mjs`: `Built dist/cowboys-vs-wizards-board-duel.html (graybox, build 7fdc234a59ba)`.
- `node scripts/browser-showdown-deck-check.mjs dist/cowboys-vs-wizards-board-duel.html`: `6 checks passed`, no page exceptions or console errors. It passed on both runs.
- `node scripts/browser-showdown-keyboard-check.mjs dist/cowboys-vs-wizards-board-duel.html` (regression): `7 checks passed`.

## Findings and gaps

- No player-facing defect was found: the edited deck is used, Cancel leaves the career unchanged, and focus returns to Build deck after Cancel and Save. No `src/` change.
- The Trail wins use mouse presses, as in the modes check. Only the deck change, save, reload entry and launch use the keyboard. Escape was not used because the builder has no Escape binding, and the check makes no claim about one.
- Hand ids such as `-3` are DOM attributes on the player's own hand buttons. The card names are what a player sees, and they also discriminate here (Outrider against Covered Wagon in the second card).
- The check covers one seed, one edit and one career path. The reviewer child has not yet given its verdict. Human playtests are pending.
