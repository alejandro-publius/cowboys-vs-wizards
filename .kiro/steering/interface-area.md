---
inclusion: fileMatch
fileMatchPattern: ["src/app.js", "src/ui/**", "prototypes/showdown/main.js", "prototypes/showdown/index.html", "scripts/browser-*.mjs", "scripts/check-match-ui.sh"]
---

# Interface area

- Read the public view for the player's side only. The opponent's hand shows card backs.
- Showdown screens (`src/ui/showdown-*.js`) read their seat's view through `src/match/showdown-session.js` (`viewFor` in `src/game/showdown/contract.js`); check with `node --test tests/match/showdown-session.test.js tests/match/showdown-cues.test.js`.
- Routes with PR 186: `/` starts the illustrated Showdown (`src/ui/showdown-3d`) with the Ride or Fight? challenge and Camp secondary; `/3d/` is a byte-identical copy of that build; `/graybox/` stages the same game in the lightweight graybox with direct Camp entry; `/showdown/` is the reference page.
- The lane duel and its lane-based 3D build are retired; old `?mode=` URLs land on Showdown. Their last source is at commit `ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df`. Do not change lane screens unless the user reopens them.
- Accept player input only through the controller's accepted actions; the match epoch cancels stale timers.
- Preserve the approved card art in `assets/`. No new visuals without a plan agreed with the user.
- Art-first minimal copy: let painted cards, 3D board pieces, and pixel stages speak first. Keep visual HUD prompts under 10 tokens, omit labels on empty 3D zones, use compact icon badges on painted card faces, and tuck secondary audit prose into drawers while preserving full accessible descriptions in `#sd-prompt` and `.table-card-original`.
- Browser checks: run the one script for the changed screen (`scripts/browser-*.mjs`, `scripts/check-match-ui.sh`). Human clarity claims need a playtest.
