# Sheriff sourced walk preview
Prepared November 16, 2026. Isolated preview; no game or public-site behavior changed.

- Character: existing user-provided Tripo Sheriff at assets/models/sheriff.glb.
- Motion: walk from https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/models/gltf/Xbot.glb.
- The upstream example attributes the model to Mixamo: https://threejs.org/examples/webgl_animation_skinning_additive_blending.html.
- Motion use is governed by Adobe Mixamo terms, not the three.js code license: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html.
- Conversion maps source motion to the existing game rig and scales root translation to the character proportions. It does not author a new walk or modify the original model.
- The source walk is about 0.967 seconds. Preview repeats that cycle.
- This is a Blender-rendered motion preview on a neutral background. It is not a browser gameplay recording.
- Reviewed frames 0, 7 and 14 show the source-driven stepping and arm swing on the textured Sheriff.
- The existing 16-bone rig has coarse weights. This preview does not establish release-quality deformation, foot contact, or a fire reaction.
- No automatic runtime fallback, new effects, hand-keyed movement, or main-branch merge was added.

Run the script with a local directory containing Xbot.glb. It writes sheriff-mixamo-walk-preview.glb in that directory. Keep source assets and rendered output outside version control.
