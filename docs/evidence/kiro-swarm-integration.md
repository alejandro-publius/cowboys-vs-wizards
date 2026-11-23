# Kiro swarm integration (job 14)

Date: 2026-11-22, about 21:30 PST (America/Los_Angeles). Worker: native Kiro CLI integration worker, worktree
`trees/14-swarm-integration`, base `e1e2d325958b82c5f99e54c4831484901d994508`. Nothing was committed, pushed,
merged or deployed. Kiro jobs 16 and 17 own the Ledger browser rerun and the 1000-duel canary, so this job did not run them.

## Import

Command: `python3 .artifacts/kiro-swarm/import-deliverables.py`. It exited 0 and printed:

```
Imported 125 scoped paths from agent worktrees.
```

The manifest (`.artifacts/kiro-swarm/manifest.json`) lists 125 files with sha256 hashes and an empty `deferred` map.
Only four tracked files changed against HEAD: `package.json`, `scripts/browser-ledger-check.mjs`,
`scripts/verify-poker-kit.mjs` and `src/review/paired-duel-kit.js`. Every other imported path is new.

### Imported paths by source

Claude Code authored these before the transition (manifest `authorship: "Claude Code (historical)"`). Kiro ran them here.

| Lane | Paths |
| --- | --- |
| scorecard | `.kiro/hooks/dec4-scorecard.json`, `docs/SCORECARD.md`, `package.json` (adds `"scorecard"` script), `scripts/scorecard.mjs`, `tests/game/dec4-scorecard.test.js` |
| trace | `docs/evidence/dec4-trace.md`, `scripts/trace.mjs`, `tests/game/dec4-trace.test.js` |
| steering | `.kiro/steering/goal.md`, `tests/game/dec4-steering.test.js` |

Kiro CLI authored these. Lane 07's script is marked "Kiro CLI (continued Claude draft)".

| Lane | Paths |
| --- | --- |
| 03-saloon-lifecycle | `docs/evidence/native-saloon-lifecycle.md` |
| 04-forge-failures | `docs/evidence/kiro-forge-refusals.md`, `tests/match/card-forge-rejections.test.js` |
| 05-ruling-audit | `docs/evidence/kiro-native-sheriff-replay-audit.md` |
| 07-claude-properties | `reports/properties/latest.json`, `scripts/showdown-dec4-properties.mjs`, `tests/game/dec4-showdown-properties.test.js` |
| 08-claude-cowboy-specs | `.kiro/specs/card-cowboy-{bear-trap,billy,captured-dragon,captured-wraith,covered-wagon,deadeye,dynamiter,gatling-crew,lasso,mounted-billy,outrider,ranger,sheriff,sheriffs-office,six-shooter}/{requirements,design,tasks}.md` (45 files) |
| 09-ledger-browser | `docs/evidence/kiro-ledger-browser-repair.md`, `scripts/browser-ledger-check.mjs` |
| 10-wizard-specs | `.kiro/specs/card-wizard-{bone-armor,bone-wall,boneyard,dragon,headless-horseman,hellfire,hex,imp,jack-o-lantern,lantern-wraith,raven-familiar,singularity,skeleton,wizard}/{requirements,design,tasks}.md` (42 files) |
| 11-balance-receipts | `docs/evidence/dec4-balance-method.md`, `scripts/balance-evidence.mjs`, `tests/game/dec4-balance-evidence.test.js` |
| 12-expert-reviews | 10 `*-review.md` files under `.kiro/specs/night-shift-balance-contract/`, `.kiro/specs/night-shift-repair/` and `.kiro/specs/night-shift-saloon/` |
| 13-frontier-kit | `packages/frontier-kit/{README.md,index.js,paired-cohort.js}`, `scripts/verify-poker-kit.mjs`, `src/review/paired-duel-kit.js` (now a re-export), `tests/game/dec4-frontier-kit.test.js` |

### Excluded or missing lanes

- Lanes 01, 02 and 06 have no entries in the manifest, and `deferred` is empty. This job did not find out why they are missing.
- Lane 09 (Ledger browser) was imported, but `scripts/browser-ledger-check.mjs` was not run here. Job 16 owns that rerun, so the earlier Ledger browser failure is still unresolved in this job.

## Integration correction

**Problem:** the first full `npm test` failed 2 of 962 tests in `tests/game/field-trial-repair.test.js`:
- "the witness refuses a confirm record whose declared protocol differs from the current one"
- "the witness reads the confirm record's actual base and reproduces from it"

Both failed with `ERR_MODULE_NOT_FOUND .../witness-*/packages/frontier-kit/index.js imported from .../src/review/paired-duel-kit.js`.

**Cause:** lane 13 changed `src/review/paired-duel-kit.js` into a re-export of `packages/frontier-kit/`. The test's
`witnessSandbox()` copied only `scripts/` and `src/` into its throwaway root, so the import target was missing.

**Fix:** `tests/game/field-trial-repair.test.js` now copies `packages/` into the sandbox too. This is a one-line,
test-only change. No assertion, engine file or evidence rule changed.

## Checks run (actual results)

