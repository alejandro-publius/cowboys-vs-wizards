# Escape cancels the current card choice

Date: 2026-11-16 (America/Los_Angeles).

## Change

The existing match Escape handler now cancels only while the controller accepts player input and has a cancellable selection. It ignores editable targets, open native dialogs, repeated/composing/already-handled key events, idle selections and playback. Only a real cancellation prevents the browser default. The cancel button keeps its existing behavior.

No art, animation, engine rules, CSS or dependencies changed.

## Authorship

Fable 5.2 inspected the existing handler and drafted the focused browser scenario in its signed-in Claude Code terminal. Fable then reached its five-hour usage limit. Codex completed the handler guards, strengthened the text-entry assertion to require preserving the selection, and ran the final checks. This is shared work, not a Fable-only implementation.

## Verification

- `node scripts/build.mjs`: exit 0.
- `node scripts/browser-match-check.mjs --escape --summary`: exit 0.
- Native Chrome 157 / Apple M1 / seed 0 / 1440 × 900: both steps observed; all 12 checks true; no console errors or warnings.
- Covered card selection, chosen destination, idle Escape, menu/card-art dialog dismissal, focused input, click cancellation and playback through the next Cowboy turn.
- Hand, lanes, decks, life orbs and round/phase stayed unchanged during cancellation and dialog/text-entry checks.
- This focused check does not replace the full-match browser replay.

Build SHA-256: `b390b5f704978cef0cf177e9c2638bc7e039a2f15a4dc6f8fbda2e75cdc83072`.

Detailed local receipt: `.artifacts/fable-escape-cancel/browser/browser-run.json`. Build/browser command exits: `.artifacts/fable-escape-cancel/codex-verification/result.json`.
