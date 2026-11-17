# Wizard difficulty preview: easy, normal and hard

Work by Fable (Claude Fable 5.2, in a collaborator's Claude Code session), 2026-11-16 Pacific, on branch `rachel/cpu-difficulty` for issue #34. Not Kiro or Codex work. No card value, rule or legal move was changed; under `src/game/` only `cpu.js` was edited, and only by adding to it.

**These are computer-against-computer estimates. The Cowboy in every match is the same `normal` heuristic bot, which is not a person. The numbers say how the three levels rank against that bot under these seeds, not how hard each level will feel to a player.**

## What each level does

All three are pure functions of `publicState(state, side)`: they see their own hand, both boards, both Bases and the card counts, and nothing else. None uses a random source, so a seed replays the same way at every level.

| Level | Address | What it does |
| --- | --- | --- |
| `easy` | `?cpu=easy` | Summons exactly as `normal` does, but never casts a spell. Where `normal` would cast, it ends its phase. |
| `normal` | `?cpu=normal`, or no parameter | The existing opponent, unchanged: `chooseAction`. It scores each action by the position after the next clash. |
| `hard` | `?cpu=hard` | The same kind of scoring with three differences: it plays out the next **two** clashes instead of one; it scores a summon together with the best spell that could follow it in the same phase; and it weighs the enemy Base slightly above its own (5 against 4 per orb), where `normal` does the reverse (4 against 5). |

Any other value of `cpu` is the `normal` opponent. `hard` does not model what the Cowboy might play next; like `normal`, it assumes neither side adds anything after its own move.

## Commands and results

Node v26.3.1, macOS 26.6.2, Apple M3, from the repository root on `main` at `c65f49e` plus this branch. Rules version `orb-duel-draft-1`. Each command is `node scripts/simulate-matches.mjs --from F --count C --cowboy cpu --wizard LEVEL`. Each seed's deal and starting side are the shipped ones. Every match finished within the 54-action bound. A 2,000-match run took about 2.3 s.

### Seeds 2000 to 3999 (2,000 matches per level; not used to choose anything)

| Wizard level | Wizard wins | Cowboy wins | Draws | Wizard win rate |
| --- | --- | --- | --- | --- |
| `easy` | 276 | 1,551 | 173 | 13.8% |
| `normal` | 942 | 884 | 174 | 47.1% |
| `hard` | 1,137 | 656 | 207 | 56.9% |

By starting side (Wizard wins / Cowboy wins / draws):

| Wizard level | Cowboy acts first in round 1 (1,003 matches) | Wizard acts first (997 matches) |
| --- | --- | --- |
| `easy` | 65 / 882 / 56 | 211 / 669 / 117 |
| `normal` | 311 / 607 / 85 | 631 / 277 / 89 |
| `hard` | 500 / 405 / 98 | 637 / 251 / 109 |

Match length and endings:

| Wizard level | Mean actions per match (min, max) | Base destroyed | Round limit | Final round 3, 4, 5, 6, 7, 8, 9 |
| --- | --- | --- | --- | --- |
| `easy` | 29.38 (9, 38) | 1,698 | 302 | 63, 77, 194, 440, 392, 326, 508 |
| `normal` | 31.87 (9, 40) | 1,652 | 348 | 63, 65, 107, 374, 381, 440, 570 |
| `hard` | 25.64 (9, 40) | 1,917 | 83 | 72, 454, 447, 397, 238, 198, 194 |

### Seeds 0 to 999 (1,000 matches per level; the seeds `hard` was tuned on)

| Wizard level | Wizard wins | Cowboy wins | Draws | Cowboy first: W / C / D (480) | Wizard first: W / C / D (520) | Mean actions |
| --- | --- | --- | --- | --- | --- | --- |
| `easy` | 129 | 772 | 99 | 33 / 415 / 32 | 96 / 357 / 67 | 29.59 |
| `normal` | 472 | 425 | 103 | 159 / 270 / 51 | 313 / 155 / 52 | 31.99 |
| `hard` | 588 | 307 | 105 | 258 / 167 / 55 | 330 / 140 / 50 | 25.99 |

The `normal` row reproduces run A of [the earlier CPU playtests](fable-cpu-playtests.md) exactly.

## What these estimates suggest

- **The order holds under these conditions:** `hard` won more often than `normal`, and `normal` more often than `easy`, on both seed ranges.
- **Most of `hard`'s gain is in matches where the Cowboy acts first.** There it won 500 of 1,003 against `normal`'s 311. When the Wizard acts first the two are nearly level, 637 against 631 of 997, a difference too small to call.
- **`hard` ends matches sooner.** Its matches most often end in rounds 4 to 6 and rarely reach the round limit; `normal`'s most often reach rounds 8 and 9.
- **`easy` is much weaker against this bot** (about 14% wins), which shows how much of the Wizard's strength under this bot comes from Singularity. Whether that is the right amount of "easy" for a person is not something these runs can say.

## How `hard` was chosen, and what was looked at

`hard`'s five constants (two clashes, half weight for a Base that falls in the second, own Base 4, enemy Base 5, spell cost 2) were picked by trying 16 settings on seeds 0 to 999 and keeping the best. Nine of those settings were also run on seeds 1000 to 1999 during the search, so that range is not clean either; the chosen setting won 577 of 1,000 there. Seeds 2000 to 3999 were run once, after the code was final. Three clashes of lookahead was worse than two in the search.

For `easy`, a first version that summoned the first troop it could and never cast won 26 of 1,000 on seeds 0 to 999, which seemed too weak to be worth playing. The shipped `easy` (no spells) won 129. Variants that kept some spells stayed within a few wins of `normal`, so they were not a distinct level.

## Checks

| Command | Result |
| --- | --- |
| `node --test tests/game/cpu.test.js` | 12 tests, 12 pass (8 before; the hidden-information test now runs once per level, and two tests are new) |
| `node scripts/verify-duel.mjs --browser` | 164 tests, 164 pass; both model files pass; 8 of 8 Chrome replay steps observed, 0 console errors |

- **`normal` is unchanged, move for move:** the test hashes every action of 200 CPU-against-CPU matches (seeds 0 to 199) and compares it with a value recorded on `main` at `c65f49e` before `cpu.js` was touched. `cpuFor("normal")`, and `cpuFor` of any unknown value, return the same `chooseAction` function.
- **Public view only:** the existing hidden-information test, which swaps the opponent's hand and both deck orders and expects the same decision at every point of 50 matches, now runs for `easy`, `normal` and `hard`.
- **Deterministic:** for `easy` and `hard`, 50 matches each are replayed and compared action by action.
