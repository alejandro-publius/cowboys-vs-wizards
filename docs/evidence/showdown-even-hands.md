# Showdown: both hands shown once a duel ends (even-fight brief, item 4)

Worker: Kiro CLI (Claude Opus), branch `kiro/showdown-sprint-even-hands`, November 20, 2026 (America/Los_Angeles).
Brief: Fable, `docs/design/showdown-even-fight-kiro-brief.md` at `f079fdc`, item 4 and done-when 6. Item 4 only;
items 1 to 3 (deck, Base orbs, cover) are not in this change. The brief's merge gate (not before Monday, November 23) applies.

## Change

- `src/game/showdown/contract.js`: `finishedViewFor(state, side)` is `viewFor` plus the other side's hand, and it
  throws while `result` is unset. `viewFor` is unchanged, so the bot, a seat and a pass-the-screen turn keep the strict view.
- `src/match/showdown-session.js`: `finished()` returns that view once the duel has a result, otherwise null.
  `view()` is unchanged, so the playtest line and the review scripts built from it gain no field.
- `src/ui/showdown-screen.js`: after the result each Base names its hand ("Hand: Sheriff, Lasso" or "Hand: empty")
  in place of the card backs. Set traps stay face down. No deck card or card id is written into the page.

## Checks (scripted, run in this worktree; no human playtest)

| Check | Result |
| --- | --- |
| `node --test prototypes/showdown/contract.test.js tests/game/showdown-properties.test.js` | 19 of 19 pass; SP4 now also checks the finished view at every step (refused mid-duel; both hands, no trap or deck id at the end) and reaches the new `finished-both-hands` category |
| `node --test tests/match/showdown-session.test.js` | 5 of 5 pass; the new case plays 12 solo Boot Hill deals and 12 two-player deals beside the rules and compares the hands shown with the real hands |
| `npm run build`, then `node scripts/browser-showdown-check.mjs dist/cowboys-vs-wizards-board-duel.html` | 22 of 22 checks pass, isolated headless Chrome. Normal Play entry, solo, `?seed=0`: seat privacy holds mid-duel. At the end Boot Hill showed Cowboy `Sheriff` and Wizard `Skeleton` ×5; Raven Roost showed `Covered Wagon` and `Skeleton, Raven Familiar, Skeleton, Skeleton, Skeleton` |
| `node scripts/browser-showdown-modes-check.mjs dist/cowboys-vs-wizards-board-duel.html` | 13 of 13 pass. Two players, best of three, `?seed=3`: the curtain still hides the table at every handoff (11 and 18 curtains). At each result both Bases named their hands (2 and 3 cards, then 3 and 2), with no card backs and no card id in the page |
| `npm test` | 619 of 619 pass |
| `sh scripts/check-match-ui.sh showdown` | 19 of 19 pass |

Pending: no human playtest of the end-state screen. The reference page `prototypes/showdown/main.js` is unchanged
and still hides the other hand at the end.
