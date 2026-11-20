# Kiro Billy sourced-animation pilot (preview only)

Agent: Kiro (this worktree). Date: 2026-11-16 (America/Los_Angeles). Not approved by the user or coordinator. Visual review is pending.

## Source
- Pack: Quaternius "Universal Animation Library [Standard]" (free tier, 45 clips), https://quaternius.itch.io/universal-animation-library, upload 17958403 dated 2026-06-16, CC0 1.0.
- Downloaded through itch.io's public free download flow (minimum price $0, no purchase, no account).
- Archive SHA-256 `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724` (15,904,933 bytes), kept in ignored `.artifacts/billy-pilot/`.
- File `Unreal-Godot/UAL1_Standard.glb` SHA-256 `69591853d817488edaa8fd9bf8fc1d821eaeaf789f8627b3cd23b41c4ed67997`. License file SHA-256 `6d01f55c...ac061` (copied to `assets/animations/pilots/billy/`).
- Clip inventory (45): A_TPose, Crouch_Fwd_Loop, Crouch_Idle_Loop, Dance_Loop, Death01, Driving_Loop, Fixing_Kneeling, Hit_Chest, Hit_Head, Idle_Loop, Idle_Talking_Loop, Idle_Torch_Loop, Interact, Jog_Fwd_Loop, Jump_Land, Jump_Loop, Jump_Start, PickUp_Table, Pistol_Aim_Down, Pistol_Aim_Neutral, Pistol_Aim_Up, Pistol_Idle_Loop, Pistol_Reload, Pistol_Shoot, Punch_Cross, Punch_Jab, Push_Loop, Roll, Sitting_Enter, Sitting_Exit, Sitting_Idle_Loop, Sitting_Talking_Loop, Spell_Simple_Enter, Spell_Simple_Exit, Spell_Simple_Idle_Loop, Spell_Simple_Shoot, Sprint_Loop, Swim_Fwd_Loop, Swim_Idle_Loop, Sword_Attack, Sword_Idle, Walk_Formal_Loop, Walk_Loop.
- Selected: `Pistol_Idle_Loop` (1.667 s, 30 fps, stationary, armed). It exists in the pack, so no substitute was needed. Authored upstream by Quaternius. Kiro only converted it.

## What changed (tracked files)
- `assets/animations/pilots/billy/billy-pistol-idle.json` (83 KB, sha `005518e2...bba3`), `.SOURCE.json`, `LICENSE-quaternius-ual-standard.txt`.
- `scripts/animation-pilot/`: `retarget-billy.mjs`, `billy-pilot-idle.js`, `billy-preview.js`, `build-billy-preview.mjs`, `capture-billy-preview.js`, `check-billy-run.mjs`.
- `.kiro/specs/sourced-animation-cohesion/{requirements,design,tasks}.md`, this file.
- Not touched: `src/**`, `assets/models/*.glb`, package files, shared logs.

## Commands (repo root)
```
node scripts/animation-pilot/retarget-billy.mjs "<unzipped>/Unreal-Godot/UAL1_Standard.glb" Pistol_Idle_Loop assets/animations/pilots/billy/billy-pistol-idle.json
node scripts/animation-pilot/build-billy-preview.mjs
(cd .artifacts/billy-pilot/preview && python3 -m http.server 48179 --bind 127.0.0.1) &
npx -y @playwright/cli@latest open --browser=chrome
npx -y @playwright/cli@latest run-code --filename=scripts/animation-pilot/capture-billy-preview.js > .artifacts/billy-pilot/run-output.txt
ffmpeg -y -framerate 30 -i .artifacts/billy-pilot/frames/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 20 .artifacts/billy-pilot/billy-pilot-preview.mp4
node scripts/animation-pilot/check-billy-run.mjs .artifacts/billy-pilot/run-output.txt
```
Retarget ran once; no correction pass was needed. The retarget script's `.artifacts` input path above is the unzip location.

## Local artifacts (ignored, not committed)
`.artifacts/billy-pilot/billy-pilot-preview.mp4` (12.5 s, 1280x720, 30 fps, sha `0662b594...2918`), `frames/` (375 PNG), `run-output.txt` (per-frame log), `preview/` (built page).