| # | Command | Result |
| --- | --- | --- |
| 1 | `node --test tests/game/dec4-scorecard.test.js tests/game/dec4-trace.test.js tests/game/dec4-steering.test.js tests/game/dec4-showdown-properties.test.js tests/game/dec4-balance-evidence.test.js tests/game/dec4-frontier-kit.test.js tests/match/card-forge-rejections.test.js` | 60/60 pass, exit 0 |
| 2 | `npm test` (first run) | 960/962 pass, 2 fail (above), exit 1 |
| 3 | `node --test tests/game/field-trial-repair.test.js` (after fix) | 10/10 pass |
| 4 | `npm test` (rerun) | 962/962 pass; GLB structural check 2/2 pass; exit 0 |
| 5 | `node scripts/stage-pages.mjs --commit e1e2d325958b82c5f99e54c4831484901d994508` | exit 0; staged `/`, `/3d/`, `/graybox/`, `/showdown/`, `/poker/`; index.html sha256 `5325eb60f411db22aba6d8505c5fbc5910c5d24d8db307a0d58729cfe8a6b968`; build label `e1e2d325958b+local` (uncommitted tree) |
| 6 | `node scripts/check-pages-tree.mjs --commit e1e2d325958b82c5f99e54c4831484901d994508` | 4/4 checks pass; report `.artifacts/pages-tree/pages-tree.json` |
| 7 | `node scripts/scorecard.mjs --offline` | 3 of 14 pass, exit 1 (terminal FAIL) |
| 8 | `node scripts/trace.mjs` | 714 clauses, 2 proven, 712 orphan IDs, exit 1 (terminal FAIL) |

The `--browser` variant of the Pages check was not run and is pending.

### Scorecard (offline, HEAD e1e2d32)

| Line | Value | Target | Result |
| --- | --- | --- | --- |
| shall | 219 | >= 4000 | FAIL |
| night-shift-prs | unavailable (offline) | >= 300 | FAIL |
| reviews | 0 (10 files, all rejected: "no Status: line") | >= 100 | FAIL |
| duels | 2000 deduplicated (4000 claimed, 2000 overlapping) | >= 10,000,000 | FAIL |
| card-band | 0/29 (29 unknown) | 29/29 | FAIL |
| properties | 20 (release-gate stamp stale, not counted) | >= 100 | FAIL |
| hooks | 14 | >= 8 + Saloon | PASS |
| agents | 5 (5 more protected but never invoked) | >= 8 | FAIL |
| frontier-kit | no: `experiments/boot-hill-poker does not import packages/frontier-kit` | yes | FAIL |
| submission-licence | yes (MIT) | yes | PASS |
| submission-kiro | yes | yes | PASS |
| submission-site | unavailable (offline) | HTTP 200 | FAIL |
| submission-video | none | < 180 s | FAIL |
| submission-category | "OWNER" | a category | FAIL |

### Trace

The trace found 44 specs and 714 clauses. Only NSB-1 and NSB-2 are proven by a named test. All 712 other IDs are orphans,
including every `CARD-*` ID in the 29 imported card specs. It reported 0 duplicate IDs, 6 unsupported-syntax lines in
`.kiro/specs/orb-duel/requirements.md:227-244`, and 3 unqualified test references:
`tests/game/showdown-fast-check.test.js:24,30` (G1) and `tests/match/sheriffs-ledger.test.js:52` (R1.1).

## Source disagreements found (not changed; need review)

1. **Steering lines differ from the scorecard script.** `.kiro/steering/goal.md` lists submit, credits, category,
   loop-prs, reviews, duels, card-band, properties, scoping and second-game. `scripts/scorecard.mjs` scores shall,
   night-shift-prs, hooks, agents, frontier-kit and submission-* instead, and has no submit, credits, loop-prs or
   scoping line. `tests/game/dec4-steering.test.js` passes anyway, so it does not check against the script's output.
   Per goal.md, only the user changes a target, so this is left for the user.
2. **Card-band rule differs between files.** goal.md says the per-card band "stay[s] unset until an approved spec
   requirement sets them" and that NSB-1 is a faction band. `scripts/scorecard.mjs` applies a hard-coded 45-55%
   per-card band. The script does keep per-card wins separate from faction shares, and the balance-evidence test
   confirms that. The band number itself has no approved requirement behind it.
3. **Second-game scoring differs.** goal.md scores the second game on the deployed `build.json` commit and
   `scripts/verify-poker-kit.mjs`. The script instead requires the Poker engine itself to import the kit. After the
   import, only `scripts/verify-poker-kit.mjs` imports `packages/frontier-kit/index.js`; the shipped `/poker/` graph
   does not. `check-pages-tree` confirms the staged `/poker/` runtime imports resolve, which is a narrower claim.
4. **Lane 12 reviews do not meet the scorecard format.** All 10 imported reviews lack a `Status:` line, so they count 0.
5. **Imported card specs are untested.** The 29 card specs (lanes 08 and 10) add requirement IDs, but no test cites any
   of them. Before a commit cites them, each still needs Fable or user approval (issue 143) under goal.md.

## Release blockers

- Human gate in `docs/design/release-line.md`: unchanged, pending.
- Ledger browser failure: unresolved here; job 16 owns the rerun.
- 1000-duel canary: not run here; job 17 owns it.
- Submission lines: category is still "OWNER", there is no demo video URL, and the site was not checked online. All are human or online steps.
- The staged build is labelled `+local` because the tree has uncommitted changes. A deploy needs a committed tree.

## Still pending or needing review

- `tests/game/field-trial-repair.test.js` (this job's fix)
- `src/review/paired-duel-kit.js` and `packages/frontier-kit/` (moved shared kit)
- `scripts/browser-ledger-check.mjs` (not run here)
- `.kiro/steering/goal.md` vs `scripts/scorecard.mjs` and `docs/SCORECARD.md` (disagreements 1-3)
- The 10 lane 12 review files (missing `Status:`)
- The 87 card spec files (no approval, no tests)
- `docs/kiro-build-log.md` was not updated. The coordinator owns that log.
- The `--browser` Pages check
