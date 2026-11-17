# Kiro evidence: T1 trap playtest seed kit (issue #120)

Date: 2026-11-17 (America/Los_Angeles). Worker: Kiro CLI 3.4.0 V3, model `claude-opus-5.5` (passed with `--model`; the session reported this model). Credits and usage: none were emitted to the worker, so none are recorded. Base: remote main `abf63173432122313d18e2bf0ff94cc3a7f7b2a1` (includes #117 scenario lab and #119 playtest report). Branch `kiro/trap-playtest-kit-120`, one local commit, not pushed or merged.

## Problem

The user wants realistic 12-card T1 play in the local lab before any trap name, copy count, deck, art, 3D, animation or audio is approved. A person needs a small, reproducible set of seeds that cover distinct Cowboy trap-timing cases. This task builds that seed kit. It is not a playtest.

## Change

New files only, under [experiments/trap-playtest-kit/](../../experiments/trap-playtest-kit/README.md):

- [seeds.js](../../experiments/trap-playtest-kit/seeds.js): pure picker. Scans seeds 0 to 9999 with `openingFor(seed, "T1")` from [scenarios.js](../../experiments/trap-placeholder/scenarios.js), cross-checks each against `createMatch(seed)`, fills categories A to F with the lowest eligible unused seed and a fixed first side (A, C, E Cowboy; B, D, F Wizard), and picks a separate T2 example.
- [run.mjs](../../experiments/trap-playtest-kit/run.mjs): prints the Markdown plan; writes a file only with `--out <path>`.
- [seeds.test.js](../../experiments/trap-playtest-kit/seeds.test.js): 11 focused Node tests.
- [seed-plan.md](../../experiments/trap-playtest-kit/seed-plan.md): generated with `--out`; byte-equal to stdout (tested).
- [README.md](../../experiments/trap-playtest-kit/README.md): algorithm, lab steps (T1 with Wizard CPU normal, optional BASE paired seed, notes only after play, "Export current playtest report", keep files local) and caveats.

No change to `src/`, the lab, cards, decks, scripts, packages, CI, assets or other docs.

## Picked seeds (computed positions, not play results)

| Cat | Seed | First side | Cowboy trap position (round) | Cowboy spell position (round) | Also matches |
| --- | --- | --- | --- | --- | --- |
| A | 55 | Cowboy | 0 (opener) | 2 (opener) | - |
| B | 9 | Wizard | 1 (opener) | 5 (round 3) | - |
| C | 2 | Cowboy | 6 (round 4) | 3 (opener) | D |
| D | 23 | Wizard | 6 (round 4) | 2 (opener) | C |
| E | 7 | Cowboy | 10 (round 8) | 1 (opener) | - |
| F | 43 | Wizard | 11 (round 9) | 3 (opener) | - |

Optional T2 example: seed 35, Wizard first, both Cowboy synthetic traps at positions 0 and 2.

Position p of 4 to 11 reaches hand at the start of round p - 2 only if the match lasts that long. C and D overlap at trap position 6; the plan reports this. Wizard positions are not printed.

## Verification (this run)

| Check | Result |
| --- | --- |
| `node --test experiments/trap-playtest-kit/seeds.test.js` (new) | 11 of 11 pass, 0 skipped. One earlier run failed 1 test: the purity check matched the word `node:` in a comment. The check now ignores comment lines and asserts the exact import list. |
| `node experiments/trap-playtest-kit/run.mjs` | deterministic Markdown; about 0.11 s for the full 0-9999 scan |
| `npm test` | node:test 313 of 313 pass, 0 skipped; asset structural checks 2 of 2 (structure only) |
| `node scripts/check-links.mjs` | 180 Markdown files, 661 relative links and images, 0 broken (new files staged intent-to-add) |
| `git diff --check` | clean |

What the tests check: bounded scan (limit above 10000 refused) and identical repeat output; `CARDS` and `DECKS` unchanged after the scan; six distinct seeds, three per first side; each pick recomputed from BASE `createMatch` alone (spell copy 2 position = trap, copy 1 = spell) as the lowest eligible unused seed; both sides 12 cards with one spell and one trap; same rng, starting and active side as BASE; every other ID at its BASE position; equality with the #114 [sim.js](../../experiments/trap-deck-sim/sim.js) `openingFor`; with end-phase-only engine steps (no troops, not a playtest) the trap is absent before its listed round and in hand at its start; E's trap is accepted by `set-trap` in round 8 with `setRound: 8`; F's is refused with `trap-too-late` in round 9; no clock, random source, storage, network, DOM or `node:` import in `seeds.js`; no Wizard card ID, win rate or timestamp in the plan; CLI writes nothing without `--out`, `--out` writes stdout's bytes, bad arguments exit 2.

## Limits

- No human has played these seeds. The kit says nothing about clarity, choice quality, pacing, fun or balance.
- A, B and C are choice opportunities. Whether a player makes the choice is unknown until play.
- E and F need the match to reach round 8 or 9; real matches may end first.
- Knowing the trap position can change how a tester plays.

## Remaining work

`docs/kiro-build-log.md` was not updated because it is outside this task's owned paths; the coordinator owns that log. A human runs the six seeds (and optionally BASE pairs and the T2 example) in the local lab, writes notes after play and exports reports. The coordinator reviews, tests and gates on GitHub CI.

## Independent coordinator verification (November 17, 2026)

After Kiro-authored commit 4266db4 and the completed V3 session
(runFinished), the coordinator independently inspected all six newly
added files against issue #120, ran the actual generator and tests,
and verified no modifications to existing code or documents.

- Focused node --test experiments/trap-playtest-kit/seeds.test.js:
  **11 of 11 pass, zero skipped**. This includes 12-card multiset,
  same-seed BASE shuffle/starting side, no production catalog mutation,
  first-draw round positions, round8/round9 trap gates and the
  six-seed 3/3 starter balance.
- node experiments/trap-playtest-kit/run.mjs regenerated the entire
  committed seed-plan.md byte-for-byte. Both SHA-256 checksums:
  b7f7d03f7b41da80f36815d2cf16f14f5517d594a5f1220a37a540b04c8da093.
- npm test: **313/313 Node tests** plus 2/2 GLB structural checks,
  which are not visual motion-quality proof.
- node scripts/check-links.mjs: **180 Markdown files,
  661 relative links and images, zero broken**.
- git diff HEAD^ HEAD --check: **PASS**.
- Verified exact base SHA abf63173432122313d18e2bf0ff94cc3a7f7b2a1.
- Kiro CLI version 3.4.0 and availability of claude-opus-5.5
  were verified at launch; the final session JSONL V3 metadata
  selected claude-opus-5.5 and reported **14.267968802653398
  session credits** (tool usage metadata, NOT an account invoice).
  This coordinator-added receipt supplements the worker's note
  about not observing usage in its own output.

This evidence appendix was added by the coordinator, not Kiro.
No person played the seed suite here and no test establishes that
spell-vs-trap is clear or fun. The seeds are game-deal opportunities,
not observed draws if a match terminates before a late round.
No production card identities, copy counts, decks, UI, art, 3D,
animation, sound, telemetry or public deployment changed.
