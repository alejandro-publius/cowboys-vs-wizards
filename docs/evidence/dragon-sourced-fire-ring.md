# Dragon sourced fire-ring preview
November 16, 2026. User rejected both the winged Dragon clip and restrained neck nod. Both are rejected; this fire-ring replacement is pending review.

## Visible result
The original Dragon stands in its unchanged bind pose. No animation mixer plays on it, so there is no nodding or wing flapping. A low circular arrangement of 24 transparent Sprite Fusion fire emitters surrounds its feet, with the library's flames, flicker, smoke and embers. No opaque panel is introduced.

## Source
Hugo Duprez / Sprite Fusion, MIT License.
https://www.spritefusion.com/pixel-art-vfx/fire
Download: https://www.spritefusion.com/downloads/pixel-art-vfx/fire.zip
Unmodified vendor/spritefusion/fire.ts SHA-256:
03b6b1a0693d8d947f566b0d2f54376f161854b37f8221b3f942f75b84f5956f

The vendor file is byte-for-byte unchanged. Full MIT notice is retained. The adapter only supplies the source's box/size/duration/seed options, advances playback, and places transparent textures around a circle in the real board scene. Flame geometry, flicker, smoke and spark motion are all from the external effect. It is an external code-rendered pixel effect, not a newly drawn asset or a Blender animation.

## Implementation
- src/render/sourced-fire-ring.js: 24 placements sharing four phased source simulations, fixed1/60s playback, deterministic reset for capture. Source size1.25, seeds17-20; continuous duration while present. Resizing/placement does not rewrite source effect logic.
- Preview uses existing board meshes, materials, lighting and Dragon asset.
- Character preview --fire-ring mode suppresses animation playback entirely. Per-frame assertion checks every Dragon bone's position/quaternion/scale against the starting bind pose.
- Oversized additive sprite glow was excluded after visual review because its texture bounds were visible and it obscured the model.

## Reproduce
node scripts/build-character-motion-preview.mjs assets/models/dragon.glb .artifacts/dragon-sourced-fire dragon --fire-ring
node scripts/record-character-motion-preview.mjs --out-dir .artifacts/dragon-sourced-fire --close-only

## Verification and status
Four board phase previews reviewed: fire surrounds the feet, face/body remain legible, no opaque UI boxes or background rectangles.
Source hash matches downloaded archive; original Dragon GLB untouched.
Captured120 frames /4seconds at1280x720,30fps. Zero runtime errors; every-frame no-bone-motion assertion passed. H.264 export decoded successfully. Video SHA-256 c5757a56e3ac618733be98ece4aa272292784283348cb5e2a5f0d783fc751bce.
No live match replacement, merge to main, push or deployment. User visual approval remains pending.
Kiro receives separate provenance/review-state handoff; Sprite Fusion owns the effect and Codex owns the integration.
