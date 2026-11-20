# Night Shift review: Night Watch finding to one reviewed candidate

Worker: Kiro CLI, job `night-review`, branch `kiro/graywave-night-review`, November 19, 2026 (America/Los_Angeles).
Surface: **local CLI only.** No Kiro Web session, Crew schedule or GitHub App ran any of this. Each bundle records `surface.kind: "local-cli"`, and `verify` fails a bundle that claims any other surface.

Nothing here changes a card, rule, reward or bot. The candidates below are drafts in temporary snapshots. Fable and Alex decide whether any of them goes further.

## The loop

`scripts/night-review.mjs` (tests: `tests/assets/night-review.test.mjs`) and the Kiro workflow `.kiro/workflows/night-shift-review.workflow.json` run the same three stages.

1. **draft**: reads one Night Watch Showdown report (the `balance.py` report schema as stored in `docs/evidence/night-watch-showdown/scout-pair-reports.json`). It refuses a report whose counts do not add up, whose rule tests did not pass, whose commit is not in the repository, or that is not Showdown mode. It then writes one proposal: one card from the Showdown even-match decks, one of `attack`, `health` or `stars`, one whole number. This reuses the Summoning Circle's one-field edit rule. The output is `proposal.json` plus a one-line `candidate.patch`, both hashed. Nothing in the checkout is edited.
2. **review**: works on two `git archive` snapshots of the base commit. It does the following:
   - Reproduces the finding with Night Watch's own runner (`apps/night-watch/backend/showdown_sim.mjs`) at the finding's commit, and checks that the counts still hold at the base.
   - Applies the patch, regenerates the card specs (`scripts/sync-card-specs.mjs` validates them) and regenerates the planted-fault receipt.
   - Runs the generated Showdown properties (`tests/game/showdown-properties.test.js`) and `showdown-fair-bot.test.js` on both snapshots.
   - Plays the finding's seeds (tune) and the next disjoint range (holdout) from both seats with the level-2 bot. It keeps every game so the two sides can be paired.

   A candidate is accepted only if all of these hold:
   - The finding reproduced.
   - Both property runs passed.
   - The faction skew `|Cowboy share − 50|` fell on both tune and holdout.
   - At least one game changed.
   - First-seat skew did not grow by more than 1 pp.

   "Accepted" means "ready for Fable/Alex review". These thresholds are review policy, not balance. They are stored in every bundle.
3. **verify**: checks the following:
   - The bundle seal.
   - The proposal, patch, finding and game-record hashes.
   - The source commit and tree.
   - Rebuilt baseline and candidate source and esbuild engine-bundle hashes.
   - The decision, recomputed from the stored games.

   With `--rerun` it also replays every game and compares hashes.

Exit codes: 0 accepted or verified, 1 rejected or verification failed, 2 refused input.

## Dry run (observed, tool commit `2417d71`)

Finding: report `fa15c87e1701` (Showdown, seeds 0–999, 2,000 games at `3dd47f1`, Cowboy share 59.40%). The finding file's sha256 starts `d2e06908`. Base: `2417d71` (main `4d52642` plus this tool). The Showdown engine and cards are identical to main. Holdout: seeds 1000–1999. Full output: [night-shift-review/dry-run.txt](night-shift-review/dry-run.txt).

| Candidate | Properties (cand.) | Tune Cowboy share | Holdout Cowboy share | Verdict |
| --- | --- | --- | --- | --- |
| Sheriff health 3 → 2 | 21/21 | 59.40% → 52.90% | 61.05% → 54.65% | accepted for review |
| Sheriff health 3 → 4 | 21/21 | 59.40% → 63.60% | 61.05% → 65.30% | rejected: skew worse on both |
| Sheriff health 3 → 6 | spec validation failed (`health must be an integer from 1 to 5`) | not played | not played | rejected |
| Health 3 → 2 with a forged finding (Cowboy/Wizard counts edited to 1100/900, still summing correctly) | 21/21 | 59.40% → 52.90% | (1000–1199) | rejected: finding did not reproduce |

For the accepted candidate:

- First-seat share: 57.10% → 55.90% (tune) and 58.25% → 57.35% (holdout).
- Paired flips: 156 toward Wizard and 26 toward Cowboy of 2,000 on tune; 167 and 39 on holdout.
- `verify --rerun` replayed all 8,000 games with identical hashes (exit 0).
- Its advisory `prototypes/showdown/rules.test.js` run (not counted in the verdict) fails 5 of 27 tests. Three are hand-written examples that assume Sheriff's current orbs. Two compare generated docs (`cards.csv`, `ART-DIRECTION.md`) that print the stat.

  A real change would have to update those. That is a Fable decision. The bundle lists the failing test names.

Rejected-input checks, observed:

- Inconsistent counts are refused (exit 2).
- An unknown commit is refused.
- A missing file is refused.
- An ambiguous file without `--report` is refused.
- A card outside the even-match decks (`cowboy-gatling-crew`) is refused.
- A non-stat field (`copies`) is refused.

Tamper checks, observed:

- Flipping one stored holdout game makes `verify` fail on the hash and on the summary.
- Rewriting a rejected bundle's verdict to accepted fails the seal and the recomputed decision.

These estimates hold only for these seeds, this bot (level 2 in both seats) and these rules. No human played.

Bundles are in [night-shift-review/](night-shift-review/). Each folder holds `proposal.json`, `bundle.json` and `candidate.patch`. The per-game records are about 140 KB each and stay in `.artifacts/` (ignored). Running `review` again on the same commit regenerates them, and `bundle.results` holds their hashes.

## Not verified

- The Kiro workflow file parses, but it was not launched in this session. Only the local CLI ran.
- Integration status is unverified:
  - `gh api user/installations` returned 403, because an OAuth token cannot list GitHub App installations.
  - The repository has no webhooks.
  - The only check-run app on HEAD is `github-actions`.
  - No Kiro Web connection was observed.
- No path that breaks one of the seven properties was found with a real one-number candidate. The rejection path is covered by the unit test and by the spec-validation case above.
- The Night Watch meter schema came from the stored report only. The meter and ledger workers had published no schema or Ledger contract when this was written.