Preview timeline: Billy A idles 0-5.0 s (3 loops), existing attack 5.03-6.61 s (labelled "existing procedural cue" on screen), idle resumes with 0.18 s blend-in and plays to 12.5 s. Billy B (slot 2) idles throughout, 0.8 s out of phase. Left pane: existing board camera. Right pane: existing `closeUp` camera, zoom 5.2.

## Checks (measured, from run-output.txt)
- Console: 0 errors or page errors over 375 frames.
- Independent playback: Billy B's idle clock stepped 1/30 s every frame through A's attack (worst error 1.7e-15 s). B kept playing during A's 48 attack frames. A's idle was not playing during its attack.
- Reset/disposal: `board.clear()` took 3 pieces to 0 and both idle mixers reported disposed; scheduler pending 0.
- Foot contact: during idle, both ankles' world XZ drift 0 m and height range 2e-16 m (feet static in the source). The runtime lift is -0.0176 root units (sinks the rig 1.8% of Billy's height so the lower ankle sits at rest height); this seats the ankle joint, not the boot sole.
- Hand travel: max wrist movement over the idle 1.4 cm. Rig bones are rigid, no non-finite positions.
- Loop closure: first-to-last key rotation difference max 6.3e-4 rad (source seam). Frame 0 and 1.667 s are the same pose, so the loop repeats one duplicate frame.
- Numbers support the measured conditions only. They do not approve appearance.

## Visual observations (my review of 4 sampled frames, not user approval)
- Closeup idle: both hands together at chest height, weight even, head level, restrained. No walking, no head-bob.
- The revolver stays holstered during idle (existing board behavior), so the raised hands hold nothing. This is a mismatch to decide on.
- Retarget uses 16 rig bones: no fingers, no neck bone, no clavicle. Hand and wrist shape is the Tripo mesh's fixed hand. Hand roll was not inspected in detail.
- Billy is small on the board camera pane; the idle reads mainly in the closeup.
- Attack onset and recovery blend over 0.18 s (the Sheriff's value). Crossfade looks continuous in sampled frames; I did not review every frame.

## Not done / pending
- User/coordinator visual review. Frame-by-frame review of the video.
- `orb-duel-review` Power was not called; no receipt from it exists.
- No Wizard, Dragon or Mounted Billy work. Sheriff clip unchanged.
- Production wiring: not started; requires approval.

## Correction pass 1 (Kiro, 2026-11-16, America/Los_Angeles; preview only, still not user-approved)
Trigger: coordinator review of v1 frame f0045 (hands empty, revolver at the hip, boot soles hovering).

- **Source tracks preserved.** `assets/animations/pilots/billy/billy-pistol-idle.json` unchanged, sha-256 `005518e2f40a4fed1028fa33dcb21df12d3af3b140d0d5cdad8a1ba12eb9bba3` before and after; `git diff` on `assets/` and `src/` is empty. Tripo meshes untouched. No curve, pose, finger or effect authored.
- **Revolver in the hand.** `billy-pilot-idle.js` now sets the existing `piece.gun.holder` each idle frame to `grip(actor, "right")` (rig.js) with a fixed orientation of pitch -0.08 rad, the level held pitch the existing cue reaches in `cues.js drawAndFire`. It follows the idle's moving right hand (measured gun-to-wrist offset is constant, since the hand is rigid) and blends 0.18 s from/to the cue's own gun placement. Observed in f0045, f0215: revolver sits in the right hand at chest height, barrel forward. **Two-hand mismatch:** only the right grip is bound; the source pose has both hands together but the left hand is not on the grip point and the fixed orientation was chosen from the attack pitch, not fitted per frame. Fingers are not posed (no finger bones). At attack onset the existing cue snaps the gun toward the holster during its first 0.34 s and the 0.18 s blend covers only the start, so the gun travels hand to hip in the onset frames (f0152 shows it low in the hand).
- **Boot soles.** Replaced the ankle-joint lift with the Sheriff's approach (`sheriff.js bootVertices`): the lowest skinned vertices (bind y < 0.02) of each boot quarter, measured against the piece origin (tile surface) after `skeleton.update()`, lift = -lowest + 3 mm. Measured idle clearances (Billy B, 375-frame run): lowest quarter 0.003 m every frame; the other quarters sit up to 0.0226 m above the tile (source pose rolls one foot's heel or toe). Billy A matches except the 0.18 s blend-in after the attack (lowest quarter 0.003 m, highest min up to 0.0115 m). During the existing attack cue the lift is 0 and the lowest quarter reaches -0.0035 m (3.5 mm into the tile) on the cue's own legs; I did not change the cue. Character is not scaled or distorted. Board camera f0045 and f0176: boots read as on the tile, with a contact shadow.
- **Teardown receipt fixed.** `pending` now uses `scheduler.pending()`. `teardown()` starts an attack (pending 0 -> 2), `board.clear()` (pending 2 -> 0, pieces 3 -> 0, both mixers disposed), ticks 3 s (pending 0, pieces 0), then schedules a raw timer plus a `scheduler.guard` callback, calls `scheduler.advance()` (pending 1 -> 0), ticks, and runs the guarded callback: stale callbacks ran 0 times.
- **Video.** `.artifacts/billy-pilot/billy-pilot-preview-v2.mp4`, 12.5 s, 1280x720, 30 fps, sha `56a91349...`, from `frames-v2/` (375 PNG) and `run-output-v2.txt` (0 console problems). The v1 video is kept unchanged as the before artifact (`billy-pilot-before-review.mp4` and `billy-pilot-preview.mp4`, sha `0662b594...`). Frames inspected by me: idle f0045, attack onset f0152, impact f0176, recovery f0215, at board camera (f0045, f0176) and closeup (all four).
- **Still procedural:** the attack (5.03-6.61 s) remains the existing `cues.js` cue, labelled on screen. Only the idle is sourced.
- **Remaining limitations:** left hand not on the grip; fixed grip orientation; gun hand-to-hip travel at attack onset; one foot's heel/toe up to 2.3 cm off the tile in the source pose; 3.5 mm tile penetration during the cue; Billy small on the board pane. Visual approval pending the coordinator or user. `capture-billy-preview.js` now writes `frames-v2/`.

