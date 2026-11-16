# Sourced creature motion candidates

Prepared November 16, 2026. Local previews only. Geometry, materials, skin weights and bind transforms remain the game's existing user Tripo assets. The previous native Dragon and Mounted Billy idle curves were authored by Kiro and are not reused here.

## Sources

| Character | Creator pack | Actual source file and clip | Rights |
| --- | --- | --- | --- |
| Mounted Billy's horse | [Quaternius Ultimate Animated Animals](https://quaternius.com/packs/ultimateanimatedanimals.html) | [Horse.gltf](https://drive.google.com/file/d/1hbtY8kxnXiPdwYGVY7rWRgU0jl_-Q-LG/view), Idle_2, 3.333333 s | CC0 1.0; creator folder License.txt retained |
| Dragon | [Quaternius Ultimate Monsters](https://quaternius.com/packs/ultimatemonsters.html) | [Flying/Dragon.gltf](https://drive.google.com/file/d/1-mQSm6_oGt7-EEQfNj1dFWYgPQy4AdPC/view), Yes, 1.166667 s | CC0 1.0; creator page and creator folder License.txt agree |

The Monsters folder's license has an unrelated "Ultimate Platformer Pack" heading; its CC0 text and the actual Ultimate Monsters creator page establish the same rights. Preserve the supplied license rather than rewriting it.

Source SHA-256:
- Horse.gltf: 3deb61550dff1d2786d04b6e8559d63ad3907d6ab606ba28ce0af074ed96341b.
- Dragon.gltf: d219a29b5e928da26c24218a64284bbf999b88484a508ac6c01e0edad9f1f56c.

## Retargeting and limits

scripts/retarget-creature-source-clip.mjs samples original source rotations at 30 fps, converts facing direction, and applies world-rotation deltas to the existing target bind pose. It copies the original target binary payload unchanged, appending only animation accessors. It does not author poses, create curves, change amplitudes, or change playback speed. Source translation is omitted for stationary board placement; unmatched joints retain their bind transforms.

Horse mapping: Back to horse_body, Neck3 to horse_neck, Head to horse_head and Tail3 to horse_tail. The source horse has no rider, so no new rider motion is synthesized. Maximum local motion from the first sample is about 2.42 degrees body, 11.38 neck, 8.02 head and 26.86 tail.

The initial Dragon Yes preview included the source wing cycle. The user rejected its movement as weird. Do not treat it as approved or reuse the flying wing motion as the grounded idle.

## Grounded Dragon revision

Compared the three original clips without changing source timing:

| Source clip | Head/neck excursion | Maximum sampled angular speed | Assessment |
| --- | --- | --- | --- |
| Flying_Idle | Head 1.85 degrees; neck constant | Head 12.85 degrees/s | Very small; risks repeating the rejected barely-visible idle |
| Yes | Head 26.36 degrees; neck 6.75 degrees | Head 431.07; neck 79.33 degrees/s | Source head is brisk; source neck offers a more restrained candidate |
| No | Head 14.43 degrees; neck 35.83 degrees | Head 191.06; neck 541.78 degrees/s | Too rapid to call a calm idle without visual evidence |

The current grounded candidate uses the original Yes neck curve only. The fast head channel and all wing channels are excluded. The target head follows its existing neck hierarchy with the original bind rotation. No artificial slower timing or weaker movement was introduced.

Reproduce:
```sh
node scripts/retarget-creature-source-clip.mjs dragon Yes --grounded --neck-only
node scripts/retarget-creature-source-clip.mjs mounted-billy Idle_2
```

Outputs are under tmp/creature-sources, outside version control:
- dragon-quaternius-Yes-grounded-neck-preview.glb and its JSON report.
- mounted-billy-quaternius-Idle_2-preview.glb and its JSON report.
- Original source files and supplied licenses.

GLB animation extras include character, source, sourceClip, profile, source and target hashes, mapping and transformation limitations.

## Size and verification

Both outputs retain native glTF Y-up coordinates and are not normalized to height one. Fit the scene once from its bind bounds before playing its clip.

| Model | Rest minimum | Rest maximum | Height |
| --- | --- | --- | --- |
| Dragon | [-0.452698, 0.000183, -0.489807] | [0.452667, 0.597015, 0.489807] | 0.596832 |
| Mounted Billy | [-0.266312, 0.000183, -0.410141] | [0.266373, 0.980225, 0.410568] | 0.980041 |

The scene root armature nodes have no explicit translation, rotation or scale. Preserve the skeleton's own transforms rather than applying another axis rotation.

Actual checks: Three.js r180 import, animation track validation, finite sampled skinned vertices, nonconstant mapped joint transforms, export/reimport, and equality checks for original geometry, binary payload, skin and node definitions. These pass for the grounded candidate. Script syntax and git diff whitespace checks pass.

Visual review of the grounded revision is pending with the coordinator. Numeric checks do not establish convincing movement, foot contact, deformation quality, or live integration. No public deployment or source asset edit was performed.
