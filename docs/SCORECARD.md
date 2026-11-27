# Dec 4 Step 0 scorecard

`npm run scorecard` runs [`scripts/scorecard.mjs`](../scripts/scorecard.mjs). It prints one row per Step 0 target with the measured value, the target, PASS or FAIL and the reason. It exits 1 when any row fails. `--json` prints the same rows for CI, and `--offline` skips GitHub and the live site. Claude Code wrote the script, its tests and this page. On 2026-11-22 (America/Los_Angeles) a Kiro CLI session changed its SHALL and review parsing and ran the focused tests and `--offline` ([evidence](evidence/kiro-proof-scorecard.md)).

A row passes only on evidence measured during that run. Missing, malformed or unreachable evidence fails with a reason. A row that could not be measured says `unavailable` rather than showing a measured 0, and both fail. Requests run in parallel with 15 s caps, so a run stays well under 60 s. The focused check is `node --test tests/game/dec4-scorecard.test.js`.

## Targets and accepted evidence

| Row | Target (Step 0) | Counted |
| --- | --- | --- |
| `shall` | 4000 SHALL requirement lines | Numbered items carrying SHALL in `.kiro/specs/*/requirements.md`: list items with their wrapped lines, plus ID table rows. Identifiers include multi-part card IDs such as `CARD-COWBOY-BILLY-01:` and `**CARD-WIZARD-HEX-01.**`, which `scripts/trace.mjs` also indexes. Each needs three or more words besides SHALL and NOT. Repeated text counts once. The raw count of physical SHALL lines is printed for older receipts |
| `night-shift-prs` | ≥ 300 genuinely merged Night Shift PRs | `gh pr list --state merged --label night-shift`. A PR counts only if it has a merge commit and its body cites the full `bundleSha256` of an intact Night Shift review bundle checked in under `docs/evidence/`. Each seal backs one PR. The PR author comes from GitHub. Commit authors and Co-Authored-By trailers come from local git for the merged commits, and are left empty when the merge commit is not in the clone |
| `reviews` | ≥ 100 written `.kiro/specs/*/*-review.md` | A `Status:` line naming an outcome (approved, accepted, answered, changes requested, rejected, blocked, open, resolved, fixed, pass, fail), plus at least one finding of five or more words: a list item under a Findings heading, or an identified finding heading such as `## E1. Draws shrink the measured first-seat skew`. A review whose status approves (approved, accepted, resolved, fixed, pass) while one of its identified findings records `**Status:** open` is rejected. Identical findings count once. The count is of written reviews, not approvals |
| `duels` | 10 million duels across real deduplicated reports | `reports/balance/*.json` (`cvw-balance-report/1`, below) and, for compatibility, the checked-in `night-watch-receipt/1`. Only shippable samples count: the commit is behind HEAD. A duel is identified by its engine, bot, decks, games per deal and seed, where engine means the `src/game/showdown` tree plus the card-spec blob at that commit. Cumulative, duplicated or overlapping reports therefore count once, and so does a baseline that equals its candidate |
| `card-band` | Every current card's latest win rate 45–55%, absent = unknown | All cards in the card catalog. Each uses wins/games from the newest shippable report that measured it, and a card no report measured is unknown. Faction shares are not used |
| `properties` | ≥ 100 distinct passing fast-check properties from receipts | `reports/properties/latest.json` (`cvw-property-receipt/1`, below): entries with status `passed`, at least one run and a test file that imports fast-check, once per id. A fresh passing release-gate stamp counts the properties it names (G1–G4). Property names found in test files never count |
| `hooks` | ≥ 8 distinct supported triggers in `.kiro/hooks`, Saloon enabled | Enabled hooks in Kiro CLI v1 files and IDE `*.kiro.hook` files whose trigger is an automatic trigger known to `scripts/saloon-activity.mjs` and whose command script exists. The Saloon counts as enabled when `night-shift-activity.json` runs `scripts/saloon-activity.mjs`. The nine listed triggers are printed one per line with their CLI and IDE files |
| `agents` | ≥ 8 active agents restricted to their own write paths | An agent with a write tool, an `fs_write` allow list of fixed paths, and a shell that is either denied or limited to named commands. No other counted agent may share its paths, and a tracked workflow or script must name it. Read-only roles are listed, not counted |
| `frontier-kit` | Live second game imports `packages/frontier-kit`, no cross-game imports | The kit exists and Boot Hill Poker (`experiments/boot-hill-poker`, staged at `/poker/`) imports it. Neither game imports the other, and the kit imports neither game. The deployed `/poker/` page or its `app.js` references the kit |
| `submission-*` | Submission basics | The licence and `.kiro/` results come from `scripts/contest-submission-check.mjs`. The tracked GitHub Pages URL must answer. A tracked YouTube URL must exist, and its watch page must show a length under 180 s. The category must be named in `docs/submission/devpost-packet.md` |

