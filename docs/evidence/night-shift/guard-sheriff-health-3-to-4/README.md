# Verify the Sheriff health rejection

Night Shift rejected the staged Sheriff health change from 3 to 4 on source revision `e813ae8`. The four game records here were regenerated from that revision and its one-card patch. All four SHA-256 sums match the original sealed bundle.

From a checkout with Git history and Node 22 or later:

```sh
npm ci
node scripts/night-review.mjs verify \
  --bundle docs/evidence/night-shift/guard-sheriff-health-3-to-4 \
  --finding docs/evidence/night-shift-native-showdown/staged-finding.json \
  --rerun
```

The original finding file lived in a temporary directory. The command checks the documented reconstruction against the report ID, source revision, seed range, and counts in the sealed proposal, then replays it. It also replays all 8,000 games in the bundle and recomputes the verdict. The original bundle and its seal record the historical run.

| Seeds | Baseline Cowboy wins | Sheriff at 4 orbs |
| --- | ---: | ---: |
| 0–999 | 1,188 / 2,000 (59.40%) | 1,272 / 2,000 (63.60%) |
| 1000–1999 | 1,221 / 2,000 (61.05%) | 1,306 / 2,000 (65.30%) |

These results describe the recorded level-2 bots and decks. The game did not adopt the proposal.
