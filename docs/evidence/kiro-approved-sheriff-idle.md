# Approved Sheriff idle in the match (Kiro runtime integration)
November 16, 2026, America/Los_Angeles. Branch `kiro/approved-sheriff-idle`, from 849ecce. Local only: not pushed, merged or deployed. **Not yet visually verified**: only numerical Node checks and one build were run.

## Credits
- Art: the user's Tripo Sheriff, `assets/models/sheriff.glb`, unchanged (geometry, material and rig).
- Motion: Mixamo headShake, from three.js r180 `Xbot.glb`. Adobe/Mixamo terms apply, not the three.js MIT code license. Sources and terms are in `assets/animations/sheriff-headShake.SOURCE.json`.
- Retarget and standing preview: Codex (`codex-sourced-motion-preview`, [preview evidence](../../../codex-sourced-motion-preview/docs/evidence/sheriff-stationary-gesture-preview.md) in that worktree). The user approved the visible standing gesture with "perfect!!!". Approved file SHA-256 `d9d2ea2e0dc4808f3b220bae0e21440a5109de0e87e82845e93abc6bd1655c99`, 3,891,912 bytes, clip `Mixamo_headShake_retargeted`, 2.566666603 s.
- Kiro: only the runtime integration and checks below. Kiro did not create, retarget or edit any curve.

## What changed
- `assets/animations/sheriff-headShake.json`: the 17 tracks (16 bone rotations, hips translation; 78 keys each) copied from the GLB accessors by `scripts/extract-approved-sheriff-clip.mjs`. Float32 times and values are unchanged (JSON doubles equal the Float32s exactly); only names (`sheriff_hips.quaternion`) and format changed. Translations are in the normalized height-1 rig the Sheriff already uses and are not scaled again. `.SOURCE.json` records the file SHA, name, duration, conversion, attribution and the clip data's own SHA-256 `de012cfb...bd36`.
- `src/render/sheriff-sourced-idle.js`: one `AnimationMixer` and one fresh `AnimationClip` per Sheriff, rooted at that Sheriff's actor. `play(t)` samples the clip (it repeats), `release()` stops it and restores all 16 bone rotations to identity, the hips to the rig's bind position and the actor lift to 0, `dispose()` also uncaches the mixer.
- `src/render/sheriff.js`: `idleSheriff` plays the approved clip; no sine motion remains in it. The actor is lifted by the amount that puts the lowest boot vertex of each of four boot quarters on the tile (+3 mm), the same seating as the approved preview; scale and facing are unchanged. New `restSheriff` is the old static rest pose (the former idle at second 0). `drawSheriff` and `landSheriff` call `release()` first and are otherwise unchanged, as are their curves and the gun grip.
- `src/render/match-board.js`: `idlesSheriff` replaces the Sheriff's `idles(piece, idleSheriff)` only. Wizard, Billy and all other pieces are untouched.
- `src/render/cues.js`: the Sheriff shot ends in `restSheriff` (it was `idleSheriff(piece, 0)`), so the cue still ends holstered in the rest pose.

## Lifecycle
| State | Behavior |
| --- | --- |
| Idle | Render callback plays the clip from the second the idle started. |
| Attack, summon landing (`piece.acting`) | Clip released before the cue writes its pose; callbacks leave the cue alone. |
| Lost orb (`setTroopOrbs` with fewer orbs, Sheriff only) | Rest pose held for `HIT_HOLD_MS` = 400 ms (the attack cue's impact time), measured on the scheduler clock. No timer or frame is scheduled, so `scheduler.pending()` is unaffected. No reaction pose was invented. Attacks and the summon take precedence. |
| After a cue or hold | Idle restarts at the clip's first frame. |
| `remove()` | `piece.gone`: not animated while it fades; frozen in its last pose. |
| `destroy()` (remove end, `clear()`, `reset()`) | `piece.owned` disposer: mixer stopped and uncached, callback replaced by a no-op, `gone` set. A saved stale callback does nothing. |
No game rule, damage or engine code was touched; `src/main.js` and `rig.js` were not edited.

## Checks run
- `node --test tests/match/sheriff.test.js tests/match/sheriff-idle.test.js tests/match/attack-clips.test.js`: 17 tests, 17 pass, 0 fail. Run once after edits, and once more after fixing two assertions in my new test (a guessed head-turn timestamp and a wrong upper bound on the head angle).
- `npm run build`: built `dist/cowboys-vs-wizards-board-duel.html`.
- `git diff --check`: clean.
- Existing Sheriff results unchanged: sole drift 1.4e-15, under tile 3.3e-16, muzzle travel 0.516 heights, chest lean 11.95 degrees, orb lost at the cue's impact in the seed 0 duel.
- Data fidelity (`sheriff-idle.test.js`): the JSON file hash matches `.SOURCE.json`; every time and value equals the approved GLB accessors (read from the preview worktree path, or `SHERIFF_APPROVED_GLB`; that comparison prints a note and is skipped when the file is absent); the board Sheriff's bones match independent linear/slerp sampling of the tracks at 0, 0.4, 1.0, 1.7 and 2.3 s within 2e-6.
- Also covered: two Sheriffs are independent (separate mixer and clip, no shared state) and seated on their own tiles; after an idle, `drawSheriff` produces the same bone matrices as on a Sheriff that never idled; attack and summon suppress and resume the idle; orb-loss hold; remove, clear and reset leave stale callbacks inert and `scheduler.pending()` at 0.
- Not run: Wizard test (shared idle code unchanged), full suites, browser capture, Blender.

## Remaining limits
- Not visually verified. The coordinator must review it in the actual match.
- The clip's first frame is a Mixamo standing pose, not the Sheriff's procedural rest pose. Cues start and end in the rest pose, so the pose cuts when the idle starts and stops (no blend was added). The clip repeats back to back; its last and first frames differ by at most 3.4e-4.
- The head turns up to 42.5 degrees from the first frame (local quaternion angle); the source evidence quotes 34.81 degrees by another measure.
- The seated lift keeps the lowest foot on the tile; the other boot may hover if the clip lifts it. The holstered revolver follows the hips' translation but not their rotation.
- Idle plays only while the Sheriff is rendered (render callback, as before). The hit hold length is a judgment call, not a source value.
