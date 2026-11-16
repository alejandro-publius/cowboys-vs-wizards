# Billy and Dragon restrained revision
Prepared November 16, 2026. Update: user rejected Dragon neck-only nod. See dragon-sourced-fire-ring.md for replacement. Billy remains pending.

The user rejected Billy's RobotExpressive Wave and Dragon's full Quaternius Yes wing/head motion. Those are superseded candidates, not accepted designs. Sheriff headShake remains accepted. Wizard, Skeleton and Mounted Billy remain pending without edits.

## Candidates
- Billy: Quaternius Universal Animation Library Standard, Pistol_Idle_Loop, original 1.666667-second timing. Transfer torso/head/leg motion to the existing Tripo model and technical skin; preserve original arm bind. Source shoulder, elbow and wrist rotations are excluded. Hands stay at his sides, with sourced torso breathing. This is not an exact western holster-ready or gun-draw animation; no facial expression or finger poses were invented.
- Dragon: Quaternius Dragon.gltf Yes, original 1.166667-second timing. Only the original gentle neck curve varies (6.75 degrees); wing and fast head channels excluded, head follows the existing neck hierarchy. Original visible model, geometry, materials and weights retained.

A full UAL pistol idle was tested and rejected internally because it put both hands out in front. It is not presented as the requested draw pose.

## Source and credit
UAL1 Standard creator download: https://quaternius.itch.io/universal-animation-library
CC0 1.0 license downloaded with pack. Page credits Quaternius and animation collaboration by Gonzalo Furnier.
Archive SHA-256 cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724.
Source GLB, license and exact provenance retained with organized preview files.
Dragon source/license: docs/evidence/creature-sourced-motion.md.

Quaternius authored source motion; user supplied visible Tripo characters; Codex selected channels, retargeted and captured previews. Kiro authored structural validator and separate inventory/evidence work, not these motions.

## Checks
Both derived GLBs passed Kiro's structural validator when invoked by Codex.
Billy passed import, valid tracks, finite deformed vertices across cycle, independent instances and deterministic playback.
Dragon preserved source target geometry/weights/bind and passed finite vertex checks.
Board probes passed with zero runtime errors; root seating used the existing tile geometry.
Captured 50 Billy and 35 Dragon frames (85 unique), zero browser runtime errors. Video repeats2 Billy and3 Dragon cycles at30fps, 205 frames /6.8333seconds, 1280x720.
These checks do not constitute artistic acceptance.

## Reproduce
node scripts/retarget-character-source-clip.mjs tmp/sourced-motion billy UAL1_Standard.glb Pistol_Idle_Loop --keep-arms-bind
node scripts/retarget-creature-source-clip.mjs dragon Yes --grounded --neck-only
No custom clip keys.

## Status
Pending user comparison. No runtime character replacement, public deployment, main merge or push.
Organized outputs: ~/Documents/Kiroween/Cowboys vs. Wizards/Game/Animation previews/Billy and Dragon restrained revision/
