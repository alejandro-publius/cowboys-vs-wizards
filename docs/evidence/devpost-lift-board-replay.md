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

## Hook expectations for Fable's table UI (not agreed, reported only)

The receipt counts these selectors and never fails on them. Today every count is 0:
`[data-zone="graveyard"][data-side="cowboy|wizard"]`, `[data-zone="deck"][data-side]`, `[data-zone="hand"][data-side]`, `[data-zone="traps"][data-side]`.
When the final selectors are agreed, add these assertions on them: the graveyard zone lists the same names as `#sd-<side>-graveyard`, and the hand and deck zones match the Base `Hand N · Deck N` counts. The opponent's trap zone shows a count only, and while the curtain is up no zone contains a card id.

## Limits

The routes cover one deal each and the two-player trap from one seat order. Dry Gulch is not played to a result. These checks say nothing about clarity or fun.
