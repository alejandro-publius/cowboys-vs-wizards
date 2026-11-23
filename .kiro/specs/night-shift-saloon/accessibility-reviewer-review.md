# Accessibility review: Night Shift saloon

Status: open

Findings as recorded below: A1, A2 and A3 are open; A4 is answered.
This line was added on 2026-11-22 (America/Los_Angeles) by the native Kiro
proof-scorecard pass so the scorecard can read the outcome. The findings below
are unchanged.

Reviewer: one native Kiro CLI agent (model `claude-opus-5.5`) working in the
`12-expert-reviews` worktree. The same agent wrote every review in this panel,
each through a different lens.

Method: read requirement 7, the tasks evidence, and the markup and strings in
[`src/ui/showdown-3d/night-shift-saloon.js`](../../../src/ui/showdown-3d/night-shift-saloon.js)
and [`outpost.css`](../../../src/ui/showdown-3d/outpost.css). No browser,
screen reader or command ran in this pass. Findings about what users hear
still need a screen-reader check, and findings about appearance need a
rendered review.

## A1. The spoken event sentence for a proposal has no direction word

- **Question:** Requirement 1.3 asks for the proposal "with the direction in
  words". Requirement 7.2 announces each new event in the polite region. Does
  the announced sentence carry the direction?
- **Record:** `night-shift-saloon.js`:
  - `deed()`, the `cast` branch at line 70, returns
    `` `Proposes ${card} ${field} ${before} → ${after} (scratch, not merged)` ``.
  - `describe()` prefixes the role.
  - Line 539, `now.textContent = describe(event)`, writes this to the
    `role="status" aria-live="polite"` element at line 297.
  - Only `proposalText()` (lines 219–222) adds `raised`, `lowered` or
    `unchanged`, and that text goes to the notice board, not the live region.
- **Observed (from the strings):** For the recorded `cast` event, the polite
  region receives "Wizard: Proposes Billy attack 2 → 1 (scratch, not
  merged)". The direction depends on how a screen reader speaks "→", which it
  may read as "right arrow" or skip.
- **Status:** open.
- **Acceptance check:** `describe()` for a `cast` (and for a `patch`)
  contains `lowered` or `raised`. A unit test asserts this for
  `{card: "cowboy-billy", field: "attack", before: 2, after: 1}`. A
  VoiceOver or NVDA pass on the recorded replay confirms the spoken sentence.

## A2. Each actor's caption is an `<output>`, which may make a second live announcement

- **Question:** Does one event produce one announcement?
- **Record:** The actor loop in `mountNightShiftSaloon` creates
  `document.createElement("output")` (class `saloon-actor-doing`) for each of
  the four actors. Line 473 rewrites it with `deed(event)` on every render.
  Under HTML-AAM, `<output>` maps to the `status` role, which has an implicit
  `aria-live="polite"`.
- **Observed:** Not run. By the mapping, a new event updates two status
  regions: `.saloon-now` with "Wizard: Proposes …" and the Wizard's `<output>`
  with "Proposes …". Some screen readers will speak both.
- **Status:** open (needs an assistive-technology check).
- **Acceptance check:** A screen-reader pass stepping through all 5 recorded
  events hears exactly one sentence per event. If it hears two, the actor
  caption becomes a non-live element (for example `<p>`) or gets
  `aria-live="off"`. A DOM test then asserts that `.saloon-now` is the only
  live region inside `.saloon-room`.

## A3. The reduced-motion evidence shows the media setting, not still miniatures

- **Question:** Requirement 7.3 says the miniatures SHALL hold still. What
  does the evidence show?
- **Record:** In tasks.md the line is "Reduced-motion pass: both mobile runs
  used `prefers-reduced-motion: reduce`". The code paths are
  `outpost.css` line 1083 (`@media (prefers-reduced-motion: reduce)` on
  `.saloon-room *`) and
  [`saloon-stage.js`](../../../src/ui/showdown-3d/saloon-stage.js) line 371
  (`matchMedia("(prefers-reduced-motion: reduce)")`).
- **Observed:** The checked item records that the preference was set. It does
  not record that anything stayed still. No desktop or 3D-stage run with the
  preference is listed.
- **Status:** open (evidence gap).
- **Acceptance check:** One scripted run at 1280×800 with
  `prefers-reduced-motion: reduce` steps all 5 events. For each step it
  records that the 3D stage's actor transforms are unchanged and that no CSS
  animation or transition is running in `.saloon-room`. A rendered screenshot
  goes under `docs/evidence/`.

## A4. Passed reading: keyboard reach, focus styles and fallback text exist

- **Record:**
  - The Play, Step and Replay controls are native `<button type="button">`
    elements. The history and repair sections are `<details>`/`<summary>`.
  - `outpost.css` lines 716–718 give `.saloon-room button:focus-visible` a
    3 px `#ffe2a3` outline. Lines 736–739 do the same for the summaries, and
    line 556 covers the patch link.
  - The 3D host is `aria-hidden="true" inert`, and the bell is
    `aria-hidden`.
  - `setView` keeps focus inside the controls when they move.
  - The tasks evidence records keyboard stepping of all 5 events and Escape
    returning focus to the Camp button at three viewport sizes.
- **Status:** answered for keyboard operation. Focus-ring contrast is
  pending a rendered review.
- **Acceptance check:** A rendered screenshot of each focused control
  measures the outline against its background at a 3:1 contrast ratio or
  better, per WCAG 2.2 SC 1.4.11.
