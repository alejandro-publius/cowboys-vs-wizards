# Design: Haunted Saloon Mischief & Accessibility Audit (`HSM-1`–`HSM-3`)

## 1. Mischievous Refusal Copy With Next-Tap Guidance (`src/ui/showdown-screen.js`)

Export a pure helper `blockedReason(view, seat, cardId)` from `src/ui/showdown-screen.js` and delegate `blocked(view, cardId)` to it:

- After an attack (`view.attacking`): `"Gunsmoke's out — no more cards this turn. Act with your troops or press End turn."`
- Second summon (`view.summonUsed`): `"One troop a turn."` *(preserved verbatim for existing browser regression `scripts/browser-showdown-check.mjs`)*.
- Insufficient tributes: `` `The grave demands ${plural(cost, "troop")} in tribute — summon free hands first.` ``
- Full 3-slot board: `"All three lanes are packed — attack or tribute a troop first."`
- Second trap (`view.setUsed`): `"One trap a turn — save that ambush for next round."`
- Full trap row (`traps.length >= TRAP_SLOTS`): `"Both trap slots are rigged — let a fool step in one first."`
- Other blocked trap: `"Hold that ambush for your main phase."`
- Second spell/gear/location (`view.castUsed`): `"One spell, gear or location a turn — act with your troops or press End turn."`
- Duplicate location: `"That haunted ground is already in play — pick another card or attack."`
- Gear with empty board: `"Ghost holster — summon a troop first so somebody can wear it."`
- Spell with no valid target: `"Nothing undead or breathing to hex — summon a troop or press End turn."`

## 2. Zero-Dependency Headless Chrome Accessibility Audit (`scripts/browser-accessibility-audit.mjs`)

Following the repository's zero-new-dependency constraint (`AGENTS.md`), `scripts/browser-accessibility-audit.mjs` serves `dist/web` on loopback and drives native headless Chrome over the DevTools protocol (`Accessibility.getFullAXTree` + DOM/computed-style checks) across all 8 public routes, checking:

1. `document.documentElement.lang` is present and `<title>` is non-empty.
2. Every visible interactive element (`button`, `a[href]`, `input`, `select`, `textarea`, `summary`) has a non-empty accessible name in Chrome's AXTree or DOM label.
3. Every `aria-labelledby` and `aria-describedby` ID token resolves to an existing element in the document.
4. No duplicate element `id` attributes exist on the page.
5. `prefers-reduced-motion: reduce` is honored without runtime errors.
6. Zero uncaught exceptions, console errors, or in-project HTTP `>=400` responses.
