# Dragon wing-root review

Kiro compared weight-smoothing candidates against release `44e2729` at the same attack frame and camera angles. Fable 5.2 received the side and three-quarter frames as an unlabeled A/B pair and reviewed the wing attachment independently. That uses the fixed-view review method in the [stylized-character reference](https://github.com/droppedoutofcontext/claude-3d-character-skill) and the measurements from [Blender Game Skills](https://github.com/majidmanzarpour/blender-game-skills).

| Frame 18 at contact | Edges stretching over 3× | Fixed-view review |
| --- | ---: | --- |
| Released rig | 130 | Continuous near-wing silhouette in the reviewed frames |
| First smoothing pass | 55 | Dark wedges and layered folds beside the leading wing bone |
| Narrow follow-up A | 121 | New dark triangles at the side-view root |
| Narrow follow-up B | 105 | Smaller dark triangles remained at the root |

The released rig remains the selected model. The first pass reduced the edge count by 58 percent, and Fable identified visible overlapping layers at the root. The follow-up inspected neighboring frames and found that even the milder variants created visible folds. The Mac project’s Kiro folder links to the measurements and fixed-view comparisons.
