---
inclusion: fileMatch
fileMatchPattern: ["src/match/**", "src/render/**", "src/ui/**", "scripts/browser-match-check.mjs", "assets/cards/**"]
---

# Duel iteration

Use for quick changes to match presentation, card art or the browser route.
README.md has the build command and check table.

## Contracts to keep

- Engine: `src/game/` decides outcomes and has no DOM, rendering or model
  imports. Presentation shows the engine's `before` and `after` values and
  never computes damage.
- Public views: the UI, presenter and CPU read `publicState` for their side
  only. The Wizard hand shows card backs.
- Accepted actions: the controller applies one action once. Input during
  playback or the CPU turn reaches no engine call. Timers, animations and CPU
  requests carry the match epoch, so a restart cancels them.
- Art: eight card faces in `assets/cards/` map one-to-one to `CARDS` names.
  The deck back is `card-back.png`. Do not edit approved art or the original
  attack exchange (`?mode=demo`) for a presentation change.
- Models: GLBs are static exports. Mounted Billy and Skeleton are temporary
  tokens until models exist. Do not present them as finished.

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