### Report contracts

`reports/balance/<name>.json`:

```json
{"schema": "cvw-balance-report/1", "ruleset": "showdown", "commit": "<40-hex commit the games ran on>",
 "bot": "<both seats' policy>", "decks": "<matchup id>", "seeds": {"from": 0, "to": 999, "gamesPerDeal": 2},
 "games": 2000, "results": {"cowboy": 1000, "wizard": 990, "draw": 10}, "generatedAt": "<ISO time>",
 "cards": {"<catalog type>": {"games": 400, "wins": 200}}}
```

`games` must equal `(to - from + 1) × gamesPerDeal`, and the results must sum to `games`. `cards` is optional. A report with only a total is rejected.

Generate `reports/properties/latest.json` from a clean checkout with `node scripts/run-dec4-property-suite.mjs`. To record only the 20 rulebook properties, use a separate output path with `node scripts/showdown-dec4-properties.mjs --report <file>`.

```json
{"schema": "cvw-property-receipt/1", "commit": "<40-hex commit tested>", "generatedAt": "<ISO time>",
 "properties": [{"id": "SP-1", "file": "tests/game/<name>.test.js", "status": "passed", "numRuns": 100, "seed": 1}]}
```

## Known limits

- `shall` and `scripts/trace.mjs` still differ on two forms. A requirement heading with no numbered criteria (`deck-builder-readability` `### R5 Desktop layout`) is one trace clause the scorecard does not count. Five numbered SHALL items at `orb-duel/requirements.md` lines 240–244 are counted here, while trace reports them as `unidentified-normative`. Whether either form counts is a metric decision that has not been made.
- The rows follow the Step 0 targets in this script. `.kiro/steering/goal.md` scores some lines differently: `reviews` there means GitHub reviews of a named head SHA by someone other than the PR author, `scoping` needs an observed native trigger for each hook and agent, `card-band` has no numbers until an approved requirement sets them, and `second-game` uses `src/review/paired-duel-kit.js`. The targets here are unchanged; [the proof-scorecard note](evidence/kiro-proof-scorecard.md) lists each difference.
- Balance totals are cross-checked but not recomputed from per-game outcomes. Once a balance lane writes outcome files, the contract should require one.
- The Step 0 text says "all 9 listed by user" without naming them. The scorecard prints the nine automatic Kiro IDE triggers. Replace `LISTED_TRIGGERS` if the user's list differs.
- The second game is fixed to the Boot Hill Poker copy staged by `scripts/stage-pages.mjs`.
- An agent counts as active only if a tracked workflow or script names it. Configs started by hand do not count.
- The video length comes from the YouTube watch page, and the row fails as unavailable when the page shows none.

## Stop hook

[`.kiro/hooks/dec4-scorecard.json`](../.kiro/hooks/dec4-scorecard.json) runs `node scripts/scorecard.mjs --log` at Stop. The hook appends one timestamped line below, always exits 0, and writes nothing when re-entered (`SCORECARD_ACTIVE` or `stop_hook_active`). The existing hooks and the release gate's Stop hook are unchanged. Each line says whether the run received a Stop hook event. No line written from a Kiro Stop has been observed yet.

## Log
- 2026-11-23T04:12:47.638Z `e1e2d32` no hook event: 4/14 pass; failing: shall 219, night-shift-prs 0, reviews 0, duels 2000, card-band 0/29, properties 0, agents 5, frontier-kit no, submission-video none, submission-category OWNER (0.9 s)
- 2026-11-23T05:33:32.804Z `e1e2d32` Stop hook event: 4/14 pass; failing: shall 219, night-shift-prs 0, reviews 0, duels 2000, card-band 0/29, properties 20, agents 5, frontier-kit no, submission-video none, submission-category OWNER (0.8 s)
