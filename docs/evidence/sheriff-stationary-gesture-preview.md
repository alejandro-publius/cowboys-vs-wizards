# Sheriff stationary gesture preview
Prepared November 16, 2026. Local preview only; user visual review pending.

## Why this candidate
The user rejected the prior standing idle because it looked still. The source idle head motion spans only about 0.43 degrees from its first sample. This candidate uses the existing Mixamo headShake gesture, with a roughly 34.81-degree head excursion and visible arm movement. It is a discrete head-turn/head-shake gesture, not an approved full idle behavior system. Do not rename the source or claim user acceptance.

## Source and scope
- Character: unchanged user Tripo Sheriff at assets/models/sheriff.glb.
- Motion: headShake from https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/models/gltf/Xbot.glb.
- Mixamo attribution: https://threejs.org/examples/webgl_animation_skinning_additive_blending.html.
- Terms: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html. The three.js code license does not relicense the motion.
- Retargeted the original clip through the existing source-to-Sheriff joint mapping. No new poses, synthetic head turns or handmade animation.
- Existing board, lighting, materials and camera. Only whole-actor height seating changes world placement.
- Codex implemented this preview. Kiro may receive separate validation/evidence work; do not attribute this clip or its retargeting to Kiro.

## Verified
- Imported and played in Three.js r180; full-cycle sampled deformation, independent instances and deterministic replay checks passed.
- Captured all 77 frames of the 2.567-second clip with zero browser runtime exceptions.
- Reviewed frames 0, 24 and 60; the character's head visibly turns while he remains on the tile. This does not establish release-quality deformation.
- Two cycles encoded to 1280 by 720, 30 fps, 154 frames; full H.264 decoding passed.
- Video SHA-256: 9426031ae6eec598acb7bdcc1ee9554c91c618c1ccc1f694649889e5237d32a7.

Reproduce:
1. node scripts/retarget-sheriff-source-clip.mjs tmp/sourced-motion headShake
2. node scripts/check-sheriff-source-clip.mjs tmp/sourced-motion headShake
3. node scripts/build-sheriff-board-preview.mjs tmp/sourced-motion/sheriff-mixamo-headShake-preview.glb .artifacts/sheriff-standing-head-turn-preview
4. node scripts/record-sheriff-board-preview.mjs --out-dir .artifacts/sheriff-standing-head-turn-preview --close-only

Public game, live match animation states and deployment are unchanged. The approved walk is retained separately. Prior subtle idle is rejected as insufficiently visible; this gesture is a new candidate.
