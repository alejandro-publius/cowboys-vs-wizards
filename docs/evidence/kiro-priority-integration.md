# Native Kiro priority integration (lanes 21, 22; 23 deferred)

Kiro (native Kiro CLI session, model `claude-opus-5.5`), 2026-11-22, 21:55–22:15 PST
(America/Los_Angeles). Branch `kiro/native-priority-integration`, base
`725f3220e835952647ee790b7fe997219abc1f88` (the passing release). Inputs:
`.artifacts/kiro-priority/inputs.json`. Local candidate only: nothing was pushed, deployed or merged.

## Handoff and inclusion decisions

| Lane | Worker SHA | Decision | Integrated as | Reason |
| --- | --- | --- | --- | --- |
| 21-saloon-live-witness | `f7347c0e12b4` | included | `dd0dc2857d72` | 3 paths: `src/ui/showdown-3d/night-shift-saloon.js` (live poll 1000 ms on a visible page only), new `scripts/browser-saloon-live-check.mjs`, its evidence note. Measured before and after with receipts. |
| 22-proof-scorecard | `359a6c6329c5` | included | `490818958597` | `scripts/scorecard.mjs` ingestion, 4 regression tests, `docs/SCORECARD.md`, its evidence note and a `Status:` line on 10 panel reviews (finding text and per-finding status unchanged). Measured base and head. |
| 23-shared-game-runtime | `0e7de8b` (worktree) | deferred | — | Its latest full run found replay-freshness and packaging failures. Left in its worktree, unmodified, including its uncommitted evidence edit. |

Both worker commits were cherry-picked with `-x`, one commit per worker, with the worker as author.
The Saloon worker's subject cited no requirement ID (goal.md requires one). The integrator reworded
only the message to cite `night-shift-saloon 3.3 3.4`, the live-transport clauses its check exercises.
The tree is byte-identical to a plain cherry-pick (`git diff` against the first pick was empty; that
pick is kept on local branch `backup/priority-integration-pre-reword`).

Neither lane touched `scripts/check-pages-tree.mjs`, so the Pages checker has no overlapping
assertion to merge. The release repair's favicon exemption (exact `<origin>/favicon.ico`, CDP type
`Other`), the Poker import-graph assertion and the Poker draw accounting are unchanged.

## Imported evidence validated

- **Saloon** (`docs/evidence/kiro-saloon-live-witness.md`), against the worker's ignored receipts in
  its worktree: tuned receipt sha256 `a7248b52…a300e5e0b`, `pass: true`, 13/13 checks, 0 exceptions,
  5 native samples, journal → visible 827, 646, 354, 615, 298 ms. **Five observed events, maximum
  827 ms**, on one machine, headless Chrome, one Kiro session; an estimate, not a general latency
  bound. Baseline receipt: 10/11, 4 samples, max 2818 ms. Both receipts name revision `e1e2d32` with
  a dirty tree. The dirty diff of `night-shift-saloon.js` hashes identically to the integrated diff.
  The live witness was not rerun here: it needs fresh native Kiro tool writes during the window.
- **Scorecard** (`docs/evidence/kiro-proof-scorecard.md`): the offline scorecard at the candidate
  reproduces the worker's head rows (shall 662, reviews 10 with 0 rejected, 3 of 14 pass), and trace
  reports 44 specs, 714 clauses, 2 proven, 712 orphan IDs, as the note states.

## Checks at the candidate `490818958597a5b5d21b3171f00471ea7780e3e3`

| Command | Result |
| --- | --- |
| `npm test` (once) | 966/966 pass, 0 fail; GLB structural 2/2. The `G1–G4 FAILED` lines in the log are planted-fault harness checks that passed. |
| `node scripts/stage-pages.mjs --commit 4908189…` | exit 0; build label `490818958597` (no `+local`); index.html sha256 `dbba81e5…3b047c17` |
| `node scripts/check-pages-tree.mjs --commit 4908189… --browser` | 11/11 pass; one exempt favicon probe (`http://127.0.0.1:<port>/favicon.ico`, 404, `Other`) |
| `npm run build` then `node scripts/browser-ledger-check.mjs dist/cowboys-vs-wizards-board-duel.html` | 12/12 pass (390 px and 1440 px) |
| `node scripts/build-sheriffs-ledger.mjs --check` | payload current |
| `node scripts/verify-poker-kit.mjs` | exit 0; seeds 1–500, 1000 games per arm, cowboy 500, wizard 500, draws 0, replayed |
| `npm run scorecard -- --offline` (evidence read) | 3 of 14 pass, exit 1; no line that passed at base fails |

The evidence-only commit that adds this note and the build-log entry changes no source or build
input. Its Pages tree was restaged at its own SHA and checked without `--browser`; see
`.artifacts/kiro-priority/verdict.json`. The browser checks above cover the same UI and build graph,
so they were not repeated.

## Pending

- Lane 23 (shared game runtime): replay freshness and packaging failures remain; integrate only after
  a full passing run.
- Saloon decisions for Fable, recorded by the worker and not chosen here: the file-create phase never
  shows on screen; the 2000 ms target has no approved source; the illustrated ambient line is clipped.
- Scorecard metric decisions for the user: aligning `TARGETS` with goal.md (the 10 reviews count 0
  under goal.md's GitHub rule); whether the 6 boundary SHALL lines count.
- Human and new-player checks: no person has watched the live Saloon or judged its clarity; no
  new-player playtest ran on this candidate; the hosted site was not checked (no deploy).
- goal.md human lines (submit, credits, category) are pending and were not scored by this session.
