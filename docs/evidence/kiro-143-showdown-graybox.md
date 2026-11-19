# Issue 143 slice 1: Showdown in the graybox entry (Kiro worker evidence)

2026-11-19, 15:16 PST (America/Los_Angeles). Kiro CLI worker (Claude Opus 5.5), isolated worktree on branch
`kiro/143-screen`, base `735cb09`. Brief: [showdown-integration-kiro-brief.md](../design/showdown-integration-kiro-brief.md), slice 1, done-when 3.
Scope was the graybox entry, its UI and build, and a browser acceptance check. The engine move into
`src/game/showdown/` belongs to a parallel worker and is not in this change.

## What changed

- [`src/app.js`](../../src/app.js) is the new graybox build entry. With no `mode`, the title shows Play and a
  "Lane duel (previous rules)" link; Play opens Trail duel 1, Boot Hill. `?mode=lanes` loads the unchanged
  lane app [`src/graybox.js`](../../src/graybox.js), and so do the lane modes already used by checks and links
  (`match`, `ride-out`, `practice-dynamiter`, `practice-tribute`, `fire-arc`). The lane menu gains a
  "Showdown (new rules)" link. The Wanted, Build Deck, How to Play, Achievements, rival and fire-arc entries
  are hidden on the Showdown entry and remain on `?mode=lanes`.
- The worker's temporary import adapter (`src/match/showdown-engine.js`) was removed at integration. The screen
  and session import `src/game/showdown/{rules,cards,contract,presenter}.js` directly, and every visible log
  line comes from the canonical `presentEvent`. `TRAIL` and `STARTER` stay on `prototypes/showdown/trail.js`
  until slice 2.
- [`src/match/showdown-session.js`](../../src/match/showdown-session.js) keeps the full state in a closure. The
  screen receives only `viewFor(state, "cowboy")`, the seat's `legalActions` and events. `bootHill()` builds
  the options that `duelFor(newSave(), "trail:boot-hill")` builds. No progress is saved (slice 2).
- [`src/ui/showdown-screen.js`](../../src/ui/showdown-screen.js) and [`showdown.css`](../../src/ui/showdown.css)
  adapt the reference screen in `prototypes/showdown/main.js`. Troop, spell and trap use the pull request 139
  `data-frame` borders; gear and location use the reference screen's borders.
- Fixed against the reference screen, which reads the full state in places:
  - The keyword list came from both hands and decks. It now comes from the duel's two public deck lists.
  - Card-refusal reasons, attack previews (`attackOutcome` on the view) and graveyards now come from the view.
  - The Wizard hand is drawn as `.card-back` elements, one per card, with a count.
  - Input is accepted only as an action from the seat's legal list. The session refuses anything else, and it
    refuses everything while it is not the seat's turn or after the result.
- [`scripts/build-graybox.mjs`](../../scripts/build-graybox.mjs) builds `src/app.js` and appends `showdown.css`. The
  output is still one offline HTML file, or `dist/web/index.html` with `--web`.

## Checks run

| Command | Result |
| --- | --- |
| `node --test tests/match/showdown-session.test.js` | 4/4 pass: presenter covers all 16 `EVENTS` and throws on others; Boot Hill options; 40 seeds of simple play with no Wizard hand, trap or deck id in any view (at least 36 Cowboy wins required); illegal action refused |
| `npm test` | 501/501 Node tests pass; GLB structure preflight 2/2 |
| `node scripts/build-graybox.mjs` then `node scripts/browser-showdown-check.mjs dist/cowboys-vs-wizards-board-duel.html` | 12/12 checks pass, [report](kiro-143-showdown-graybox/browser-showdown-file.json) |
| `node scripts/build-graybox.mjs --web` then `node scripts/browser-showdown-check.mjs dist/web/index.html .artifacts/showdown-143-web` | 12/12 checks pass, [report](kiro-143-showdown-graybox/browser-showdown-web.json) |

The browser check runs native headless Chrome with a fresh profile, opens the page from `file://` and sends
only real mouse events through DevTools. Each click must land on the topmost element at that point. The
check covers:

- With no seed, Play opens Boot Hill and not the lane arena.
- On `?seed=0`, Boot Hill is won by clicks alone: 8 Cowboy turns, 15 attacks, 63 clicks in the run.
  The final screen shows "You win: the Wizard Base fell." and the Wizard Base at 0 of 3 orbs
  ([screenshot](kiro-143-showdown-graybox/boot-hill-won.png)).
- Turn 1 offers no attacker or target. After one summon, the other troop cards are disabled with
  "One troop a turn.", and clicking one changes nothing.
- Every action shows its presenter line in `#sd-feedback` and the log.
- At every turn, no `wizard-*-N` card id appears in the rendered screens, the number of card backs equals the
  Wizard hand count, and the Wizard traps show only as a count.
- `?mode=lanes` shows the lane menu and Play opens the lane duel. `?mode=match&deck=starter&seed=0` still
  auto-starts the lane duel.
- The run had no page exceptions or console errors.

Observed failure during development: the first version of the check's click strategy played only one card a
turn and paid tributes every turn. It lost Boot Hill on seed 0 ("You lose: your Base fell."). The strategy now
plays every enabled card each turn and wins. No product change came from this.

## Pending and handoff

- Done at integration: the adapter is gone and the screen uses the canonical modules and presenter.
  The canonical presenter test covers done-when 2.
- Coordinator: add a `docs/kiro-build-log.md` entry. The log is coordinator-owned, so this worker did not edit it.
- Not run: the existing lane browser scripts. Those that build their own URL with `?mode=match` keep
  working. Any that load the bare page and expect the lane menu, such as `browser-menu-check.mjs` against
  the art build's title, need `?mode=lanes` when pointed at the graybox. The art build (`src/main.js`,
  `?mode=demo`) is untouched.
- The appearance is reviewed from the screenshots only. Clarity and fun need the human playtest in
  [PLAYTEST.md](../../prototypes/showdown/PLAYTEST.md).
