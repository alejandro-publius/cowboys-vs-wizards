# K-011 Outrider decision gate: design

- `src/match/showdown-outrider.js` (pure): builds the Bone Fence duel for a case from `newSave()` after two Trail
  wins (offer cleared, in memory), as a `kind: "turn"` duel so the screen never settles or logs it. It reuses
  `duel.prefix`/`duel.at` in `createShowdownSession`, the same path as the Dragon turns in `showdown-turn.js`.
  `playArm` plays one arm and the continuation policy to the end and returns the outcome and event transcript.
- `scripts/outrider-gate.mjs`: loads `replay.json`, `results.json` and `policy.js`, replays both arms of each case,
  compares outcomes with `results.json` and transcript digests with `docs/evidence/outrider-gate/receipt.json`.
  `--check` exits 1 on any stale claim; `--write` writes the receipt only when every outcome matches.
  `verifiedForBuild` returns the setup fields of fresh cases, or `[]` on any problem.
- `scripts/build-graybox.mjs`: defines `__CVW_OUTRIDER__` from `verifiedForBuild` on every build, so the shipped
  list always comes from replaying the source being bundled. `--outrider-fixture <dir>` writes a test page under
  `.artifacts/outrider-fixture/` only.
- `src/ui/outrider-camp.js` + a few lines in `src/app.js`: one neutral button per verified case in the existing
  Camp Experiment section, and `?outrider=<id>` for verified ids only.
- `.kiro/hooks/check-outrider-gate.json` → `scripts/check-outrider-gate-hook.mjs` → `outrider-gate.mjs --check`,
  with a receipt line per native trigger.

Why replay rather than hashes: the claim is about game behaviour. A hash of the rule files changes on a comment edit
and can be refreshed by anyone; neither says whether the two lines still end as measured. Replaying is cheap
(milliseconds per arm) and needs no trust in the measurement's own checker.

Source references named by the coordinator (X-041 SpecGuard README Core Idea items 2-4, videos 55 and 24) were not
read in this session; the design above is derived from the repo's existing Ledger `--check`, the Dragon turn
allowlist (PRs 169/172) and the previous Outrider README.

## Repair (K-011 Ledger integration)
- `CURATED` in `scripts/outrider-gate.mjs` = `{camp: "case-e", compare: ["case-e", "case-a"]}`; only these ids are linked.
- `scripts/outrider-ledger.mjs` builds the Ledger section from the verdicts: `positions` (public boards from the replayed
  landing view) and `results` kept apart; `research` from the search's range files; `nightWatch` with engine identity
  (import closure of `prototypes/showdown/rules.js`, git blob ids at the receipt commit vs this tree).
- `build-graybox.mjs` defines `__CVW_OUTRIDER__` = `{cases, camp}` and `__CVW_OUTRIDER_LEDGER__`, and writes the build
  receipt to `.artifacts/outrider-ledger/` (never staged). `src/ui/outrider-ledger.js` renders it inside the Ledger.
- The Ledger section sits after the card table so the existing Ledger keyboard walk is unchanged.
