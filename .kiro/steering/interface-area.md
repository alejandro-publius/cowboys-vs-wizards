---
inclusion: fileMatch
fileMatchPattern: ["src/ui/**", "src/profile/**", "src/main.js", "index.html", "scripts/browser-*.mjs", "scripts/check-match-ui.sh"]
---

# Interface area

- Read the public view for the player's side only. The opponent's hand shows card backs.
- Showdown screens (`src/ui/showdown-*.js`) read their seat's view through `src/match/showdown-session.js` (`viewFor` in `src/game/showdown/contract.js`); check with `node --test tests/match/showdown-session.test.js tests/match/showdown-cues.test.js`.
- In the lane duel (the earlier 3D build at `/3d/` only; the graybox is Showdown only), keep the visible deck, hand, three lanes per side and one-to-five life orbs readable.
- Accept player input only through the controller's accepted actions; the match epoch cancels stale timers.
- In the lane duel, reuse the eight approved card fronts and the deck back. No new visuals without a plan agreed with the user.
- Browser checks: run the one script for the changed screen (`scripts/browser-*.mjs`, `scripts/check-match-ui.sh`). Human clarity claims need a playtest.
