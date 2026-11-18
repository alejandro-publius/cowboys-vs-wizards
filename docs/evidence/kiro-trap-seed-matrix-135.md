# Kiro evidence: T1 six-seed browser-to-engine parity matrix (issue #135)

Date: 2026-11-17 (America/Los_Angeles). Worker: Kiro CLI 3.4.0 V3 with explicit `--model claude-opus-5.5` request; streamed session `sess_787a5ba0-6e2b-47c6-838a-62832749d17c` emitted **8.225163944941956 Kiro credits**, independently read by the coordinator. Model selection does not independently prove backend-model identity or account-wide usage. Base: origin/main `9a4aa178afd0c46dacf514410b5565881745c266` (#134 merged). Worktree `.worktrees/kiro-trap-seed-matrix-135`; at Kiro handoff the worker made one local commit and left publishing and integration to the coordinator.

## Problem

The #131/#132 real-Chrome parity harness ran seeds 0 and 60. Issue #135 asks for a repeatable developer-only run of the six T1 seeds from the #120 playtest kit ([kiro-trap-playtest-kit-120.md](kiro-trap-playtest-kit-120.md), [seed-plan.md](../../experiments/trap-playtest-kit/seed-plan.md)): 55, 9, 2, 23, 7, 43 (categories A to F). The report has to separate an actual Chrome pass or failure from a late trap opportunity that only exists if the match lasts long enough.

## Change

Owned files only:

- [scripts/browser-trap-parity-131.mjs](../../scripts/browser-trap-parity-131.mjs)
  - `--seed-kit t1` preset: a named list `SEED_KITS.t1` that feeds the existing `--seeds` path. No second run loop. `--seed-kit` and `--seeds` are exclusive. The default stays `--seeds 0,60`. No other flag is on by default.
  - Each seed now passes or fails on its own. A thrown error is recorded as `{ seed, failure }` and the next seed still runs. The receipt adds `seeds`, `seedKit` and `chromeResults` (`pass`/`fail` per seed). `failure` keeps its old meaning (first failure or `null`). Overall `pass` still requires every seed clean, 0 console errors and 0 non-loopback requests.
  - Each run adds `trapOpportunity`. `scheduledRound` comes from the kit's `layoutOf(seed)` and `roundForPosition` (imported, not copied). `firstSeenRound` is the first stable point whose public Cowboy hand held the trap. `outcome` is one of `set`, `drawn-not-set`, `not-reached` (match ended before the scheduled round; labelled "conditional") or `not-drawn`.
  - A 180 s wall-clock bound per seed, next to the existing 150-input bound.
  - The checks themselves are unchanged: stable points, DOM fields, Node mirror, `publicState` and redaction.
- [tests/match/trap-dom-parity.test.js](../../tests/match/trap-dom-parity.test.js): three new Node tests.
  - The preset equals `pickSeeds()` from the kit, and argument errors are refused.
  - `trapOpportunity` classifies all four cases.
  - For each kit seed, the mirror is deterministic across two plays and compares clean at every stable point. Each seed's result, rounds, trap outcome and trap set/trigger counts per side are pinned to fixed values. These are regression values for this fixed policy, not balance results.

No change to `src/`, the lab, cards, decks, copy counts, 3D, art, audio, animation, packages or other docs. Fixtures stay the anonymous `test-fixture-deck-trap-*` IDs.

## Real Chrome run, `--seed-kit t1` (this session)

`node scripts/browser-trap-parity-131.mjs --seed-kit t1 --out <tmp>/r135.json`. The run used Chrome/157.0.8103.79 headless, Node v26.0.0, darwin 24.1.0 arm64, and lasted 154.2 s (exit 0). It served from 127.0.0.1 only with the host resolver mapping every other host to NOTFOUND. Result: `pass: true`, 0 mismatches, 0 known findings, 0 console errors, 0 remote requests. Digest `b2e02300b590f203e379b7a4b0bfe6aae1b8cd2f31223eee3fc24e853849f15a`. HEAD was 9a4aa17 with the uncommitted script/test change (`dirtyTracked: true`). The lab files were unchanged. The page read paused at `experiments/trap-placeholder/app.js` line 193. The raw receipt stayed in a temp dir and was deleted, not committed.

| Seed | Cat | Chrome | Stable points | Accepted inputs (S summon command click, cc trap card then Confirm, e End phase) | Result, round | Cowboy trap set / trigger | Wizard trap set / trigger | Hidden-Wizard-trap points | Cowboy trap opportunity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 55 | A | pass, 0 mismatches | 12 | 11: `ScceSeSeSee` | win (base-destroyed), 5 | 1 / 1 | 1 (round 1) / 1 | 2 | set: scheduled round 1, in hand round 1 |
| 9 | B | pass, 0 | 13 | 12: `ScceSeeSeSee` | loss (base-destroyed), 6 | 1 / 1 | 1 (round 2) / 1 | 1 | set: scheduled round 1, in hand round 1 |
| 2 | C | pass, 0 | 11 | 10: `SeSeSeccee` | loss (base-destroyed), 5 | 1 / 1 | 1 (round 3) / 1 | 3 | set: scheduled round 4, in hand round 4 |
| 23 | D | pass, 0 | 11 | 10: `SeSeSeccee` | loss (base-destroyed), 5 | 1 / 1 | 1 (round 2) / 1 | 2 | set: scheduled round 4, in hand round 4 |
| 7 | E | pass, 0 | 12 | 11: `SeSeSeSeSee` | loss (base-destroyed), 6 | 0 / 0 | 1 (round 6) / 0 | 2 | **conditional, not reached**: scheduled round 8, match ended round 6 |
| 43 | F | pass, 0 | 9 | 8: `SeSeSeee` | loss (base-destroyed), 5 | 0 / 0 | 0 / 0 | 0 | **conditional, not reached**: scheduled round 9, match ended round 5 |

At every stable point (68 in total), the run checked all of the following. Each check had 0 mismatches.

- **Public view parity.** The page's `view()` equals the Node mirror, equals `publicState(full, "cowboy")`, and equals `displayed()`.
- **Event log parity.** The event data equals the mirror's, and the DOM log lines equal `eventLine`.
- **DOM fields.** Every visible DOM field matches the view: the status line with a strict phase check (#132), base orbs, counts, allowances, all six lanes, both trap zones and the hand.
- **Redaction.** When the engine held a Wizard trap, the page showed only `{ faceDown: true, setRound }` and "Enemy trap: set (face-down)". No hidden Wizard hand, deck or trap ID appeared in the page HTML or view, and no Wizard `trap-set` event carried a `cardId`.

Every input was a real CDP mouse press on the page's own button, and the mirror accepted every input.

Not covered by these six seeds under this policy:

- The Cowboy trap in seeds 7 and 43 (E, F). The round 8 accept and round 9 `trap-too-late` gates stay covered only by the #120 Node tests.
- A Wizard trap trigger in seed 7. The trap was set in round 6, and the match ended before it could spring.
- Any Wizard trap in seed 43.
- The `drawn-not-set` and `not-drawn` outcomes. Neither occurred in Chrome; only the unit test covers them.

## Other checks (this session)

| Check | Result |
| --- | --- |
| `node --test tests/match/trap-dom-parity.test.js` | 10 of 10 pass (7 existing + 3 new), 0 skipped |
| `node scripts/browser-trap-parity-131.mjs` (default `0,60`, real Chrome) | 43.7 s, `pass: true`, 0 mismatches, 0 console errors, 0 remote. Digest `1a4681f09ea425fdfc10893249cff0a6bbc0a22d688cb02b3def8b9267f78c07`, equal to the #132 receipts, so the default path's inputs and snapshots are unchanged |
| `npm test` | node:test 333 of 333 pass, 0 skipped; asset structural checks 2 of 2 (structure only) |
| `node scripts/check-links.mjs` | 191 Markdown files, 693 relative links and images, 0 broken |
| `git diff --check` | clean |

## Limits

- This is a fixed-policy regression: free summon first, then the trap, then End phase, against Wizard CPU normal. The 1 win and 5 losses describe that bot pairing only. They are not a balance, clarity or fun claim, and no human played.
- Repeatability is shown by the pinned Node mirror values and the identical default digest. The six-seed Chrome matrix ran once in this session.
- Coordinator-owned `docs/kiro-build-log.md` was not updated (outside owned paths).
