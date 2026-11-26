# Boot Hill Poker

Two-seat five-card draw dressed as a haunted Western BBS. You play the Cowboy
against a deterministic local Wizard bot. No accounts, cash, betting, network
or frameworks. This is a standalone experiment and does not touch Showdown.

## Play

Terminal:

    node experiments/boot-hill-poker/cli.mjs --seed 17 [--first wizard] [--strategy pat] [--no-color]

Browser: serve this folder over local http (module scripts do not load from
`file://`), for example `python3 -m http.server` inside it, then open
`index.html?seed=17`. If your checkout disables symbolic links, stage the site with
`node scripts/stage-pages.mjs` at the repo root and serve `dist/web`, then open `/poker/?seed=17`.

Keys (both front ends): `1`-`5` mark or unmark a card to toss, `Enter` (or `D`)
draws, `R` replays the same seed, `N` deals a new hand from a derived seed with
the other seat drawing first, `Q` hangs up.

## Rules

- 52 unique cards, shuffled by Fisher-Yates using the same Frontier Kit seeded generator as Showdown. Poker handles its own text seeds and draw rules.
- Five cards each, dealt alternately starting with the first seat.
- Each seat takes one draw turn in order and may toss 0-5 cards.
  Turn 1 is the first seat's draw, turn 2 the second's, then showdown.
- Standard hand ranks. A-2-3-4-5 (the wheel) is a five-high straight;
  straights do not wrap (Q-K-A-2-3 is high card). Suits never break ties.
- The opponent's cards stay hidden until showdown. The result names the
  winner and why (higher category, or the deciding kicker).

Bot `standard` strategy: stand pat on a straight or better; keep pairs, two
pair and trips and toss the rest; else draw one to four of a flush, then to
four in a row; else keep the highest card. `pat` never draws.

## Files

- `engine.js`: pure rules and state (no DOM or Node APIs).
- `controls.js`: shared key handling (`startSession`, `applyKey`).
- `render.js`: shared BBS screen as tone segments, `toAnsi` and `toHtml`.
- `cli.mjs`, `index.html`, `app.js`: terminal and browser front ends.
- `engine.test.mjs`: `node --test experiments/boot-hill-poker/`

## API

    playPokerDuel(seed, first = 'cowboy', strategy = 'standard')
      -> { winner: 'cowboy' | 'wizard' | 'draw', endTurn: 2 }

Both seats use `strategy` (or pass `{ cowboy, wizard }`). `first` accepts
`'cowboy'`, `'wizard'`, `0` or `1`.

Interactive state (every call returns a new state object):

- `newDeal({ seed, first, human = 'cowboy', strategy, dealNumber })`; bot seats
  act at once, so the state waits on the human or is already at showdown.
- `toggleDiscard(state, index)`, `submitDraw(state, indices?)`
- `replayDeal(state)`, `nextDeal(state)`
- `viewState(state, seat)`: what that seat may see; opponent cards are `null`
  and the deck is absent until showdown. Front ends render only from this.
- `evaluateHand`, `compareHands`, `decideShowdown`, `chooseDiscards`,
  `shuffleDeck`, `createRng`.
