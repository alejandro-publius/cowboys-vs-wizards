---
inclusion: fileMatch
fileMatchPattern: ["src/app.js", "src/ui/**", "prototypes/showdown/main.js", "prototypes/showdown/index.html", "scripts/browser-*.mjs", "scripts/check-match-ui.sh"]
---

# Interface area

- Read the public view for the player's side only. The opponent's hand shows card backs.
- Showdown screens (`src/ui/showdown-*.js`) read their seat's view through `src/match/showdown-session.js` (`viewFor` in `src/game/showdown/contract.js`); check with `node --test tests/match/showdown-session.test.js tests/match/showdown-cues.test.js`.
- The illustrated Showdown at `/` and its byte-identical copy at `/3d/` offer the Night Shift Saloon, Ride or Fight? and Camp. The lightweight build at `/graybox/` opens Camp from Play. The reference page lives at `/showdown/`.
- The lane duel and its lane-based 3D build are retired; old `?mode=` URLs land on Showdown. Their last source is at commit `ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df`. Do not change lane screens unless the user reopens them.
- Accept player input only through the controller's accepted actions; the match epoch cancels stale timers.
- Preserve the approved card art in `assets/`. No new visuals without a plan agreed with the user.
- The Saloon opens at the playable character book. Use the duel hand's exact portrait for each card and keep its Play card action within reach on the first screen.
- Keep the illustrated table's aiming cues short enough to scan. Show the legal target, cover choice, face-down trap timing and Raise outcomes when they affect the decision. Keep the full prompt on the keyboard controls through `#sd-prompt` and hand text in Hand rules.
- Paint counts only on occupied 3D stacks. Preserve each seat's public zone counts and access to occupied graveyards.
- Browser checks: run the one script for the changed screen (`scripts/browser-*.mjs`, `scripts/check-match-ui.sh`). Human clarity claims need a playtest.
