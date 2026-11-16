# Sheriff sourced standing idle preview
Prepared November 16, 2026. Isolated preview; the public game is unchanged.

The user liked the sourced walk but asked for the Sheriff to remain on his tile without walking in place. This preview applies the existing Mixamo idle clip to the same Tripo Sheriff and existing game rig. The approved walk reference is preserved separately. The user rejected this preview as visually still. It is not an accepted idle choice.

## Source and transformation
- Character: unchanged assets/models/sheriff.glb, the user's Tripo Sheriff.
- Motion: the 2.5-second idle clip from https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/models/gltf/Xbot.glb.
- Attribution: Mixamo, as credited by https://threejs.org/examples/webgl_animation_skinning_additive_blending.html.
- Usage terms: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html. The three.js MIT code license does not relicense the motion.
- Reuses the existing source-to-Sheriff joint mapping. No handmade poses, keyframes, procedural breathing or new visual assets were added.
- Uses the actual board, tile, ground texture, lighting, shadow renderer and close-up camera. Only whole-actor vertical seating adjusts the exported pose to the tile.

## Validation and deliverable
- Three.js r180 imported and played the 16-bone, 28,252-vertex GLB.
- Six samples spanning the idle cycle passed finite deformed vertices, valid tracks, non-static joint transforms, independent instances and deterministic replay.
- Captured 75 frames of the complete idle cycle, with zero browser runtime exceptions. Minimum sampled supporting boot clearance was 0.003 world units.
- Reviewed close-up frames at 0.24 and 1.23 seconds. This is a subtle standing idle, not a new reaction or attack.
- Video: Sheriff-idle-on-board.mp4, 1280 by 720, 30 fps, 150 frames, five seconds; two repetitions of the captured cycle. H.264 export passed full decoding.
- SHA-256: d06f189506692f530561f0d7dfde8b27dd97a60f3e9c9cf5b9320cee0e3ebc3a.

Reproduce:
1. node scripts/retarget-sheriff-source-clip.mjs tmp/sourced-motion idle
2. node scripts/check-sheriff-source-clip.mjs tmp/sourced-motion idle
3. node scripts/build-sheriff-board-preview.mjs tmp/sourced-motion/sheriff-mixamo-idle-preview.glb .artifacts/sheriff-idle-board-preview
4. node scripts/record-sheriff-board-preview.mjs --out-dir .artifacts/sheriff-idle-board-preview --close-only

The clip has not been connected to live match states or deployed. Existing coarse skin weights and full gameplay transitions still need review before integration.

## User feedback

The user responded "he is just standing still?". Preserve that rejection; numerical motion alone is not enough for visual acceptance. See [the stationary gesture candidate](sheriff-stationary-gesture-preview.md) for the next sourced motion preview.
