# Kiro candidate deck screen

Kiro CLI added candidate deck input, validation, match results and regression tests.
Codex reviewed it, added the seed-range option from Fable’s Frontier brief, and ran the checks below.

Compare a deck-count JSON file with the starter on both first seats against the
Normal and Hard bots. Each row includes wins, losses, draws, mean rounds, and
the observed and exact chance of opening without a free troop.

```sh
node scripts/screen-cowboy-decks.mjs --candidate /path/to/deck.json --from 72000 --count 1000
node --test tests/game/screen-cowboy-decks.test.js tests/game/deck-builder.test.js
```

All 10 focused tests passed. Passing the starter as the candidate produced
identical results on both difficulties. Default and `--isolate` output
matched the SHA-256 hashes of their output at `91c7d7a`.

Deadeye Control also ran successfully on seeds 72000 through 72999. Each row
ran 2,000 matches. On Normal, the starter won 891 and Deadeye Control won
1,158. On Hard, the starter won 917 and Deadeye Control won 1,159.
All four rows had 3.03% exact odds of opening without a free troop.
