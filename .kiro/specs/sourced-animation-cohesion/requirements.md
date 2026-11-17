# Sourced animation cohesion: requirements

Status: pilot scope. Billy only. Preview, not approval to replace production animation.

- R1 Source only. Motion comes from the user's Tripo models and finished, licensed clips. No hand-authored curves, no new procedural body movement, no new visual design.
- R2 Billy reads as concentrated: steady hands near the draw, feet planted, restrained. No walking in place, no head-bob.
- R3 The approved Sheriff headShake (assets/animations/sheriff-headShake.*) stays as is and is not copied to other characters.
- R4 Wizard needs staff/grip continuity. Dragon and Mounted Billy need species-appropriate source motion, not humanoid retargets. Their embedded attacks came from an earlier pipeline and are not labelled Tripo-exported or newly approved. (Later pilots; out of scope here.)
- R5 Cohesion means consistent idle, anticipation, contact and recovery transitions, tile anchoring and readability, while characters keep distinct behavior.
- R6 Provenance: every clip pins URL, version, archive and file SHA-256, license, exact clip name.
- R7 Production entry points, defaults, src/render/*, original GLBs and package files are not edited by a pilot.
- R8 Checks: independent actor playback, reset/disposal, foot contact, hand/weapon breakage, loop closure, no console exceptions. Numeric checks do not equal visual approval.