## Coordinator review and watchable preview

[Watch Billy preview v2](animation-pilots/billy-sourced-preview-v2.mp4) — 12.5 seconds, 1280×720, 30fps. This is a real captured preview, not production gameplay with the new idle enabled.

Codex inspected idle frame f0045 and impact frame f0176. The gun is now visibly held and boot placement improved. The supporting hand still misses the grip, and the existing attack begins by moving the gun toward the hip. This remains an unapproved preview; do not merge it as a finished animation or apply it across the roster. The on-screen caption distinguishes the CC0 idle from the existing procedural attack.

The next bounded step is to preview the pack's existing Pistol_Shoot clip with this idle, preserving source keys and using only retargeting, rigid attachment, ground seating and blending. No new authored poses or curves. Production integration follows a satisfactory visual review.

## v3 preview: sourced idle -> Pistol_Shoot -> idle (Kiro CLI 3.4.0, 2026-11-16, America/Los_Angeles; preview only, not approved)

Watch: [billy-sourced-preview-v3.mp4](animation-pilots/billy-sourced-preview-v3.mp4) (13.5 s, 1280x720, 30 fps, 405 frames, sha-256 `61bfaad8cf02ce7d5a7e841ff5b1eb836b46ba1c229948c34bc183c9b0aca646`). Frames at 2.0 s (idle), 3.87 s (Billy A mid-shoot), 8.33 s (Billy B shoot, board view): [billy-sourced-preview-v3-frames.jpg](animation-pilots/billy-sourced-preview-v3-frames.jpg). Receipt: [billy-sourced-preview-v3.json](animation-pilots/billy-sourced-preview-v3.json). v2 video, image and receipt are unchanged.

**Sources.** `Pistol_Shoot` exists in `UAL1_Standard.glb` (sha-256 `69591853...7ed67997`, checked again before and after the run). Retargeted with the unchanged `retarget-billy.mjs` into `assets/animations/pilots/billy/billy-pistol-shoot.json` (20 keys, 0.633 s, sha `41140d4f...5a4`) with `billy-pistol-shoot.SOURCE.json`. `billy-pistol-idle.json` is unchanged (sha `005518e2...bba3`), `assets/models/billy.glb` unchanged (`80266b71...1241`), `src/**` untouched.

