# Dec 4 Step 3: balance evidence method

Worker: native Kiro CLI agent (lane `11-balance-receipts`). This note covers
[`scripts/balance-evidence.mjs`](../../scripts/balance-evidence.mjs) and
[`tests/game/dec4-balance-evidence.test.js`](../../tests/game/dec4-balance-evidence.test.js).
The receipt format is `cvw-balance-report/1` from the staged [`docs/SCORECARD.md`](../SCORECARD.md).
`scripts/scorecard.mjs` is not in this checkout, so the receipt was checked against the SCORECARD text,
not against the scorecard script.

## Status

- Verified: `node --test tests/game/dec4-balance-evidence.test.js` passed 7 of 7 tests, twice, in this
  worktree (about 0.5 s each run). The tests play 2 to 6 real deals through the working-tree engine.
- Pending: the canary receipt. The shell permission layer refused `node scripts/balance-evidence.mjs run
  --from 0 --deals 500` and every `git` command in this session, so `reports/balance/` holds no receipt.
  No counts, win rates or timings from a canary exist yet, and none are claimed here.
- Not decided: which per-card metric the user's 45–55% target means (see below). This goes to Fable and the user.

## What one run does

```sh
node scripts/balance-evidence.mjs run --from 0 --deals 500          # canary: 1000 duels on HEAD
node scripts/balance-evidence.mjs verify --rerun all                # check every reports/balance/*.json
```

1. `git archive <commit> src/game` goes into a temporary directory, with a `{"type":"module"}` package file.
   The run imports that snapshot's `src/game/showdown/rules.js` and `cards.js`, so uncommitted edits in the
   checkout never reach a receipt.
2. Each deal seed is played twice, Cowboy first and then Wizard first, with `playTurn` level 2 for both seats.
   This is the loop of `apps/night-watch/backend/showdown_sim.mjs`, using the default even-match `DECKS`.
3. The receipt is written to `reports/balance/showdown-<commit12>-s<from>-<to>.json` and is never overwritten.
   One run is capped at 5000 deals (10 000 duels).

No model, network or Kiro call is made per game. A duel costs only local CPU.

## Receipt fields beyond the SCORECARD minimum

| Field | Meaning |
| --- | --- |
| `engine.tree`, `engine.specBlob` | git ids of `src/game/showdown` and `src/game/card-specs.generated.js` at `commit` (the SCORECARD duel identity) |
| `engine.decksSha256` | sha256 of the snapshot's canonical `DECKS` |
| `runner` | this script's path, sha256 and Node version, and whether the script is committed unchanged at `commit` |
| `outcomes`, `outcomesSha256` | one letter per game (`c`, `w`, `d`); game `2k` is deal `from+k` with Cowboy first, game `2k+1` Wizard first |
| `seats`, `byStartingSide`, `reasons` | first/second-seat wins, results by starting side, ending conditions (`base`, `turn-cap`) |
| `perCard` | per catalog type: its side, plus `{games, wins, draws}` for `inDeck`, `drawn` and `played` |
| `coverage` | catalog size, types measured at each level, and `missing` (never in a deck: unknown) |
| `elapsedMs` | wall time of the games on that machine (not part of identity) |

Per-card levels, always from the card owner's side:

- `inDeck`: the side's deck holds a copy. With fixed decks this is every game, and its wins equal the faction's
  wins. **It is the faction rate, not an estimate for the card.** The verifier rejects a receipt where they differ.
- `drawn`: a copy reached its owner's hand (opening hand, turn draw, Scout). A burned draw does not count.
- `played`: a copy left the hand by its owner's action (summon, spell, gear, location, set trap).

`drawn` and `played` are conditional rates. Long games draw more cards. The bot plays a card when it is already
ahead, or holds it when behind. These choices bias both rates in either direction, so neither rate is the
card's causal effect on winning. Cards outside the even-match decks (gear, locations, bounty troops and other
earned cards) have zero denominators and are reported as `missing`, never as 0% or 50%.

The SCORECARD `cards` field is left out on purpose. Filling it with in-deck counts would show the faction rate as
29 card rates, and filling it with drawn or played counts would choose a target metric that nobody has decided.
With `cards` absent, the `card-band` row stays "unknown" for every card, which is the honest result.

## Verification

`verify` checks each receipt and fails closed:

- schema, ruleset, a 40-hex commit, bot, decks, time, seed range, `games = (to - from + 1) x 2`, and results that sum to games;
- totals-only receipts are rejected. Results, seats and starting-side splits are recomputed from `outcomes`, and `outcomesSha256` must match;
- per-card counts must be whole numbers with `played <= drawn <= inDeck` (games and wins), no card above its faction's wins, and `coverage` recomputed;
- provenance: the commit is in the clone, and `engine.tree` and `engine.specBlob` equal git's ids at that commit. Only receipts whose commit is behind (or at) HEAD are counted;
- `--rerun <deals>|all` replays from a fresh snapshot of the receipt's commit. `all` also compares `perCard` and `reasons`.
  This catches a receipt that is self-consistent but not what the engine plays (tested by moving a real deal to another seed).

Then receipts are grouped by duel identity: engine tree, spec blob, decks hash, bot, decks and games per deal.
Within a group:

- duels count once over the union of seed ranges. Repeated, cumulative and overlapping receipts, and a baseline
  whose engine equals its candidate, add nothing;
- overlapping receipts must agree game by game, or the verifier reports a conflict (a determinism or fabrication signal);
- faction totals and Wilson 95% intervals come from the union of outcomes;
- per-card totals come only from receipts whose seeds overlap none already used, because per-card counts are not
  stored per game. Left-out receipts are named, and the per-card denominator is printed separately from the faction denominator.

No receipt means "0 duels, every card unknown", and the command exits 1. No card-band PASS is ever printed.

Historical evidence is read-only. Night Watch receipts (`night-watch-receipt/1`, `docs/evidence/night-shift/`) and
scout reports are not read, rewritten or merged by this script. The scorecard counts them for compatibility on its own.

## Scaling to 10 million duels

10M duels are 5M deals. They are written as disjoint shards, for example 1000 receipts of 5000 deals each
(`--from 0`, `--from 5000`, ...). Shards can run in parallel processes or on several machines, since every
receipt names its commit and engine ids. Per-game outcomes take one byte each, about 10 MB in total. The
verifier joins shards in one pass per group, and only `--rerun` costs engine time. A spot check (`--rerun 20`)
is enough for routine checks. Throughput has not been measured. The canary's `elapsedMs` will give the first figure.

Per-card evidence that can judge a 45–55% band needs more than more games of the same matchup. With fixed decks,
every in-deck card shares one number. A per-card estimate needs varied decks (such as random legal decks, or one
card swapped against a control), with the card's presence recorded per game. That is a design and engine-policy
choice for Fable, together with the choice of metric.

## Known gaps

- No canary receipt yet (blocked by shell permissions, above). Next step: run the canary command, then `verify --rerun all`, and record both outputs.
- The checks follow the SCORECARD text. `scripts/scorecard.mjs` was not available to confirm that it accepts the extra fields.
- Per-card counts are aggregate per receipt, so partially overlapping receipts are left out of per-card totals rather than split.
- Games within a deal share a shuffle, so treating games as independent for Wilson intervals is an approximation.
- `docs/kiro-build-log.md` is outside this lane's write scope. The integration worker should add this lane's entry.
