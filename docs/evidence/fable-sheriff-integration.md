# Sheriff: model, rig and attack in the playable match

Work by Fable (Claude Fable 5.2, Claude Code), 2026-11-15, on branch
`fable/sheriff-integration`, built on Kiro's playable match (`64e3614`) with
the optimized model from Codex's `c71a59f` (`docs/evidence/sheriff-asset.md`).
Not Kiro or Codex work. No game rule, card value or Engine file changed.

## What changed

- **Model:** the Sheriff card now places `assets/models/sheriff.glb` on its
  tile. The temporary token and its label are gone for this card. Mounted
  Billy, Skeleton and Dragon still use tokens.
- **Rig:** the GLB has no skin and no clips, so it uses the same load-time rig
  as Billy and the Wizard (`src/render/rig.js`): 16 bones, weights computed
  from position bands, at most four per vertex. The Sheriff's joint positions
  were measured on the mesh (below). The GLB file is unchanged.
- **Motion** (`src/render/sheriff.js`):
  - **Idle:** slow breathing and a small sway of head, chest and arms.
  - **Summon landing:** free fall of 0.60 units, boots touch at 350 ms, knees
    bend and the body leans in, upright at 900 ms. The orbs appear at 350 ms.
  - **Draw, fire, recover:** sinks and reaches for the hip (0–0.29 s), draws
    and levels the revolver (to 0.68 s), holds on the target, fires at 0.80 s,
    recoils, lowers and holsters by 1.36 s, back to idle at 1.58 s.
- **Weapon:** the existing `revolver.glb`, hung at the right hip, moved to the
  palm for the draw and turned onto the target before the shot. The muzzle
  flash and tracer start at the revolver's muzzle.
- **Hit:** the cue returns `{impact: 890, end: 1580}` to Kiro's Presenter,
  which already removes the target's orb at the returned impact time from the
  Engine's damage event. Nothing in the renderer computes damage.
- **Camera for checking a model:** `?closeup=cowboy-0` views one tile from the
  front and `?closeup=cowboy-0-wide` views its lane from the side. Without the
  parameter the board camera is unchanged. This is one line in `src/main.js`.

## Measurements

Rig frame: height 1, feet at y = 0, centred in x and z, facing +z.
`scripts/blender/inspect-wizard.py` (read-only) and a slice script gave:

| | Value |
|---|---|
| Mesh | one object, one island, 43,982 triangles, 0 armatures, 0 actions |
| Bounds | x ±0.388, z ±0.230, lowest vertex 0.0003 above the origin |
| Facing | +z in glTF, so the piece is turned 180° to face the Wizards, like Billy |
| Shoulder, elbow, wrist, palm | (0.205, 0.592, 0), (0.275, 0.505, 0.025), (0.335, 0.435, 0.06), (0.345, 0.385, 0.078) |
| Hip, knee, ankle | (0.095, 0.365, 0), (0.115, 0.265, 0), (0.14, 0.085, −0.005) |
| Hands | x 0.31–0.39, y 0.32–0.43, clear of the legs (x ≤ 0.175) |
| Board height | 1.62 world units; Billy is 1.93, the tile is about 2.3 × 2.07 |

## What the Lucca references changed

I read `character-rig.md` sections 2–5, `character-clips.md` sections 2b, 2c,
2d, 5 and 6b, and `character-engine.md` section 1. Their tools are not here, so
I applied the methods and measured with a test. One world unit is taken as a
metre; the repository does not define the scale.

| Reference rule | Sheriff |
|---|---|
| Landmarks are measured on the mesh, never guessed (rig §2) | Joints come from the Blender inspection and height slices above |
| A melee contact falls within about 0.8 s of the start; a slower strike is a known fault (clips §6b) | Shot moved from 0.95 s to 0.80 s; impact at 0.89 s |
| The torso leans 10–15° into the strike at contact (clips §6b) | Lean raised from about 3° to 12.0° at the shot |
| The wind-up moves the weapon at least 0.35 heights from rest (clips §6b) | The muzzle travels 0.51 heights from the hip to the aim |
| Measure where the weapon points on the event frame (clips §2b) | Barrel within 1.5° of the target on the frame before the shot |
| A fall obeys g and comes from one physical curve (clips §2b, §2c) | The drop is 0.5 g t² for the whole 350 ms, 0.60 units |
| A summon ends in the base pose (clips §2c) | The landing ended 0.2 rad short of standing; fixed |
| Clips start in the same pose within 1 mm (clips §5) | The idle's breath is carried into the draw and faded out; start and end poses are within 1 mm of the idle's |
| Planted feet do not slip; nothing is under the floor (clips §5) | Sole drift 0.000 units and nothing below the tile over idle, landing and draw at 60 samples per second |
| The `wrap` gate: fingers must close on the handle, or the fist is declared stylized (rig §3) | Fails: see the export request below |

