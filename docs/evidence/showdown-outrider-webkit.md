# Outrider turns in Playwright WebKit: touch and keyboard (K-011, K-084, K-098)

Script: [`scripts/browser-showdown-outrider-webkit.mjs`](../../scripts/browser-showdown-outrider-webkit.mjs).
Baseline: #169 (WebKit Guard keyboard check) and #173 (both Outrider links in Chrome,
`scripts/browser-showdown-outrider-check.mjs`). This adds what those did not drive in WebKit: a real
Outrider decision by touch and another by keyboard, with the resulting board checked against the engine.

Run by Kiro CLI on 2026-11-20 (America/Los_Angeles), commit `dc0bf91` plus this script, `src/` unchanged.

```sh
npm run build
node scripts/browser-showdown-outrider-webkit.mjs dist/cowboys-vs-wizards-board-duel.html [--out DIR]
# or: npx -y -p playwright-core@1.64.1 node scripts/browser-showdown-outrider-webkit.mjs <built html>
```

The script uses `playwright-core` from PATH when present, otherwise the untracked local
`node_modules/playwright` (1.62.1 here). It adds no dependency. Raw report and screenshots go to
`.artifacts/showdown-outrider-webkit/`, which git ignores.

## Conditions

- Engine: Playwright WebKit 26.5 on macOS 15 (Darwin 24.1.0, arm64). This is not Safari, not an iPhone, and not a human test.
- Entry: the built graybox served over loopback HTTP at `/`. Each run uses a fresh context; Play opens the Camp.
- Gate: 10 of 10 fresh, linked case-a and case-e. Camp control = case-e.
- Expected boards: replayed in Node with the same engine (`outriderDuel`, `createShowdownSession`, then the case's arm).
- Touch run: 375x667, `isMobile` and `hasTouch`, DPR 2. Every input is `page.touchscreen.tap` at the button's
  centre after a hit test (the centre is in the viewport and `elementFromPoint` returns the button). The
  user agent stays the desktop WebKit one. This is emulation, not a phone.
- Keyboard run: 1440x900. Every input is a key press. Plain Tab reached no button in this WebKit (focus
  stayed on BODY), so the run used Option+Tab and Enter. #169 recorded the same behaviour.

## Observed (two consecutive passing runs)

| Run | Case / arm | What was checked |
| --- | --- | --- |
| touch | case-e, fight | Camp shows one control. Tapping the Ledger shows links for case-a and case-e, with results hidden and absent from the DOM. Landing board equals the engine. Tapping the Outrider offers exactly the engine's targets: Base "Ride past: Hit the Base for 1" and Skeleton "Survives on 2 and hits back: yours drops to 1". Each target has `aria-describedby=sd-prompt`. The tap on the Skeleton gives Skeleton 2 of 3, Outrider 1 of 3 and Wizard Base 4 of 4, equal to the engine. The duel was played out by tapping End turn. Retry reopens the landing. Back to camp returns focus to the Camp control, in view. The saved career is byte-identical. Every tap had pointerType `touch`. The smallest tapped box was 55x40 px. |
| keyboard | case-a, ride | Opened from the Ledger link. Enter on the Outrider moves focus to the Wizard Base, which is described by the prompt. Offered: Base, Wizard, Skeleton ("Defeated"). Enter on the Base gives Wizard Base 3 of 4 with Wizard 3 of 4 and Skeleton 1 of 3, equal to the engine. The duel was played out with End turn. Retry and Back to camp work, and focus returns to the case-a Ledger link. The saved career is byte-identical. |

Both runs also checked the following. No measured result text appears in the DOM before a reveal (the
reveal was never pressed). No Wizard card face appears in the hand row. The number of Wizard card backs
equals the hand count. Every orb label is `n of m` with 0 ≤ n ≤ m, at every play-out step. There were no
page or console errors.

## Controls (defect detection)

The same flows ran on in-memory copies of the page, each with one injected defect. Nothing was written to disk.
Every defect failed at the expected check. A defect that went undetected would fail the run.

| Control | Defect | Detected as |
| --- | --- | --- |
| touch/covered | transparent element over the Skeleton target | `covered by defect-cover` |
| touch/offscreen | Skeleton target moved to x = -5000 | `offscreen (centre -4861,68)` |
| touch/wrong-target | tap on the troop delivered as Base | `board after the fight differs` |
| keyboard/wrong-target | Enter on the Base delivered as troop 0 | `board after the ride differs` |

## Limits

- No UI fix was needed. `src/ui/outrider-*` is unchanged.
- One fixed arm per run. Outcomes after the first action are not judged here; the Node gate judges them.
- The keyboard flow checks focus visibility. The covered-target and offscreen negative controls ran on the touch path.
- Descriptions are read from DOM `aria-describedby`, because this WebKit build has no native accessibility tree.
- Option+Tab stands in for Safari's "Press Tab to highlight each item" setting.
- Not covered: native Safari, iOS, real touch hardware, screen readers, and human clarity or fun.
