# Evidence: trap UX contract (issue #83)

Date: November 17, 2026 (America/Los_Angeles). App and agent: Kiro CLI V3. Branch `kiro/trap-ux-contract-83`, base `main` 1d42ad7. Text-only.

## What was done

Wrote [trap-player-experience.md](../submission/trap-player-experience.md): a proposed interaction contract for one trap zone per side. It covers the eight-state flow, edge cases, keyboard and screen-reader text, mobile and reduced-motion rules, an acceptance matrix (T1 to T20) and a pending demo beat.

## Sources read

- [AGENTS.md](../../AGENTS.md)
- [requirements.md](../../.kiro/specs/trap-zone/requirements.md), [design.md](../../.kiro/specs/trap-zone/design.md)
- [kiroween-competitive-benchmark.md](../submission/kiroween-competitive-benchmark.md), section 9 only for the #78 boundary
- `src/match/selection.js` (read: step flow and rejection sentences)
- `src/ui/cards.js` (grep only: aria labels, live region, reduced-motion check)
- `src/match/controller.js` and `presenter.js`: sizes checked and event-type grep only, not read in full.

## Observed in the current code (not changed)

- Selection steps are idle, tribute, slot, target, destination, confirm; rejections are plain sentences.
- Lanes are buttons with `aria-pressed` and a spoken label; the latest clash is a polite live region.
- Card motion is skipped under `prefers-reduced-motion` or the `reduce-card-motion` class.
- No trap step, zone, label or event exists in the code.

## Not done

- No browser, screen reader, phone or playtest run. Every row in the matrix is **pending**.
- 44 px target size is a proposal taken from existing title-menu controls, not measured on the board.
- No screenshots or mockups, by instruction.
- No trap card, art, animation, sound, style, spec or source change.

## Decisions left to the owner

Spell allowance versus separate `trapSet`, and full cancel versus one-damage ward (both pending #78, not recommended here); last-round set; phone placement; card name, art, copies and deck migration; tie-break. See section 9 of the contract.

## Checks

`node scripts/check-links.mjs`: 150 Markdown files, 540 relative links and images, 0 broken. `git diff --check`: clean. Both run on the staged change.

## Coordinator wording correction

After Kiro's original commit, the coordinator corrected the optional one-damage variant's wording: it reduces the **same highest-attack enemy troop** selected by the existing spec, rather than an arbitrary "first hit". The effect strength remains undecided. No game, animation or asset code changed.