Not applied: hit-stop and camera shake at contact (clips §6b, engine §2e) would
belong to the Presenter and the camera, which are outside this task.

## Checks

- `node --test "tests/game/*.test.js" "tests/match/*.test.js" "tests/assets/*.test.mjs"`:
  99 passed, 0 failed.
- `tests/match/sheriff.test.js` (5 new tests, Node, real GLBs, no WebGL):
  - Height 1.62, shorter than Billy, inside the tile, yaw 180°, boot soles
    within 0.02 units of the tile top through the idle, revolver at the hip.
  - Landing: in the air before impact, soles on the tile from 350 ms to
    900 ms while the hips drop more than 0.08 units and return.
  - Shot: revolver at the palm, barrel within 1.5° of the target and ahead of
    the Sheriff just before 0.80 s; flash and tracer after it; sparks at the
    target at impact; holstered, facing forward and nothing pending at the end.
  - Reference targets: the rows of the table above that carry a number.
  - Seed 0 through Kiro's controller: the Skeleton's third orb goes out
    890 ms (± one 8 ms tick) after the Sheriff's draw begins, not before.
  - Three guards were broken on purpose once (no hip compensation, no aiming,
    no idle carry) and the tests failed as expected.
- `tests/match/orbs.test.js`: the token expectations for the Sheriff were
  removed; the other three tokens are still checked.
- `npm run check`: passed. `node scripts/audit-assets.mjs assets/models`:
  9 files, 0 invalid. `npm run build`: built.

## Chrome, seed 0

`scripts/sheriff-capture.js` drove the built page in Google Chrome at
1440 × 900 with the page clock paused and stepped. It summoned the Sheriff in
lane 1 (the first Cowboy lane, slot 0), ended the phase, and let the Wizard
CPU answer with a Skeleton in the same lane. The page reported no errors.

| Capture (`docs/evidence/sheriff-integration/`) | Moment | Lane 1 shown by the page |
|---|---|---|
| `summon-fall.png` | 200 ms after confirm | empty |
| `summon-landing.png` | 440 ms, knees bent | Sheriff 3 of 3 |
| `idle.png` | 1.4 s | Sheriff 3 of 3 |
| `windup-reach.png` | clash + 0.27 s, hand at the hip | Skeleton 3 of 3 |
| `windup-aimed.png` | clash + 0.76 s, revolver levelled | Skeleton 3 of 3 |
| `fire-close.png` | clash + 0.81 s, muzzle flash | Skeleton 3 of 3 |
| `before-impact.png` | clash + 0.85 s, side view, tracer in flight | Skeleton 3 of 3 |
| `impact.png` | clash + 0.91 s, side view | Skeleton 2 of 3 |
| `recover.png` | clash + 1.15 s | Skeleton 2 of 3 |
| `board-view.png` | normal board camera after the summon | Sheriff 3 of 3 |

The Sheriff shows 2 of 3 from clash + 0.4 s because the Skeleton token's
lunge lands first.

## Where the mesh limits the motion, and the export that would fix it

Placement, scale, facing and the three motions work with this mesh. Two
things do not hold up in the close view:

1. **The gun hand cannot close** (the reference's `wrap` gate). The right hand
   is one fused, open, relaxed shape. In `windup-aimed.png` the revolver sits on top of the hand and the
   fingers hang open under it; there is no trigger finger. The bands cannot
   curl fingers that share one surface.
   **Export needed:** the same Sheriff in the same pose with the right hand
   closed around a pistol grip (index finger apart), or with separated fingers.
2. **There is no holster.** The revolver hangs against the bare hip in
   `idle.png`.
   **Export needed:** a holster on the right side of the belt, on the mesh or
   as a separate prop.

Also unchanged from Billy and the Wizard: weights come from position bands,
split left and right at x = 0. That is enough for these motions. A walk, a
wide leg move or an arm above the shoulder would need a skinned GLB with
painted weights, as the animation plan describes.

## Not checked

- Frame rate, a Retina display, a narrow window and the 2D fallback.
- The Sheriff in lanes 2 and 3, against a Base, or hit by Singularity (the
  move and removal use the board's existing code).
- Deadeye still fires from Billy or the Saloon, not from the Sheriff.
- `README.md` still says eight GLBs; it is the coordinator's file.
