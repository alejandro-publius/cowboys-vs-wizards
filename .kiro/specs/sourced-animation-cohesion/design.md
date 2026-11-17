# Sourced animation cohesion: design (Billy pilot)

1. Source: Quaternius Universal Animation Library [Standard], CC0. Clip `Pistol_Idle_Loop` (1.667 s, 30 fps, stationary). It is the only armed stationary loop in the free pack; `Idle_Loop` and `Sword_Idle` are neutral or melee and were not used.
2. Retarget (offline, `scripts/animation-pilot/retarget-billy.mjs`): Billy's 16 bones are built by the production `rigActor`. Each bone gets the rig-frame direction of the matching source bone pair plus the source's twist. Pelvis offset is scaled by leg length. Output keys equal source keys.
3. Runtime (`billy-pilot-idle.js`): one AnimationMixer per Billy, as in `sheriff-sourced-idle.js`. A 0.18 s crossfade (the Sheriff's value) joins idle and the existing attack pose. A vertical lift seats the lower ankle at its rest height.
4. Preview (`billy-preview.js`): existing board, board camera, closeUp camera, perimeter and `withCues` attack. Billy A idles, attacks once, resumes. Billy B idles out of phase as the independence control.
5. Not done: gun in hands during idle. The board's revolver stays holstered until the existing draw; the pilot idle holds two hands at chest height.
