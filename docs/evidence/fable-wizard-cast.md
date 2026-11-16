# Wizard: staff grip and cast in the playable match

Work by Fable (Claude Fable 5.2, Claude Code), 2026-11-15, on branch
`fable/wizard-cast`, built on the Sheriff work (`aa48efa`). Not Kiro or Codex
work. `src/ui/`, `src/match/`, `src/game/` and the attack demo's own cast in
`src/render/scene.js` are untouched. `assets/models/wizard.glb` is unchanged.

## What changed

- **Motion** (`src/render/wizard.js`, new): the board Wizard has its own idle
  and cast on the existing procedural rig and code-built staff.
  - **Idle:** the staff stands still; the head nods, the free hand drifts and
    the jewel pulses.
  - **Cast:** wind-up (staff lifted and tipped 25° back, free hand gathers,
    jewel charges, by 0.50 s), thrust (from 0.72 s, jewel swung forward and
    down to 49°, body leans in, free hand thrown back), release at 0.90 s,
    hold, recovery from 1.10 s to idle at 1.60 s.
  - Singularity uses the same poses on its own times (release 0.80 s, end 1.20 s).
- **Grip:** the staff stays parented to the left hand bone, so it cannot move
  in the palm. On the board it now sits 0.09 lower in the fist, along its own
  axis. Before, its foot hung 0.18 world units above the tile in the idle pose;
  now it rests on the tile (0.003 above).
- **Spell** (`src/render/cues.js`): the cue times are the existing ones,
  `{impact: 1100, end: 1600}`, with the bolt leaving the jewel at 0.9 s. The
  effects are larger so they read from the board camera: a glow that gathers
  at the jewel, a flash at the release, a bolt about 0.4 world units across
  with a thick trail, and a burst and ring on the target at the impact.
- **Board** (`src/render/match-board.js`): the Wizard piece is built by
  `buildWizard` and idles through the same hook as the Sheriff.

## Lucca guidance applied

Sections read: `character-clips.md` 2, 2c, 2d, 5 and 6b; `character-rig.md` 3
and 4b. Their tools are absent, so each rule was measured by a test.

| Reference rule | Wizard |
|---|---|
| A held prop sits on a bone of the hand, so it cannot slide (rig §4b) | The staff is a child of the hand bone |
| Planted staff: the prop's foot is in charge and its offset is measured (clips §2c) | Foot 0.003 world units above the tile in idle, never below it |
| The fist must close on the handle: the `wrap` gate (rig §3) | 164–171 hand vertices on the shaft, all the way round, in every sampled frame. The fist is a stylized whole-hand curl; see the asset gap |
| The forearm and body stay off the handle; measure mesh against mesh (clips §2, §5) | The body never comes nearer than 0.024 to the staff's axis (shaft radius 0.016) |
| At the release the carrier moves where the projectile goes (clips §2d) | The thrust ends 0.05 s after the release, so the jewel is still moving forward and down when the bolt leaves |
| The wind-up takes the weapon head at least 0.35 heights from rest (clips §6b) | 0.28 heights; the hat brim stops it there. Rest to full thrust is 0.35; wind-up to full thrust is 0.62 |
| Clips start and end in the same pose within 1 mm (clips §5) | Both casts start and end within 1 mm of the idle pose |
| Effect and damage on the same frame as the contact event (clips §6b) | Burst and ring start at the cue's impact time; Kiro's Presenter removes the orb at that time |
| Contact within about 0.8 s (clips §6b) | Not met: the release stays at 0.9 s and the impact at 1.1 s, the existing match cue times |

## Checks

- `node --test "tests/game/*.test.js" "tests/match/*.test.js" "tests/assets/*.test.mjs"`:
  103 passed, 0 failed.
- `tests/match/wizard.test.js` (4 new tests, Node, real GLB, no WebGL): the
  staff foot on the tile; grip and clearance through idle and both casts; the
  shape of the cast and its joins with the idle; the cue times, the bolt
  leaving at 0.9 s and the burst on the target at 1.1 s. Two guards were
  broken on purpose once (no staff drop, the earlier thrust roll) and failed.
- `npm run check` (the attack demo's geometry and event check): passed.
- `npm run build`: built.

## Chrome, seed 16

`scripts/wizard-capture.js` drove the built page in Google Chrome with the
page clock paused and stepped. The Cowboy passed twice, the Wizard CPU
summoned a Wizard in lane 1, the Cowboy answered with a Sheriff in lane 1 and
ended the phase. The page reported no errors. Files are in
`docs/evidence/wizard-cast/`; times are from the start of the clash, to
within about 0.02 s.

| Capture | Moment | Sheriff shown by the page |
|---|---|---|
| `board-idle.png` | before the clash, board camera | 3 of 3 |
| `board-windup.png` | 0.50 s, staff raised, jewel glowing | 3 of 3 |
| `board-release.png` | 0.94 s, flash at the staff | 3 of 3 |
| `board-flight.png` | 1.02 s, bolt on its way | 3 of 3 |
| `board-impact.png` | 1.14 s, burst on the Sheriff | 1 of 3 |
| `board-recovered.png` | 1.70 s | 1 of 3 |
| `close-idle.png`, `close-windup.png`, `close-thrust.png`, `close-release.png`, `close-recovery.png` | the same cast from in front of the Wizard | |
| `hand-idle.png`, `hand-windup.png`, `hand-thrust.png` | the staff hand at twice the size | |

The Wizard's attack is 2, so the Sheriff goes from 3 to 1. In the earlier
build the bolt was about 0.17 world units across and hard to see from the
board camera.

## Asset gap

The grip holds up at the board camera and in the close view. Three limits come
from the static mesh:

1. **Fused hand.** The fingers are one block, so the grip is a whole-hand curl
   made by bending the rest mesh. In `hand-windup.png` the lowest finger ends
   in a flat wedge, and in `hand-thrust.png` the thumb lies along the shaft
   and does not wrap it. 17 of the 630 hand vertices sit within 0.012 of the
   staff axis, inside the 0.016 shaft.
   **Export needed:** the same Wizard in the same A-pose with the left hand
   (the +X side, the side the hat tip curls to) closed around an empty
   cylindrical gap 0.032 of the body height across, thumb opposed, or with
   five separated fingers. Keep the staff out of the body file.
2. **Sleeve cuff.** The bell sleeve hangs below the wrist. Tipping the staff
   forward past 49° puts its lower half through the cuff, so the jewel cannot
   point straight at the target. **Export needed:** a left sleeve that ends
   above the wrist, or a narrower cuff.
3. **Hat brim.** The brim overhangs the staff shoulder, which stops the
   wind-up at 25° back. No export requested; the cast reads without more.

## Not checked

- Frame rate, a Retina display, a narrow window and the 2D fallback.
- Wizards in lanes 2 and 3, a bolt at the Saloon (seen once in an earlier run,
  not captured), and Singularity in Chrome (covered by the Node test only).
- The Wizard's summon is still the board's generic scale-in.
- The attack demo was checked with `npm run check`, not by eye.
