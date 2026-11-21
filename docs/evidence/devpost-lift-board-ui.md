# Devpost lift: board-ui (Kiro CLI worker)

Boot Hill pass first slice from Fable 5.2's `board-design.md` and the board markup contract, implemented by a Kiro CLI
worker on branch `kiro/devpost-lift-board-ui`, base `ea183ee`. Files: `src/ui/showdown-screen.js`, new
`src/ui/showdown-zones.js`, new `tests/match/showdown-zones.test.js`. No engine, contract, save, CSS or art change.

## Selectors

- `#sd-board` children, in order: `.sd-zone-rail[data-zone-side=<rival>]`, `.sd-side[data-side=<rival>]`,
  `.sd-side[data-side=<own>]`, `.sd-zone-rail[data-zone-side=<own>]`. The rails sit beside the `.sd-side` rows, not
  inside them, so the existing `.sd-side` grid is unchanged.
- Rail cells `.sd-zone[data-zone=deck|hand-count|traps|graveyard]`. Rival: deck, hand-count, traps, graveyard. Own:
  graveyard, traps, deck (no own hand-count; the hand is shown).
- Hand backs: `[data-zone=hand-count] .sd-backs .card-back`, aria-label `<Faction> hand: N cards, face down`; count in
  `.sd-zone-count`. Trap text: `[data-zone=traps] .sd-trap-line` (`Set: …` / `No trap set` for the seat at the table
  only; otherwise `N cards face down` / `Nothing face down`). Spent-trap flip: `[data-trap-sprung]` ("Sprung: name"),
  shown only for traps named by that batch's `trap` events.
- Pile: `button.sd-pile[data-graveyard=cowboy|wizard]` when non-empty (`.sd-zone-top` newest name,
  `.sd-zone-count`, `[data-raise-dot]`, `.sd-grew` on the pile that grew in the last batch). Empty:
  `span.sd-pile.sd-empty[data-graveyard-empty=<side>]` "Boot Hill · empty", not a button. Accessible name
  "<Faction> Boot Hill graveyard: N cards, newest X[, Raise returns Y]. Open the pile".
- Sheet: `dialog#sd-graveyard-sheet` (showModal), title `#sd-graveyard-title`, rows `[data-graveyard-card=<i>]`
  newest first (index, never a card id), `[data-raise-target]` tag "Raise returns this", `.sd-graveyard-text` rules
  text for the opened row, `[data-graveyard-close]`.
- Ticker: `#sd-zone-move` (aria-live polite) above `#sd-hand`, last four moves, e.g. `Skeleton → Wizard Boot Hill
  (tribute) · Skeleton ← Wizard Boot Hill (Raise)`. Tags: tribute, Raise, trap spent, burned draw, fell.

## Behaviour

- Raise marker: `discard.findLastIndex(Undead troop)`, the rule in `rules.js` summon, shown only for a side whose
  public deck list holds a Raise card. Tribute and Raise stay one transaction; the ticker describes them from the
  events in order, and the pile from the final view.
- The sheet closes before any action, deal, pass, Back to camp; Escape/Close returns focus to `[data-graveyard=side]`.
  Pile buttons are disabled during a pick (rail inert). The curtain empties `#sd-zone-move` and the sheet along with
  the existing private ids; the move record survives and repaints after "I'm ready", and is reset on every deal.
- The Base now shows only Base state; the old Graveyards section and the Base's Hand/Deck/Graveyard/▲ trap lines
  are gone, as the design asks.

## Checks (2026-11-20 run, local, America/Los_Angeles)

- `node --test tests/match/showdown-zones.test.js tests/match/showdown-session.test.js tests/match/showdown-cues.test.js`:
  17 pass, 0 fail. The zones test plays two-player starter duels (seeds 0–59) and checks sheet order = view discard
  order newest first, the Raise marker = the engine's raised card, no rival/unnamed hand or trap identity or card id
  in rail or sheet, and that tribute, Raise, trap spent and fell all appear.
- `npm run build`, then `node scripts/browser-showdown-keyboard-check.mjs <html>`: 7 checks pass.
- `scripts/browser-showdown-check.mjs`: fails at its first privacy read because it parses Hand count, `.sd-backs`
  and the `▲` trap line inside `[data-base=wizard]`. A temporary local copy reading the same values from
  `.sd-zone-rail[data-zone-side=wizard]` passed all 22 checks; the copy was deleted.
- A temporary two-player Chrome script (deleted) played `?seed=0` Two players to a result: 10 curtains with empty
  board/hand/ticker/sheet and no card ids, 8 sheet opens (row count and top = cell, focus on row 0, Raise tag iff dot,
  3 with a Raise marker, Close and Escape both returned focus to the pile), empty piles were spans, ticker showed
  tribute, Raise, trap spent and fell.
- `browser-showdown-wizard-check.mjs --page`: FAIL only with "Cowboy hand shows 0 backs" (same Base read).
- `browser-showdown-cues-check.mjs`: fails `/attack was cancelled/` at base `ea183ee` too (pre-existing).
- Pending: `browser-showdown-first-input.mjs` (needs the hosted build), modes, trail and outrider-webkit scripts,
  390px layout (CSS worker), rendered review, human playtest.

## Deviations and handoffs

- QA: `browser-showdown-check.mjs:131-134`, `browser-showdown-trail-check.mjs:252`,
  `browser-showdown-modes-check.mjs:242`, `browser-showdown-wizard-check.mjs:144`,
  `browser-showdown-outrider-webkit.mjs:102` read hand backs, Hand count or traps from the Base; move them to the
  rail selectors above.
- CSS: no styles were added for `.sd-zone-rail`, `.sd-zone`, `.sd-pile`, `.sd-grew` (one pulse), `[data-raise-dot]`,
  `[data-trap-sprung]`, the dialog or `#sd-zone-move`.
- The sheet row text uses the screen's `face()` card text, not lane `describeCard` (that takes lane card models).
- The trap flip is text in the owner's trap cell for the batch, not an animation. No build-log entry: the coordinator
  owns `docs/kiro-build-log.md`.
