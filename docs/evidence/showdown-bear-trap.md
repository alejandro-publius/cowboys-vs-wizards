# Showdown Bear Trap fatal log line

Date: 2026-11-20 (America/Los_Angeles). Performed by a Kiro CLI worker session (Claude Opus 5.5) on branch `kiro/showdown-ten-trap`, parent `c3dcab6`. Scripts only; no human playtest, no browser run.

## Problem

The engine (`src/game/showdown/rules.js`, `attack`) sets `stopped: true` both for Hex and for a Bear Trap (snare) that takes the attacker to 0. The graybox presenter tested `stopped` first, so a fatal Bear Trap read "its attack was cancelled" instead of the existing "defeated before it struck" wording. The reference page (`prototypes/showdown/main.js`) already shows the right line.

## Change

`src/game/showdown/presenter.js`: the trap line checks `left === 0` before `stopped`. No rules, card, value or wording change.

## Regression test

`tests/game/showdown-bear-trap.test.js` replays seeded deals with the level-2 bot (`playTurn`, every step through `applyAction`) to the first matching trap event:

- seed 18: Bear Trap defeats Imp (`left: 0, stopped: true`); the Imp leaves the board for the graveyard and no attack follows. Expects "Trap! The Cowboys' Bear Trap caught Imp: defeated before it struck."
- seed 15: non-lethal Bear Trap control, "attacked anyway".
- seed 14: Hex control, "its attack was cancelled".

Parent presenter: 2 pass, 1 fail (seed 18 printed "its attack was cancelled."). Fixed presenter: 3/3 pass.

## 80-seed corpus, parent vs new

`node scripts/showdown-trap-corpus.mjs <parent-root> .` with the parent's `src/game` exported by `git archive c3dcab6 src/game package.json` into a temporary folder outside the repo. Seeds 0 to 79, default `createShowdown(seed)` decks and rules, level-2 bot on both sides, played to a result (cap 200 turns; 0 unresolved).

| | |
|---|---|
| turns / events / lines | 1026 / 4934 / 4934 |
| trap events / fatal | 100 / 12 (seeds 1, 3, 18, 28, 35, 39, 41, 42, 47, 49, 51, 66; all Bear Trap) |
| raw state+events sha256 (parent = new) | `5618efb57f450433b5a2be3ba75c09796f554fbbb9ac46c37e43189c602e578a` |
| lines sha256 parent / new | `41131a9e…d867f` / `5ff360ac…847ae` |
| changed lines | 12, every one a fatal trap: "its attack was cancelled." became "defeated before it struck." |

Two runs gave the same digests. The result holds for this corpus and bot only.
