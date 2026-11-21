---
inclusion: fileMatch
fileMatchPattern: ["src/ui/**", "src/profile/**", "src/main.js", "index.html", "scripts/browser-*.mjs", "scripts/check-match-ui.sh"]
---

# Interface area

- Read the public view for the player's side only. The opponent's hand shows card backs.
- Showdown screens (`src/ui/showdown-*.js`) read their seat's view through `src/match/showdown-session.js` (`viewFor` in `src/game/showdown/contract.js`); check with `node --test tests/match/showdown-session.test.js tests/match/showdown-cues.test.js`.
- The lane duel and its 3D build are retired; `/3d/` redirects to `/` and serves no second game. Its last source is at commit `ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df`. Do not change lane screens unless the user reopens them.
- Accept player input only through the controller's accepted actions; the match epoch cancels stale timers.
- Preserve the approved card art in `assets/`. No new visuals without a plan agreed with the user.
- Browser checks: run the one script for the changed screen (`scripts/browser-*.mjs`, `scripts/check-match-ui.sh`). Human clarity claims need a playtest.
