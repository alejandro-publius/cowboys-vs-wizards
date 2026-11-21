# Devpost lift: board-replay QA baseline (Kiro CLI, 2026-11-20)

Worker: Kiro CLI test worker `board-replay` (Claude Opus 5.5) on branch `kiro/devpost-lift-board-replay` from `main` `ea183ee`. QA only: no `src/`, engine, renderer, art, balance or wording change. Scripted headless Chrome; no human played.

## What it checks

`scripts/browser-showdown-board-zones.mjs` plays golden normal routes on the built graybox through the page's own buttons. It applies no state patches. Each route runs in a fresh context with reduced motion, planted synthetic saves for both seats (a Cowboy career and `cvw-showdown-wizard-preview-v1`) and a fixed `Math.random` (mulberry32, test-only init script). The deal comes from the page's `freshSeed()`. The script scans start values from 1 and takes the first deal that has the cards the route needs.

| Route | Start | Path | Asserted |
| --- | --- | --- | --- |
| `raise` | `?wizard=1`, Dry Gulch, 1280×900, random 1 | summon Skeleton, End turn, Wizard paid with that Skeleton | Wizard on board; Skeleton back with `1 of 3 orbs`; Wizards graveyard count unchanged and line `empty`; log has the tribute and `Raise:` lines; deck count unchanged; Cowboy hand is backs only with no Cowboy id in the page; Restart deals the same opening; both saves byte-identical |
| `raise-narrow` | same at 360×740 | same | as above, plus 0 px horizontal overflow and each pressed control topmost at its centre and at least 24 px |
| `trap` | Two players, one screen, random 6 | Cowboy sets `cowboy-bear-trap-1`; Wizard summons a Skeleton, then attacks on its next turn | Cowboy seat: `Set: Bear Trap`, card gone from hand, log `The Cowboys set a card face down.`. Wizard seat while set: `1 card face down`, and neither the name nor the id is in the duel page. Springs on turn 4 (`Trap! The Cowboys' Bear Trap caught Skeleton: it dropped to 1 and attacked anyway.`). Then `Bear Trap` is in the public Cowboy graveyard and `Nothing face down`. The graveyard shows names, not ids. Every curtain (4, plus the one after Restart) has no hand, board or card id. Both saves byte-identical |

## Commands and results

```
node scripts/build-graybox.mjs --hosted          # dist/web/index.html, build ea183ee29dbd, sha256 d570e41145132beb…
npx -y -p playwright-core@1.64.1 node scripts/browser-showdown-board-zones.mjs --page dist/web/index.html --out /tmp/bz-receipt.json
```

- Chrome 158.0.8127.37: PASS raise, PASS raise-narrow, PASS trap, about 5 s wall-clock in total. A second run produced identical route notes, apart from timings.
- Sensitivity, on throwaway copies of the built page: one copy writes graveyard instance ids. On it, `trap` fails four ways: name missing, a hidden id in the page, an id in the graveyard line, and an id behind the curtain. The other copy appends "Bear Trap" to the opponent's face-down line. On it, `trap` fails on the trap line and on page text naming the trap. Both copies were deleted afterwards.
- Run 1 failed while I was writing the script, because the orb read used troop text (`●○○`). It now reads the slot's `.sd-orbs` aria-label. The page was not at fault.

## Second pass: baseline and zones candidate (same session)

The script now detects the page layout from the built HTML. `baseline` is main `ea183ee` (Base count text and `#sd-<side>-graveyard`). `zones` is the Boot Hill table UI: `[data-zone-side]` rails, `[data-graveyard]` piles, `dialog#sd-graveyard-sheet` and `#sd-zone-move`. `--require-zones` exits 1 on a page without zones. `--witness leak-name|break-pile|break-move` re-applies one DOM-only fault after every render through a test-only MutationObserver, and that run must exit 1. The exact commands are in `../board-qa-command.txt`, outside the repository.

The candidate was a disposable tree in /tmp: `git archive` of this branch plus `src/ui/showdown-screen.js` (sha256 `0e32aa68…`), `showdown-zones.js` (`87a2bf18…`) and `showdown.css` (`cb8d49c6…`, the same as main) copied from `../board-ui-tree`. I did not edit `../board-ui-tree`. Its owner later stashed the screen change while still working, so the candidate is that earlier working copy. Built page sha256 `af1dfed64e14e141`, build label not identified (no git).

| Run | Result |
| --- | --- |
| baseline, auto-detected | PASS ×3, exit 0 |
| baseline `--require-zones` | exit 1 (layout baseline) |
| candidate `--require-zones` | PASS ×3, exit 0 |
| candidate `--witness leak-name` | trap FAIL (Wizard seat sees `1 card face down · Bear Trap`, name in HTML), exit 1 |
| candidate `--witness break-pile` | raise/raise-narrow FAIL (Wizard pile not empty-marked), trap FAIL (top blank, rows ≠ pile), exit 1 |
| candidate `--witness break-move` | all three FAIL on `#sd-zone-move`, exit 1 |

Observed on the candidate:
- Raise: the move line reads `Skeleton → Wizard Boot Hill (tribute) · Skeleton ← Wizard Boot Hill (Raise)`, and the Wizard pile is `[data-graveyard-empty]` with no Raise dot.
- Trap: the Wizard seat sees `1 card face down` and no `Bear Trap` in the HTML. After the spring, the pile top reads `Bear Trap` (count 1), the flip reads `Sprung: Bear Trap`, and the move line reads `Bear Trap → Cowboy Boot Hill (trap spent)`.
- Sheet, opened with Enter on the pile: a modal titled `Cowboy Boot Hill graveyard · 1 card, newest first`. Focus lands on row 0 (`Bear Trap`). Enter expands its rules text (`aria-expanded="true"`). There is no `[data-raise-target]`, as expected for the Cowboy pile. Escape closes the sheet, empties it and returns focus to `[data-graveyard="cowboy"]`.
- Curtains hold no rail, sheet or move text. Both seats' saves are byte-identical after Restart.

The first candidate run failed with `Escape left the sheet with rows`. The dialog's `close` event is a queued task and the script read before it ran. The script now waits up to 2 s for the sheet to settle; the page was not at fault.

## Limits

`[data-raise-target]` on a Wizard pile with an Undead troop is not reached on these deals; only its absence on the Cowboy pile is asserted. The candidate CSS was unchanged from main, so narrow layout was not tested against new zone CSS. The routes cover one deal each and the two-player trap from one seat order. Dry Gulch is not played to a result. These checks say nothing about clarity or fun.
