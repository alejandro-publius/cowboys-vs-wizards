# Devpost 3:2 Gallery Stills & Official Rules Form Q&A (`#38`)

- **Author / Tooling:** Antigravity (feature branch `antigravity/devpost-gallery-and-rules-qa-38`). No native Kiro CLI session is claimed in this note.
- **Spec:** [`.kiro/specs/devpost-gallery-and-rules-qa/requirements.md`](../../.kiro/specs/devpost-gallery-and-rules-qa/requirements.md) (`DGR-1..DGR-6`).
- **Addresses:** Gallery images, 8-topic sub-questions, pre-existing work disclosure template, and video trademark check from [`docs/submission/rules-check.md`](../submission/rules-check.md) / Issue [#38](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/38), without modifying `docs/submission/devpost-packet.md`.

## Captured Artifacts (`1200x800`, `3:2` PNGs)

Captured from `dist/web/` staged at commit `93db9f3e2f3970ec8b391650199027eac1d252db` (`index.html` SHA-256 `426092c5b9ea30c70afc78935db424b36f4487fcf2b44673323185eae6cc1f41`) with zero console or page errors:

1. [`01-title-and-challenge.png`](devpost-gallery/01-title-and-challenge.png) (`1,437,362` bytes)
2. [`02-saloon-billy-courtroom.png`](devpost-gallery/02-saloon-billy-courtroom.png) (`343,640` bytes)
3. [`03-outrider-3d-bone-fence.png`](devpost-gallery/03-outrider-3d-bone-fence.png) (`234,330` bytes)
4. [`04-even-fight-tactical-duel.png`](devpost-gallery/04-even-fight-tactical-duel.png) (`822,193` bytes)
5. [`05-boot-hill-poker-frontier-kit.png`](devpost-gallery/05-boot-hill-poker-frontier-kit.png) (`536,378` bytes)
6. [`manifest.json`](devpost-gallery/manifest.json)

## Reproduce

```sh
node scripts/stage-pages.mjs --commit 93db9f3e2f3970ec8b391650199027eac1d252db
node scripts/capture-devpost-gallery.mjs --verify
node --test tests/assets/devpost-gallery.test.js tests/assets/links.test.mjs tests/game/dec4-trace.test.js tests/game/dec4-scorecard.test.js
```
