# Kiro character imports and attack clips

Kiro CLI 3.3.0 used Auto for the Skeleton import, the two Blender rig jobs, the revision to Mounted Billy and the board integration. The original Tripo exports are the visual reference. The agents applied fixed front and side camera comparisons, ground contact measurements and GLB round-trip verification. [Blender Game Skills](https://github.com/majidmanzarpour/blender-game-skills) · [Character Factory](https://github.com/luccacerfz/character-factory-skills) · [Reference Asset Compiler](https://github.com/raydeStar/reference-asset-compiler)

## Skeleton

Kiro reduced the original 1,927,403-triangle, 67,733,240-byte export to 59,999 triangles and 3,067,712 bytes. Its three textures were resized from 4096 to 1024 pixels per side. The imported mesh stands 1.2 scene units tall, sits on its Wizard tile and faces the Cowboys. The renderer reuses the summon, hit and defeat cues.

Release `c4ec67c` passed 107 Node tests and both public Chrome routes, 8 of 8 checks for seed 0 and 4 of 4 for seed 60. Both ran with zero console errors. The round-two frame shows the new models and their orbs. [Release run](https://github.com/alejandro-publius/cowboys-vs-wizards/actions/runs/43946324911) · [Play seed 0](https://alejandro-publius.github.io/cowboys-vs-wizards/?seed=0)

## Dragon and Mounted Billy

| Model | Attack | Export check |
| --- | --- | --- |
| Dragon | Twelve bones, wing and neck motion with contact at frame 18 at 30 fps | Identical first and last pose, zero measured hind-foot drift and a round-trip pose error below 0.000001 scene units at sampled frames. Some short edges near the wing root stretch at full impact. |
| Mounted Billy | Eleven bones, a restrained mounted recoil with contact at frame 20 at 30 fps | Identical first and last pose, zero measured hoof drift, and about 1.11× hand-edge stretch in the revised clip. The connected reins stay with the mount. |

Each character has its own skeleton and mixer. The match scheduler maps the clip contact pose to the game’s 400 ms impact and returns it to rest at 800 ms. The same scheduler handles reset and simultaneous attack playback. [Attack tests](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df/tests/match/attack-clips.test.js)

The final character release `44e2729` passed 112 Node tests and all 12 checks across both public Chrome replays, with zero console errors. The public HTML and the 2:16 recording use the same build SHA-256, `51733084f2b3f59a1aa359845ef6cc23373fd6ec17904c8d76234cc440c18bd2`. [Deployment run](https://github.com/alejandro-publius/cowboys-vs-wizards/actions/runs/43949511553)

The local Kiro Power calls `inspect_character_asset` for the actual GLB digest, triangle count, joints and clips. The coordinator paired it with visual review and the replay. [Asset audit](../../scripts/audit-assets.mjs) · [Power](../../.kiro/powers/orb-duel-review/skills/review-duel-replay/SKILL.md)
