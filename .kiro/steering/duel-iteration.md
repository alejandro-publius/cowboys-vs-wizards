---
inclusion: fileMatch
fileMatchPattern: ["src/match/**", "src/render/**", "src/ui/**", "scripts/browser-match-check.mjs", "assets/cards/**"]
---

# Duel iteration

Use for quick changes to match presentation, card art or the browser route.
README.md has the build command and check table. For Showdown screens and
their checks, use the Showdown rows in `docs/AGENT-ROUTER.md`; the current
release state is in `docs/design/release-line.md` ("Current status") and issue
143. The contracts below are the lane duel's, which since slice 3 runs only in
the earlier illustrated 3D build (`src/main.js`, served at `/3d/`), not in the
graybox.

## Contracts to keep

- The engine owns outcomes. Keep DOM, rendering and asset imports out of
  `src/game/`. Present the engine's before and after values at impact.
- The UI, presenter and CPU read the public view for their side. The opponent's
  hand shows card backs.
- Apply each action once. The match epoch governs timers, animations and CPU
  requests. Include a cancellation check when changing those interactions.
- Reuse the eight approved fronts and the deck back when changing playback or
  inputs. Verify the original exchange at `?mode=demo` after a mode change.
- Dragon and Mounted Billy use fitted GLBs with authored attack clips;
  Skeleton uses its optimized Tripo mesh. Sheriff uses a procedural rig and
  revolver cue. Keep the original exports and browser timing intact.

## Iterate cheaply

1. Run the one test file closest to the change, for example
   `node --test tests/match/presenter.test.js`, before any build.
2. Run `npm run build` and the browser check only for a change that affects
   the page. The coordinator owns builds and browser runs when a task says so.
3. Reuse the existing checks. Do not add a new script when an existing one
   covers the case.

## Report once

State the seed (browser route: `?seed=0`), the rules version, the exact commands
run and their actual results. Mark unrun checks as pending. Link the output in
`docs/evidence/` instead of describing the same check again, and update one
entry in `docs/kiro-build-log.md`. A scripted browser run supports claims about
flow and positions. Claims about appearance need rendered review, and claims
about clarity or fun need a human playtest.
