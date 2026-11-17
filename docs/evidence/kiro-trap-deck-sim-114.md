# Kiro evidence: matched-seed trap deck replacement simulation (issue #114)

Date: 2026-11-17, America/Los_Angeles. Agent: Kiro CLI 3.4 V3 in an isolated worktree on branch
`kiro/trap-deck-sim-114`, based on main `ccd3cc9`. The session context names the model
`claude-opus-5.5`. The coordinator inspected the completed Kiro V3 stream: session-selected model
claude-opus-5.5 and 16.79520830613599 reported session credits (tool metadata, not an account invoice). No external API, browser, human tester or account action was used.

Status: test-only analysis. `CARDS`, `DECKS`, card specs, `src/`, `tests/`, UI, renderer, assets
and existing docs are unchanged. No production trap card, name, effect, copy count or deck
migration is proposed or approved. Nothing here is a recommendation to ship.

## Problem

[#87](../submission/trap-deck-allocation-options.md) gave exact draw odds for one or two anonymous
trap copies replacing spell copies. It made no win-rate claim, because no match was played. This
task plays real engine matches on the same 12-card replacements with paired seeds to see how the
replacement changes completed matches between the shipped CPU levels.

## Inputs read

`AGENTS.md`, [trap prototype contract](../submission/trap-prototype-contract.md),
[deck allocation options](../submission/trap-deck-allocation-options.md),
`src/game/{state,cards,actions,legal,view,cpu,clash}.js`, the fixture pattern at the top of
`tests/game/trap-cpu-levels.test.js`, `experiments/trap-deck-odds/{odds,sample}.js` and the
exported `playMatch` in `scripts/play-match.mjs`.

## Method

New files: [sim.js](../../experiments/trap-deck-sim/sim.js),
[run.mjs](../../experiments/trap-deck-sim/run.mjs),
[sim.test.js](../../experiments/trap-deck-sim/sim.test.js) and the printed tables in
[results.md](../../experiments/trap-deck-sim/results.md).

- **BASE**: `createMatch(seed)`, shipped 6 free / 3 mid / 1 legendary / 2 spells, traps off.
- **T1**: `createMatch(seed, { traps: true })`, then spell copy 2 (`cowboy-deadeye-2`,
  `wizard-singularity-2`) is relabelled to an anonymous fixture trap
  (`test-fixture-deck-trap-<side>-2`) wherever it sits in the shuffled hand or deck. One spell remains.
- **T2**: as T1 with both spell copies relabelled. No spell remains.
- The relabel runs after the shuffle. RNG, starting side and every other ID position are those
  of BASE for the same seed. No card is added and `DECKS`/`CARDS` are not mutated.
- The fixture catalog `TEST_CARDS` (`CARDS` plus four frozen fixture entries of kind `trap`) is
  passed only to `legalActions`, `applyAction` and the `cpuFor(level)` chooser.
- Each step: the CPU chooses on `publicState(state, side)`. The choice must be in
  `legalActions(state, side)` and accepted by `applyAction`. Checks after each step: exact ID
  multiset per side (deck, hand, board, trap zone, discard) equals the opening 12; orbs 0-5;
  troop health 1 to printed health; round at most 9; no `set-trap` in round 9; every
  `trap-trigger` comes from a zone set in an earlier round; no hand, deck or face-down trap ID
  appears in the opponent's `publicState` or `publicEvents`. At the end, `resultAfterClash` on the
  final state must equal the recorded result. Any failure throws, so the run would stop.
- Seeds 0-199 and 200-399 (400 per configuration), the same level on both sides: Normal,
  Hard and Easy. 9 configurations, 3,600 matches. Rules `orb-duel-draft-1` (BASE) and
  `orb-duel-draft-1+traps` (T1, T2), sim version `trap-deck-sim-114-v1`. Bots: shipped
  `cpuFor("easy" | "normal" | "hard")`, which set a held trap whenever the trap step applies (T5).
- Reproduce: `node experiments/trap-deck-sim/run.mjs` (about 10 s on this machine). Two runs
  produced byte-identical output. Run digests are listed in results.md.

## Results (seeds 0-399, observed)

All 3,600 matches completed with no invariant failure, no illegal or rejected choice and no
leak. Starting sides are identical across scenarios (Cowboy starts 187 of 400).

| CPU | Deck | Cowboy / Wizard / Draw | Starter wins | Base destroyed | Mean end round | Actions | Casts C / W |
|---|---|---|---|---|---|---|---|
| Normal | BASE | 171 / 186 / 43 | 225 | 337 | 7.29 | 12,785 | 577 / 598 |
| Normal | T1 | 183 / 174 / 43 | 201 | 300 | 7.55 | 13,319 | 306 / 319 |
| Normal | T2 | 184 / 151 / 65 | 156 | 240 | 8.03 | 14,136 | 0 / 0 |
| Hard | BASE | 181 / 186 / 33 | 126 | 383 | 5.71 | 10,134 | 512 / 545 |
| Hard | T1 | 201 / 176 / 23 | 119 | 371 | 5.94 | 10,582 | 270 / 279 |
| Hard | T2 | 195 / 174 / 31 | 132 | 342 | 6.35 | 11,212 | 0 / 0 |
| Easy | BASE | 158 / 128 / 114 | 156 | 200 | 8.21 | 13,071 | 0 / 0 |
| Easy | T1 | 182 / 147 / 71 | 158 | 235 | 8.04 | 13,475 | 0 / 0 |
| Easy | T2 | 184 / 151 / 65 | 156 | 240 | 8.03 | 14,136 | 0 / 0 |

Trap metrics, matches out of 400 (Cowboy / Wizard). "Set" and "trigger" count matches with at
least one event; event totals are in results.md.

| CPU | Deck | Trap seen | Set | Triggered | Second trap held with full zone | Trap in hand in round 9 | Phases with spell and trap in hand |
|---|---|---|---|---|---|---|---|
| Normal | T1 | 353 / 360 | 341 / 344 | 324 / 326 | 0 / 0 | 12 / 16 | 59 / 67 |
| Normal | T2 | 400 / 394 | 400 / 394 | 393 / 389 | 95 / 95 | 44 / 45 | 0 / 0 |
| Hard | T1 | 313 / 304 | 306 / 297 | 273 / 279 | 0 / 0 | 7 / 7 | 62 / 65 |
| Hard | T2 | 383 / 371 | 383 / 371 | 371 / 354 | 85 / 87 | 24 / 27 | 0 / 0 |
| Easy | T1 | 377 / 378 | 352 / 352 | 348 / 340 | 0 / 0 | 25 / 26 | 195 / 192 |

Easy T2 is identical to Normal T2 (same run digest). That is expected: Easy differs from Normal
only by never casting, and T2 has no spell. Under T2 the spell role is removed (0 casts).

Matched-seed Cowboy score delta against BASE (win 1, draw 0.5, loss 0; percentage points):

| CPU | Deck | 0-199 | 200-399 | 0-399, 95% interval |
|---|---|---|---|---|
| Normal | T1 | +1.5 | +4.5 | +3.0 (-2.4 to +8.4) |
| Normal | T2 | +3.5 | +8.5 | +6.0 (+0.01 to +12.0) |
| Hard | T1 | +0.8 | +6.8 | +3.8 (-1.4 to +8.9) |
| Hard | T2 | +3.0 | +3.5 | +3.3 (-2.3 to +8.8) |
| Easy | T1 | +3.8 | -2.5 | +0.6 (-4.3 to +5.6) |
| Easy | T2 | -1.8 | +2.5 | +0.4 (-5.0 to +5.7) |

Interval assumptions: mean +- 1.96 sd / sqrt(n) over the per-seed score differences, a normal
approximation that treats seeds as independent shuffles of the shipped decks. CPU play is
deterministic, so the only variation is the deal. The Wizard delta is the negative. Both factions
receive the same swap, so a delta measures an asymmetric effect of the swap on these two decks
under these bots.

## Comparison with the #87 exact odds

The first-trap round taken from the opening order (unconditional, the whole 12-card order)
matches the #87 exact values within sampling noise. Example, T1 Cowboy over 400 seeds: opener 128
against 133.3 expected, rounds 2-9 between 24 and 39 against 33.3 each. The "seen in play" counts
are lower in late rounds (T1 Normal Cowboy: 47 matches ended before the trap reached the hand)
because a match can end before the draw. Runtime counts are therefore conditional on the match
lasting and are not equal to the unconditional probabilities. Full table: results.md.

## Interpretation (estimates under the tested conditions only)

- These are synthetic fixture traps played by deterministic CPUs on seeds 0-399. They say
  nothing direct about human balance, clarity or fun, and no human balance is attributed to T1 or T2.
- T1 roughly halves casts (Normal 1,175 to 625). Under Normal the trap is set in about 85% of matches.
  Matches last slightly longer and fewer end with a destroyed base.
- T2 removes casting entirely. Under Normal, draws rise from 43 to 65, base destructions fall
  from 337 to 240, round-9 finishes rise from 112 to 221, and starter wins fall from 225 to 156.
  About a quarter of matches hold the second trap while the zone is full.
- Paired Cowboy deltas are positive in 10 of 12 block rows. Two of the 18 interval rows in
  results.md exclude zero, both Normal T2: seeds 200-399 (+0.3 to +16.7) and seeds 0-399 (lower
  bound +0.01 pp). No multiple-comparison correction is applied, so these exclusions are weak
  evidence. The seed blocks also disagree (Hard T1 +0.8 against +6.8).
- Under A + X, a phase with both a spell and a trap in hand occurs only under T1 (59-67 phases of
  Normal play per side across 400 matches). The shipped CPUs always take the trap first there.

## Verification

- `node --test experiments/trap-deck-sim/sim.test.js`: 6 tests pass. They cover BASE seed 0/60
  parity with `createMatch` and with the actions, events and final state of
  `scripts/play-match.mjs` for every level; 12 unique cards per side with 10/2/0, 10/1/1 and
  10/0/2 troop/spell/trap counts on seeds 0-199; RNG, starting side and position parity of T1/T2
  against BASE with only spell copies relabelled; no fixture ID or trap kind in `CARDS`, frozen
  catalogs, and `not-a-trap` without the fixture catalog; legal replay of recorded actions
  reproducing events and results, deterministic digests and no round-9 set for seeds 0 and 60 in
  every scenario and level; `pairedDelta` pairing.
- `npm test` (scripts/verify-duel.mjs, run once): exit 0, 313 Node tests pass, 0 fail; it does
  not include experiments/. `node scripts/check-links.mjs`: 175 Markdown files, 628 links, 0 broken (after staging).
  `git diff --check` on the staged change: clean.

## Remaining work and owner decisions

- Still owner blocked: trap card identity, name, art, text, copy count, deck migration, 3D
  models, animation and audio. Any reversal band (contract section 8) is the owner's to set.
- Not run: B + X allowance, effect Y, mixed-level pairings, other deck variants, human playtests.
- `docs/kiro-build-log.md` was not edited because this task's scope excludes existing docs; the
  coordinator owns that entry.


## Independent coordinator review (November 17, 2026)

After Kiro authored the five-file commit 237e8c3 and the Kiro V3
runFinished event, the coordinator inspected the deterministic setup,
CPU/legal action loop, invariant checks, exact spell-ID relabeling
logic and matched-seed summary script. All source changes are confined
to NEW experiment files and this evidence note; no production code.

Independent reproduction from base
ccd3cc984b4bf1698e0127ef2e4661477b50027a:

- node --test experiments/trap-deck-sim/sim.test.js:
  **6/6 pass** (12-card parity, seed0/60 replay, legal actions,
  exact relabeling and fixture scope).
- node experiments/trap-deck-sim/run.mjs:
  printed the entire 3,600-match summary; a byte-for-byte diff
  against the committed results.md was empty. Both SHA-256 files:
  fc52411b39ffb533627a054cb1ae2356a3408b408e3b45a6d800e6a306e0e955.
- npm test: **313/313 existing Node tests pass**, plus 2/2 GLB
  structural checks (not visual animation quality).
- node scripts/check-links.mjs: 175 Markdown files,
  628 links, **0 broken**.
- git diff HEAD^ HEAD --check: **pass**.
- Kiro CLI 3.4.0 was observed at launch. The completed V3 stream
  selected claude-opus-5.5 and reported session usage
  **16.79520830613599 credits**. This is not an account invoice
  or proof of human balancing.

Coordinator authored this paragraph separately from the Kiro-authored
simulation. Synthetic trap comparisons are test-only. No production
card identity, count, deck replacement, gameplay activation, art,
3D, animation or audio approval occurred.
