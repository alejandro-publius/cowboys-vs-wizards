# Evidence: Haunted-Western Refusal UX & 8-Route Accessibility Audit

- **Date:** 2026-11-26 (America/Los_Angeles)
- **Base revision:** `93db9f3` (`main`)
- **Authoring agent:** Antigravity (branch `antigravity/saloon-mischief-axe`; open for review, not merged to `main`)
- **Spec requirements:** [`.kiro/specs/haunted-saloon-mischief/requirements.md`](../../.kiro/specs/haunted-saloon-mischief/requirements.md) (`HSM-1`–`HSM-3`)

## 1. Haunted-Western Card Refusal Copy With Next-Tap Guidance (`HSM-1`, `HSM-2`)

[`src/ui/showdown-screen.js`](../../src/ui/showdown-screen.js) exports pure `blockedReason(view, seat, cardId)` (rendered inline on disabled graybox hand cards and projected onto 3D card `title` tooltips via `src/ui/showdown-3d/table-ui.js`). Every refusal pairs haunted-Western flavor with a concrete next tap while preserving `"One troop a turn."` verbatim for `scripts/browser-showdown-check.mjs`:

- **After a troop acts:** *"Gunsmoke's out — no more cards this turn. Act with your troops or press End turn."*
- **Missing tribute fodder:** *"The grave demands N troops in tribute — summon free hands first."*
- **Full 3-lane board:** *"All three lanes are packed — attack or tribute a troop first."*
- **Trap row full:** *"Both trap slots are rigged — let a fool step in one first."*
- **Gear with empty board:** *"Ghost holster — summon a troop first so somebody can wear it."*
- **Spell with no target:** *"Nothing undead or breathing to hex — summon a troop or press End turn."*

Verified in [`tests/match/haunted-mischief.test.js`](../../tests/match/haunted-mischief.test.js) (`HSM-1`, `HSM-2`), including invariance under hidden opponent hand/deck/trap permutations.

## 2. Headless Chrome 8-Route WCAG & AXTree Audit (`HSM-3`)

Executed [`scripts/browser-accessibility-audit.mjs`](../../scripts/browser-accessibility-audit.mjs) against `dist/web` staged at `93db9f3` (`index.html` SHA-256 `52a9d08c62e5a848d1ee7751bc12113c9f6d5c2c1e08c943f1bc0586852da6da`) with `prefers-reduced-motion: reduce` enabled:

| Route | ID | AXTree Nodes | Live Regions | Violations |
| --- | --- | ---: | ---: | ---: |
| `/cowboys-vs-wizards/` | `title-3d` | 22 | 3 | `0` |
| `/cowboys-vs-wizards/?saloon=review` | `saloon-review` | 139 | 12 | `0` |
| `/cowboys-vs-wizards/?outrider=case-e` | `outrider-challenge` | 219 | 6 | `0` |
| `/cowboys-vs-wizards/?room=replay` | `replay-room` | 71 | 5 | `0` |
| `/cowboys-vs-wizards/?even-fight=1` | `even-fight` | 313 | 6 | `0` |
| `/cowboys-vs-wizards/graybox/` | `graybox-title` | 17 | 3 | `0` |
| `/cowboys-vs-wizards/showdown/` | `reference-showdown` | 163 | 2 | `0` |
| `/cowboys-vs-wizards/poker/` | `boot-hill-poker` | 406 | 2 | `0` |

All `8` routes passed with `0` unnamed visible controls, `0` broken `aria-labelledby` / `aria-describedby` references, `0` duplicate element IDs, and `0` console or HTTP errors.
