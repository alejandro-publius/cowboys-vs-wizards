# Independent coordinator verification — trap DOM parity (#131)

Date: November 17, 2026 PST. Original Cowboys vs Wizards, not retro. Kiro CLI 3.4.0 V3 authored source/test/evidence at commit `26e9e8f`, explicitly requesting `--model claude-opus-5.5`. Its own V3 stream reported 26.04144861558872 session credits. Coordinator review and browser replay below are independent of Kiro; no claim of independently observed backend-model identity.

## Scoped diff

Only three new verifier files are Kiro-authored: `scripts/browser-trap-parity-131.mjs`, `tests/match/trap-dom-parity.test.js`, and `docs/evidence/kiro-trap-dom-parity-131.md`. This coordinator-only note and a correction to the Kiro session attribution were added separately. No changes to shipped `src/`, decks, card content, effects, models, sound, art, CI, packages, or public deployment.

## Independent checks

- `node --test tests/match/trap-dom-parity.test.js`: **6/6 pass** (seed 0 and 60 mirror deterministic/accepted actions; structural mutations caught; hidden Wizard fixture trap redacted)
- `npm test`: **329/329 Node tests pass**, zero failures/skips; the existing GLB structural preflight passes (not visual-quality proof)
- `npm run build -- --web`: successful, with a temporary symlink to existing main checkout dependencies removed immediately afterward; no installation
- `node scripts/check-links.mjs`: 187 Markdown files, 686 relative links and images, **0 broken** before adding this note
- `git diff --check origin/main`: clean

## Independently reproduced real Chrome run

Command: `node scripts/browser-trap-parity-131.mjs --out /tmp/cvw-131-independent-chrome.json`

- **pass: true**, **0 engine/DOM mismatches**, **0 console errors**, **0 external requests**; Chrome/157.0.8103.79 headless, about 44.8 seconds
- Seed 0: **7** stable checkpoints, **6** recorded real-input actions, Wizard synthetic trap remained concealed at two checkpoints and triggered once
- Seed 60: **11** stable checkpoints, **10** recorded real-input actions, Cowboy synthetic trap set via card and Confirm and triggered once
- Both seeds: engine `publicState`, the lab page's public view, and the compared rendered fields agreed at stable checkpoints, excluding the separately reported terminal label
- Digest `5ed6ca24e0762e843034647f5161eaa811972d27a0f5b3b84762d0b4d52bae5a`, identical to both of Kiro's previous real-Chrome receipts; local raw JSON SHA-256 `7ce3689515be2e12b270ebbb41eb09f462f7f16308ae079527cc9b626e229000` (raw receipt not committed)

## Separate reproducible finding — no runtime fix in this PR

At terminal on both seeds, the developer lab still displays `Phase: Wizard` although the engine `activeSide` is `null`. The script reports this exactly as a **known finding**, not a silent pass or general engine/DOM mismatch. This is a localized terminal-label UI discrepancy, not proof of a broken combat result. A separate scoped issue should own any `experiments/trap-placeholder/app.js` fix and review.

## Boundaries

The CDP debugger captures stable post-render snapshots only. It does not prove the timing or visual quality of intermediate animations, inaccessible browser closure state, production 3D playback, real-device Safari, human gameplay, or competitive balance. The independent Node mirror infers browser-hidden state through matching deterministic public traces. Default game remains unchanged with AX traps off; T0 shipped trap-card/deck approval is still blocked.
