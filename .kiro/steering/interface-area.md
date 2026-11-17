---
inclusion: fileMatch
fileMatchPattern: ["src/ui/**", "src/profile/**", "src/main.js", "index.html", "scripts/browser-*.mjs", "scripts/check-match-ui.sh"]
---

# Interface area

- Read the public view for the player's side only. The opponent's hand shows card backs.
- Keep the visible deck, hand, three lanes per side and one-to-five life orbs readable.
- Accept player input only through the controller's accepted actions; the match epoch cancels stale timers.
- Reuse the eight approved card fronts and the deck back. No new visuals without a plan agreed with the user.
- Browser checks: run the one script for the changed screen (`scripts/browser-*.mjs`, `scripts/check-match-ui.sh`). Human clarity claims need a playtest.
