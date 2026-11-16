# Remaining-character sourced motion previews
Prepared November 16, 2026. Five local candidates, awaiting user review. Public demo and match behavior unchanged.

The user approved the Sheriff stationary gesture with "perfect!!!" and requested distinct sourced motions for the remaining characters. The Sheriff reference remains unchanged. These new candidates use finished Quaternius clips, not newly authored poses or animation curves.

| Character | Source asset and exact clip | Visible action | Source seconds |
| --- | --- | --- | --- |
| Billy | RobotExpressive / Wave | Arm wave | 1.833 |
| Wizard | RobotExpressive / Yes | Head nod with existing staff | 1.667 |
| Skeleton | RobotExpressive / Idle | Head movement and weight shift | 3.333 |
| Mounted Billy | Horse / Idle_2 | Horse head/neck movement and tail swish | 3.333 |
| Dragon | Dragon / Yes | Head nod and wing movement | 1.167 |

## Sources and ownership
- RobotExpressive: https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/models/gltf/RobotExpressive/RobotExpressive.glb. Creator Tomás Laulhé/Quaternius; example modifications by Don McCurdy. CC0 as credited at https://threejs.org/examples/webgl_animation_skinning_morph.html.
- Horse: Quaternius Ultimate Animated Animals, https://quaternius.com/packs/ultimateanimatedanimals.html. Creator download Horse.gltf, file id 1hbtY8kxnXiPdwYGVY7rWRgU0jl_-Q-LG; CC0 license retained with source.
- Dragon: Quaternius Ultimate Monsters, https://quaternius.com/packs/ultimatemonsters.html. Creator download Dragon.gltf, file id 1-mQSm6_oGt7-EEQfNj1dFWYgPQy4AdPC; CC0 license retained with source.
- User Tripo models remain the visible characters. Original project GLBs are unchanged.
- Codex prepared target skinning, source retargeting, board previews and videos. The Skeleton gained a technical 16-bone skinning profile measured from its existing front/side views.
- Kiro built the structural animation validator, audited the native model inventory and fixed two concrete validation defects. The motion and retargeting are not Kiro-authored.

## What changed technically
The humanoid converter samples finished source joint motion at 30 fps and maps it to existing target proportions. Billy's wrist mapping uses the source middle palm/finger axis. Wizard keeps the existing staff with an attachment adjustment, and no new staff design. Source facial morphs and individual finger motion are not recreated.

Creature candidates retain the target's original mesh, materials, binary resources, skin weights, joints and bind transforms. Only mapped rotation curves are replaced with sampled source motion. Source translation is omitted for stationary tile presentation; unmatched joints stay at bind. Mounted Billy's rider follows its existing horse rig without an additional invented rider animation. The Dragon source includes wing motion from a flying character, so its grounded presentation is still a visual-review question.

The old embedded dragon_idle and mounted_idle were created by earlier Kiro Blender scripts. These previews do not reuse those animation curves.

## Actual checks
- Three.js r180 imported and played all candidates.
- Humanoid clips passed full-cycle sampled finite deformation, valid tracks, independent instances and deterministic replay.
- Creature export checks preserved original geometry/material/skin data and sampled finite skinned vertices.
- Kiro's structural validator returned exit 0 for all five derived GLBs when run by Codex.
- Captured 55 Billy, 50 Wizard, 100 Skeleton, 100 Mounted Billy and 35 Dragon frames: 340 unique frames total, zero browser runtime exceptions.
- Reviewed phase screenshots on the real board, including the Skeleton neck, Wizard staff, Billy hand, horse stance and Dragon wings. This is a preview review, not user acceptance or a release-quality guarantee.
- Root height seating checks sampled contacts against each faction's actual tile. This is not a locomotion/foot-sliding certification.
- Combined video repeats the source cycles: 715 frames, 1280 by 720, 30 fps, about 23.83 seconds. H.264 export decoded without errors.
- Raw board montage SHA-256: 9c2010dc53d773ad2b2d5e71a20c79e035e3f2ab39b56dbc43baff299b02a095.

## Reproduce
Use scripts/retarget-character-source-clip.mjs with DIRECTORY CHARACTER SOURCE.glb CLIP for the three humanoids. Run scripts/check-character-source-clip.mjs on the output.
Use scripts/retarget-creature-source-clip.mjs with mounted-billy Idle_2 or dragon Yes, with creator files in tmp/creature-sources.
Build using scripts/build-character-motion-preview.mjs INPUT.glb OUTPUT_DIR [CHARACTER], then capture using scripts/record-character-motion-preview.mjs --out-dir OUTPUT_DIR --close-only. Native creature exports need the CHARACTER argument.

## Pending
User review of these five motions, optional choice of another finished clip, and integration into live match idle/action states. No main merge, push, deployment or rule change was performed.