**What the preview does.** Each Billy has its own `AnimationMixer` (`scripts/animation-pilot/billy-pilot-shoot.js`). Idle loops, then a 0.18 s crossfade into `Pistol_Shoot` played at 0.5x (one global time scale, 1.267 s), then a 0.18 s crossfade back to the idle. Billy A shoots at 3.53 s and is shown in the closeup pane (existing `closeUp` camera, zoom 5.2). Billy B shoots at 8.03 s and is visible in the board-camera pane. The existing procedural attack cue is not used for the shot. On-screen labels name `Pistol_Idle_Loop` or `Pistol_Shoot` (0.5x, crossfade weights) per Billy.
Only allowed operations: bind-space retarget, boot-sole grounding (lowest boot vertex +3 mm, as v2), 0.18 s crossfades, one playback rate, and a rigid revolver attachment. The gun follows the right hand's existing grip point with the hand bone's rotation times one constant offset, chosen once from key 0 of the shoot clip so the barrel points along the actor's forward axis. No key, pose, finger, muzzle flash or procedural motion was added. There is no shot effect, so nothing visibly leaves the barrel and the Wizard does not react.

**Checks (one run, `check-billy-run-v3.mjs` on `.artifacts/billy-pilot/run-output-v3.txt`).**
- Console: 0 problems and 0 page errors over 405 frames.
- Fire events at page clock 3.5333 s (A) and 8.0333 s (B); 37 non-idle frames each. Each Billy's mixer ran independently (different fire times and idle phases).
- Gun to right-hand grip point: 0 in every frame of both Billys (rigid). The gun no longer travels from chest to hip.
- Soles: lowest boot vertex 0.003 m above the tile in every frame; root lift constant at -0.0146.
- Muzzle travel during the shot: at most 0.0995 board units (about 5% of Billy's 1.93 height). The source clip is a small recoil.
- Teardown: before clear, 2 mixers each with 2 actions and 17 bindings, scheduler pending 0. The existing cue was started to create timers (pending 2). After `board.clear()`: pieces 3 -> 0, both mixers disposed (actions 0, bindings 0), pending 0, and still 0 after ticking 3 s. A stale-epoch callback ran 0 times (pending 1 -> 0 after `scheduler.advance()`).
- These numbers support measured conditions only. They do not approve appearance.

**Visual review (mine, closeup crops of f0100, f0116, f0126 and an 8-frame contact sheet; not user approval).**
- Fixed: the gun stays at chest height through the whole shot, so the v2 chest-to-hip move is gone. Crossfades read continuous in the sampled frames.
- Still wrong, left hand: the left palm stays 0.21 to 0.23 board units from the gun's grip point throughout idle and shoot, so the supporting hand does not wrap the gun. It sits beside the body of the revolver. This follows from the source pose, a taller Quaternius character with different arm proportions, applied to Billy's rigid hands.
- Still wrong, right hand: the rig has no finger bones and the Tripo hand mesh is a fixed shape, so the gun rests in front of the hand rather than being gripped. The rigid constant orientation is a single guess for all frames.
- Weak shot: the clip's recoil is small (muzzle moves about 10 cm) and with no flash the shot reads as a slight lift of the gun. At 0.5x it is readable but slow.
- Billy is small in the board pane, so the grip is only judgeable in the closeup.
- Conclusion: the sourced attack is continuous and keeps the gun in the hand, but under the current rigid hands it does not look like a coherent two-handed grip. Fixing it needs either finger or hand-pose work or a different source clip, both outside this task's allowed operations. I stopped here and made no correction pass.

**Commands (repo root).**
```
node scripts/animation-pilot/retarget-billy.mjs "<unzipped>/Unreal-Godot/UAL1_Standard.glb" Pistol_Shoot assets/animations/pilots/billy/billy-pistol-shoot.json
node scripts/animation-pilot/build-billy-preview-v3.mjs
(cd .artifacts/billy-pilot/preview-v3 && python3 -m http.server 48193 --bind 127.0.0.1) &
npx -y @playwright/cli@latest open --browser=chrome
npx -y @playwright/cli@latest run-code --filename=scripts/animation-pilot/capture-billy-preview-v3.js > .artifacts/billy-pilot/run-output-v3.txt
ffmpeg -y -framerate 30 -i .artifacts/billy-pilot/frames-v3/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 24 docs/evidence/animation-pilots/billy-sourced-preview-v3.mp4
node scripts/animation-pilot/check-billy-run-v3.mjs .artifacts/billy-pilot/run-output-v3.txt
```
Port 48180 was already in use by another process, so v3 used 48193. The Kiro hook on tracked doc saves is not evidenced by this note; the hook result, if any, is separate. Production wiring and user/coordinator review remain pending.
