# Trap A + X spec review

Author: Kiro CLI 3.4 V3. Issue: alejandro-publius/cowboys-vs-wizards#85. Base: main 769a4fc. Date: 2026-11-17 (America/Los_Angeles; no time of day recorded).
Kind: documentation-only change. No `src/`, art, animation, UI, deck or card change.

## What changed

- [Prototype contract](../submission/trap-prototype-contract.md) (new): A + X rules, `set-trap` rejection order and text, `trap-trigger` fields, cross-turn event order, CPU and public view, player text mock, reversal criteria, named tests.
- `.kiro/specs/trap-zone/{requirements,design,tasks}.md`: header notes and A-variant wording for R2, R4, R13 (new), T2, T3, T5. B + X wording is kept and labelled as the retained alternative.

## Decisions recorded

- A + X is the coordinator's choice for the first prototype. The PR #84 study recommended B + X for integration simplicity. Both stay documented; the study is not altered.
- Resolved the study's "A has a rules trap" finding with text: a set blocks later summons and uses new reasons `summon-after-trap`, `cast-after-trap`, `trap-after-spell`.
- Round 9 set is rejected with `trap-too-late`.
- The shared allowance is told apart by a flag-on `tactical` field (design choice, a second boolean is the alternative).

## Open points for the user

Trap card name, art, copy count, deck migration, tie-break (O1 to O3), the player text strings, and the numeric thresholds for reversing A or X. Thresholds in the contract are proposals, not measurements.

## Checks

| Check | Result |
|---|---|
| `node scripts/check-links.mjs` | Passed: 154 Markdown files, 547 relative links, 0 broken |
| `git diff --check` | Passed, no output |
| Tests named in the contract section 9 | PENDING. Named only. Not written, not run. |
| Replays, simulations, browser | not run. No behavior changed. |

Source facts were read from `src/game/actions.js`, `legal.js`, `state.js` (rejection strings `summon-after-spell`, `cast-used`; `MAX_ROUNDS = 9`; `allowances` shape). No code was edited.
