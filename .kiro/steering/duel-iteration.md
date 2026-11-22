---
inclusion: fileMatch
fileMatchPattern: ["src/match/**", "src/render/**", "src/ui/**", "scripts/browser-match-check.mjs", "assets/cards/**"]
---

# Duel iteration

Use for quick changes to match presentation, card art or the browser route.
README.md has the build command and check table. For Showdown screens and
their checks, use the Showdown rows in `docs/AGENT-ROUTER.md`; the current
release state is in `docs/design/release-line.md` ("Current status") and issue
143. With PR 186, `/` starts the illustrated
Showdown (`src/ui/showdown-3d`) with Ride or Fight? first and Camp secondary,
`/3d/` is a byte-identical copy of it, `/graybox/` stages the same game in the
lightweight graybox with direct Camp entry, and `/showdown/` is the reference.
The lane duel and its standalone lane-based 3D build are retired: old
`?mode=` URLs land on Showdown, and the last lane and lane 3D source is at
commit `ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df`. Do not work on lane paths
or the lane 3D build unless the user reopens them.

## Contracts to keep

- The engine owns outcomes. Keep DOM, rendering and asset imports out of
  `src/game/`. Present the engine's before and after values at impact.
- The UI, presenter and CPU read the public view for their side. The opponent's
  hand shows card backs.
- Apply each action once. The match epoch governs timers, animations and CPU
  requests. Include a cancellation check when changing those interactions.
- Preserve the approved card art and source assets in `assets/` (models,
  clips, card paintings). Dragon and Mounted Billy GLBs contain authored attack
  clips; keep the original Tripo exports intact.
- Historical (lane build only, at the commit above): the eight lane fronts and
  deck back, the `?mode=demo` attack exchange, and the Sheriff procedural rig.

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
