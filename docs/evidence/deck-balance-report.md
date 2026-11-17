# Deck balance report: sampled Cowboy decks against the CPU Wizard

Work by Fable (Claude Fable 5.2, in a collaborator's Claude Code session), 2026-11-16 Pacific, on branch `rachel/deck-balance` for issue #28. Not Kiro or Codex work. No rule, card value or CPU code was changed; nothing under `src/` was edited.

**Every number here is an estimate under the conditions below: one heuristic bot playing both sides. Computer-against-computer results are not evidence of how people play, of which decks people would enjoy, or of balance for human players.** The Cowboy bot is the same one-clash-lookahead heuristic described in [the earlier CPU playtests](fable-cpu-playtests.md); it does not plan tribute chains across turns, so a deck it plays badly may be a deck it does not know how to play.

## Run conditions

| | |
| --- | --- |
| Command | `node scripts/deck-balance.mjs --out docs/evidence/deck-balance/cpu-vs-cpu-201-decks-seeds-0-199.json` (defaults: `--decks 200 --from 0 --count 200`) |
| Decks | 201: the starter deck plus 200 others, taken from a shuffle (mulberry32, sample seed `0xdecc`) of the valid decks. Only 203 valid 12-card decks exist, so the sample omits two: `1/2/3/6` and `5/4/3/0`. |
| Seeds | 0 to 199, the same range for every deck |
| Starting side | Each deck and seed is played twice, once with the Cowboy acting first in round 1 and once with the Wizard, by forcing the first seat with the existing `openingMatch(seed, "shipped", starter)`. The shipped opening is otherwise unchanged. |
| Matches | 80,400 (201 decks × 200 seeds × 2 starts); 400 per deck |
| Bots | Cowboy `cpu`, Wizard `cpu` (`chooseAction` in `src/game/cpu.js`); each sees only its public view |
| Wizard deck | The default Wizard deck in every match |
| Rules version | `orb-duel-draft-1` |
| Commit | Game code at `848b87b` (`main`); the script and test are added by this branch |
| Environment | Node v26.3.1, macOS 26.6.2, Apple M3 |
| Run time | 26 s wall for the full run |
| Repeatability | Run twice; the two JSON files were byte-identical (`cmp`). SHA-256 `0b8efc870ff8bf1509969e9f721aec476520e5c35ae487451a46149769928c90` |
| Failures | None. Every match finished within the 54-action bound; no match threw. |

Deck keys are written **Sheriff / Billy / Mounted Billy / Deadeye**. All results are from the Cowboy side. Full data, including all 201 decks in rank order: [`deck-balance/cpu-vs-cpu-201-decks-seeds-0-199.json`](deck-balance/cpu-vs-cpu-201-decks-seeds-0-199.json).

## Starter deck

| Deck | Matches | Won | Lost | Drew | Win rate | Loss rate | Draw rate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 6/3/1/2 (starter) | 400 | 191 | 175 | 34 | 47.8% | 43.8% | 8.5% |

It ranks 4th of the 201 sampled decks. With 400 matches per deck, a win rate near 50% carries a sampling error of roughly ±5 percentage points (95%), so the top handful of decks are not reliably ordered.

## All sampled decks together

| | Matches | Won | Lost | Drew | Win rate |
| --- | --- | --- | --- | --- | --- |
| All 201 decks | 80,400 | 9,349 | 68,361 | 2,690 | 11.6% |

Under these conditions most valid decks lose heavily. The median deck won 7.5% of its matches. Six decks won more than they lost, ten won at least 40%, and six won none of their 400 matches.

## Ten best sampled decks

| Sheriff | Billy | Mounted Billy | Deadeye | Won | Lost | Drew | Win rate | Win rate, Cowboy first | Win rate, Wizard first |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 6 | 3 | 0 | 3 | 235 | 128 | 37 | 58.8% | 73.5% | 44.0% |
| 6 | 4 | 0 | 2 | 209 | 157 | 34 | 52.3% | 67.0% | 37.5% |
| 6 | 2 | 0 | 4 | 195 | 164 | 41 | 48.8% | 59.0% | 38.5% |
| 6 | 3 | 1 | 2 | 191 | 175 | 34 | 47.8% | 61.5% | 34.0% |
| 5 | 4 | 0 | 3 | 188 | 176 | 36 | 47.0% | 61.5% | 32.5% |
| 6 | 2 | 1 | 3 | 187 | 174 | 39 | 46.8% | 56.0% | 37.5% |
| 5 | 5 | 0 | 2 | 166 | 198 | 36 | 41.5% | 55.0% | 28.0% |
| 5 | 3 | 0 | 4 | 163 | 207 | 30 | 40.8% | 55.5% | 26.0% |
| 5 | 4 | 1 | 2 | 161 | 203 | 36 | 40.3% | 53.5% | 27.0% |
| 6 | 5 | 0 | 1 | 160 | 203 | 37 | 40.0% | 59.0% | 21.0% |

The fourth row is the starter deck.

## Ten worst sampled decks

| Sheriff | Billy | Mounted Billy | Deadeye | Won | Lost | Drew | Win rate | Win rate, Cowboy first | Win rate, Wizard first |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 0 | 6 | 4 | 0 | 400 | 0 | 0.0% | 0.0% | 0.0% |
| 1 | 1 | 6 | 4 | 0 | 400 | 0 | 0.0% | 0.0% | 0.0% |
| 1 | 1 | 5 | 5 | 0 | 400 | 0 | 0.0% | 0.0% | 0.0% |
| 1 | 1 | 4 | 6 | 0 | 400 | 0 | 0.0% | 0.0% | 0.0% |
| 1 | 0 | 6 | 5 | 0 | 400 | 0 | 0.0% | 0.0% | 0.0% |
| 1 | 0 | 5 | 6 | 0 | 400 | 0 | 0.0% | 0.0% | 0.0% |
| 2 | 0 | 5 | 5 | 1 | 399 | 0 | 0.3% | 0.5% | 0.0% |
| 2 | 0 | 4 | 6 | 1 | 399 | 0 | 0.3% | 0.5% | 0.0% |
| 1 | 2 | 6 | 3 | 1 | 399 | 0 | 0.3% | 0.5% | 0.0% |
| 1 | 2 | 5 | 4 | 1 | 399 | 0 | 0.3% | 0.5% | 0.0% |

Decks tied on wins and losses are listed in deck-key order.

## Win rate by number of copies of each card

Each row pools every sampled deck that holds that many copies. A deck always totals twelve cards, so the cards are not independent: more of one card means fewer of the others. Read each table as an association in this sample, not as the effect of one card.

| Card | Copies | Decks | Matches | Win rate | Loss rate | Draw rate |
| --- | --- | --- | --- | --- | --- | --- |
| Sheriff | 1 | 32 | 12,800 | 1.1% | 98.7% | 0.2% |
| Sheriff | 2 | 36 | 14,400 | 2.2% | 96.5% | 1.3% |
| Sheriff | 3 | 37 | 14,800 | 7.9% | 90.1% | 2.0% |
| Sheriff | 4 | 36 | 14,400 | 13.5% | 82.9% | 3.6% |
| Sheriff | 5 | 32 | 12,800 | 21.7% | 72.6% | 5.7% |
| Sheriff | 6 | 28 | 11,200 | 26.9% | 64.9% | 8.2% |
| Billy | 0 | 27 | 10,800 | 8.8% | 88.9% | 2.4% |
| Billy | 1 | 31 | 12,400 | 10.6% | 86.4% | 3.1% |
| Billy | 2 | 32 | 12,800 | 13.0% | 83.5% | 3.5% |
| Billy | 3 | 33 | 13,200 | 13.7% | 82.6% | 3.6% |
| Billy | 4 | 30 | 12,000 | 13.2% | 83.1% | 3.7% |
| Billy | 5 | 27 | 10,800 | 11.6% | 84.8% | 3.6% |
| Billy | 6 | 21 | 8,400 | 9.3% | 87.3% | 3.5% |
| Mounted Billy | 0 | 27 | 10,800 | 24.7% | 69.8% | 5.5% |
| Mounted Billy | 1 | 31 | 12,400 | 19.1% | 75.7% | 5.1% |
| Mounted Billy | 2 | 33 | 13,200 | 13.9% | 81.8% | 4.3% |
| Mounted Billy | 3 | 31 | 12,400 | 9.4% | 87.1% | 3.5% |
| Mounted Billy | 4 | 31 | 12,400 | 5.7% | 92.2% | 2.2% |
| Mounted Billy | 5 | 27 | 10,800 | 3.7% | 95.0% | 1.2% |
| Mounted Billy | 6 | 21 | 8,400 | 2.5% | 96.9% | 0.6% |
| Deadeye | 0 | 26 | 10,400 | 7.8% | 87.8% | 4.4% |
| Deadeye | 1 | 31 | 12,400 | 12.6% | 83.2% | 4.2% |
| Deadeye | 2 | 33 | 13,200 | 15.3% | 80.8% | 3.9% |
| Deadeye | 3 | 33 | 13,200 | 15.1% | 81.2% | 3.6% |
| Deadeye | 4 | 31 | 12,400 | 12.5% | 84.7% | 2.9% |
| Deadeye | 5 | 27 | 10,800 | 8.7% | 88.9% | 2.4% |
| Deadeye | 6 | 20 | 8,000 | 5.9% | 92.8% | 1.4% |

## Results by starting side

| Acted first in round 1 | Matches | Cowboy won | Cowboy lost | Drew | Cowboy win rate |
| --- | --- | --- | --- | --- | --- |
| Cowboy | 40,200 | 5,940 | 32,602 | 1,658 | 14.8% |
| Wizard | 40,200 | 3,409 | 35,759 | 1,032 | 8.5% |

For the starter deck alone: 61.5% wins (123 of 200) when the Cowboy acts first and 34.0% (68 of 200) when the Wizard does.

## Match length and endings

| | |
| --- | --- |
| Actions per match | mean 20.99, minimum 8, maximum 41 (bound 54) |
| Starter deck, actions per match | mean 31.86 |
| Ended by a destroyed Base | 77,259 (96.1%) |
| Ended at the nine-round limit | 3,141 (3.9%) |

| Final round | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Matches | 16,920 | 17,980 | 14,497 | 11,506 | 7,977 | 5,544 | 5,976 |

Matches in which each card was played at least once, of 80,400: Sheriff 69,552; Billy 48,768; Mounted Billy 10,558; Deadeye 38,943; Skeleton 80,400; Wizard 64,239; Dragon 7,572; Singularity 52,092. The decks differ in how many copies they hold, so the Cowboy figures are not comparable card to card.

## What these estimates suggest

1. **Under this bot, Sheriff count dominates.** Pooled win rate rises with every added Sheriff, from about 1% with one to about 27% with six. All ten best decks hold five or six Sheriffs; all ten worst hold one or two. The deck builder's only floor is one Sheriff.
2. **More Mounted Billy goes with more losses under this bot.** Pooled win rate falls with every added copy, from about 25% with none to about 2.5% with six. Mounted Billy needs two tributes and this bot looks one clash ahead, so this may measure the bot more than the card.
3. **The starter deck is among the strongest sampled decks, and no sampled deck clearly dominates it.** It ranks 4th of 201. The top deck, 6/3/0/3, won 58.8%, about 11 points above the starter.
4. **Acting first matters about as much as the deck does near the top.** The starter deck's win rate differs by 27.5 points between acting first and second. This matches the direction of the earlier natural-start runs.

None of this is a recommendation to change a rule or a card. A person can plan a tribute chain that this bot does not, so the weak results for tribute-heavy decks in particular should not be read as how those decks play in human hands.

## Checks run

| Command | Result |
| --- | --- |
| `node --test tests/game/deck-balance.test.js` | 2 tests, 2 pass, about 0.09 s |
| `node scripts/deck-balance.mjs --out …` twice, then `cmp` | byte-identical |
| `node scripts/verify-duel.mjs` | 159 tests, 159 pass (the 157 existing and the 2 new); both model files pass the structure check |
