# Kiro evidence: trap deck copy counts and draw odds (issue #87)

Date: 2026-11-17, America/Los_Angeles. Agent: Kiro CLI 3.4 V3, model claude-opus-5.5, in an
isolated worktree on branch `kiro/trap-deck-odds-87`, based on main a327b1b. Kiro did not extract a credit figure while writing this note. A subsequent coordinator check of the same session's ignored stream JSONL found the selected model `claude-opus-5.5` and a final session credit reading of `8.103838534328357` credits. This is a session-level report, not an account balance or invoice. No paid third-party API or account action.

## Problem

The user has not approved any trap card, name, effect, art or copy count. Before any deck
change, the issue asks for exact draw odds with one or two anonymous trap copies replacing spell
copies in the 12-card decks. All troop counts stay fixed and the decks stay at faction parity.

## Inputs read

`AGENTS.md`, issue #87, `src/game/{cards,state,deck-builder}.js`, the draw step in
`src/game/actions.js` (one card per side at each round start after round 1, none from an empty
deck), and [trap-zone requirements](../../.kiro/specs/trap-zone/requirements.md) R1, R3, R7 and R13.

## Change

New files only:

- [odds.js](../../experiments/trap-deck-odds/odds.js): exact hypergeometric probabilities as
  BigInt fractions. It covers the shipped deck, T1 (1 trap for 1 spell), T2 (2 traps for 2
  spells) and a text-only TF scenario (1 trap for 1 free troop).
- [sample.js](../../experiments/trap-deck-odds/sample.js): a deterministic cross-check. It
  takes the real `createMatch` shuffle of the shipped decks and relabels spell copies as traps.
- [run.mjs](../../experiments/trap-deck-odds/run.mjs) prints the tables.
  [odds.test.js](../../experiments/trap-deck-odds/odds.test.js) holds the focused checks.
- [Options for the user](../submission/trap-deck-allocation-options.md).

`src/`, specs, `CARDS`/`DECKS`, package files, tests, UI and the build log are unchanged. The
coordinator owns the build log.

## Model and assumptions

- Cards seen once round r has started: min(12, 4 + r - 1). That is 4, 5, 7, 9 and 12 cards for
  rounds 1, 2, 4, 6 and 9.
- Every value is conditional on the match still running at that draw. The draws are fixed by the
  shuffle and do not depend on play.
- Both factions use 6/3/1/2 decks, so the exact odds are identical for Cowboys and Wizards.
- A trap first drawn in round 9 is dead, because a round-9 set is rejected (R13). A round-8 draw
  can only arm for the round-9 clash (R3).
- No CPU behavior, no trap effect and no win rate is modelled.

## Verification (actual output)

```
$ node --test experiments/trap-deck-odds/odds.test.js
ℹ tests 7   ℹ pass 7   ℹ fail 0
```

Note: `node --test experiments/trap-deck-odds/` (directory form) fails on Node v26.0.0 by
treating the folder as a script. The existing `experiments/trap-balance/` folder fails the same way.
Name the test file.

`node experiments/trap-deck-odds/run.mjs` printed the following, trimmed to the requested rows:

| Exact (both factions) | T1 | T2 |
|---|---|---|
| >=1 trap in opener (4) | 1/3 = 33.33% | 19/33 = 57.58% |
| by round 2 (5 seen) | 5/12 = 41.67% | 15/22 = 68.18% |
| by round 4 (7 seen) | 7/12 = 58.33% | 28/33 = 84.85% |
| by round 6 (9 seen) | 3/4 = 75.00% | 21/22 = 95.45% |
| first trap in round 9 (dead) | 1/12 = 8.33% | 0 |
| first trap in round 9, given none by round 6 | 1/3 = 33.33% | 0 |
| first trap in round 8 | 1/12 = 8.33% | 1/66 = 1.52% |
| >=1 spell by round 4 (shipped 28/33 = 84.85%) | 7/12 = 58.33% | 0 |
| spell and trap both drawn by round 4 | 7/22 = 31.82% | 0 |
| opener with no free troop (TF text-only: 7/99 = 7.07%) | 1/33 = 3.03% | 1/33 = 3.03% |

Seeded cross-check: the real shuffle over seeds 0-9999. This is a deterministic sample, not the
exact calculation. The trap takes the second spell copy (T1) or both copies (T2).

| First-trap round | T1 exact | T1 Cowboy | T1 Wizard | T2 exact | T2 Cowboy | T2 Wizard |
|---|---|---|---|---|---|---|
| 1 | 33.33% | 33.27% | 33.54% | 57.58% | 56.55% | 57.87% |
| 2 | 8.33% | 8.41% | 8.16% | 10.61% | 11.49% | 10.51% |
| 4 | 8.33% | 8.02% | 8.76% | 7.58% | 7.73% | 7.59% |
| 6 | 8.33% | 8.62% | 8.04% | 4.55% | 4.47% | 4.44% |
| 8 | 8.33% | 8.15% | 7.77% | 1.52% | 1.42% | 1.75% |
| 9 | 8.33% | 8.34% | 8.12% | 0.00% | 0.00% | 0.00% |

The largest gap is T2 Cowboy round 1, at 1.03 points. That is about 2.1 standard errors for
n = 10000, which fits sampling noise. All T1 gaps are at most 0.56 points.

Other checks: `node scripts/check-links.mjs` printed "162 Markdown files, 584 relative links and
images, 0 broken". `git diff --cached --check` printed nothing (exit 0). `npm test` and Chrome were not run, because no runtime file changed.

## Remaining work

- User decision among T1, T2 and deferring (see the options). Card name, effect copy and art
  need user approval first (requirements O1, O2).
- A human A-against-B decision-load playtest remains the only basis for claims about clarity or fun.
