# Haunted Saloon Mischief & Route Accessibility Audit

## Introduction

Costume Contest interfaces succeed when spooky personality clarifies what to do next rather than obscuring controls. In `src/ui/showdown-screen.js`, unplayable hand cards display `blocked(view, cardId)` refusal notes (surfaced inline in the graybox and as `title` tooltips on painted 3D cards in `table-ui.js`). Upgrading those refusal notes to concise haunted-Western quips paired with an explicit next action gives players a smile and an immediate next tap while preserving every existing contract string (`"One troop a turn."`, `"Nobody attacks on the opening turn"`, `"A Guard stands in the way: attack it first."`, and `"This troop cannot attack now."`). Alongside the copy upgrade, `scripts/browser-accessibility-audit.mjs` audits all public Showdown, Saloon, Graybox, Reference, and Boot Hill Poker routes in headless Chrome for WCAG 2.2 AA / AXTree invariants.

## Requirements

- HSM-1: WHEN a hand card in Showdown is unplayable because a troop has already acted, tribute fodder is missing, the board or trap slots are full, or a spell/gear/location has no valid target, THE Showdown screen SHALL display a haunted-Western refusal reason that also names a valid next step while keeping `"One troop a turn."` unchanged after a summon.
- HSM-2: THE `blockedReason(view, seat, cardId)` helper in `src/ui/showdown-screen.js` SHALL depend only on the active seat's public view (`viewFor`) and SHALL never read hidden opponent hand, deck, or trap identities.
- HSM-3: WHEN `scripts/browser-accessibility-audit.mjs` audits the staged Pages build across `/`, `/?saloon=review`, `/?outrider=case-e`, `/?room=replay`, `/?even-fight=1`, `/graybox/`, `/showdown/`, and `/poker/`, THE audit SHALL verify zero unnamed interactive controls, zero broken `aria-labelledby` / `aria-describedby` references, unique `<main>` landmarks on Showdown shells, polite `aria-live` / `role="status"` announcements, and zero console or HTTP errors.
