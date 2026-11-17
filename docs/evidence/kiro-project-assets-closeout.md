# Kiro project assets closeout

Kiro CLI (default configuration; no model override requested), November 16, 2026, America/Los_Angeles, worktree `kiro/project-asset-index` from `origin/main` `599450a`. Codex found the existing hub and wrote the brief. Kiro did not create the earlier organization or any art. Navigation: [project-files.md](../project-files.md). Data: [project-assets-manifest.json](project-assets-manifest.json).

## What was inspected

Hub: `/Users/alexvintera/Documents/Kiroween/Cowboys vs. Wizards` (`START HERE.txt`, `3D Models/Original GLBs/SHA256SUMS.txt`, `Archive/File Moves.tsv` 60 lines, `3D Models/Blender`, `Game/Animation previews`, `Game/Firebolt preview`, `Game/Opening hand playtest`, Archive, Kiro, Fable, Submission). Repo: `assets/models` (14 GLBs), `assets/animations` (2 files), `docs/character-animation-plan.md`, `docs/evidence/{asset-rig-inventory.json, sheriff-asset.md, kiro-character-assets.md, kiro-approved-sheriff-idle.md, sheriff-transition-blend.md}`. Scoped name filter of `~/Downloads` (552 top-level entries) and `~/Desktop` (42). No other folder was scanned.

## Results

| Check | Result |
| --- | --- |
| `shasum -a 256 -c SHA256SUMS.txt` in `Original GLBs` | 16 of 16 OK; folder has 17 entries (16 GLBs plus the sums file). Sizes 63,566,204 to 70,631,380 bytes. |
| Named originals exist | `cowboy riding horse 3d model.glb` 68,739,708 B, `a22a69b9…`; `purple dragon 3d model.glb` 69,823,740 B, `a251d332…`; `skeleton warrior 3d model.glb` 67,733,240 B, `c82288b6…`. Full hashes in the manifest. |
| Manifest hashes vs `SHA256SUMS.txt` | 16 of 16 equal (Python comparison). |
| `Archive/Browser Download Copies/3D Models` | 14 GLBs; their hashes all appear in `SHA256SUMS.txt`. `card back` and `western gunslinger` have no Archive copy (File Moves lists them as moved originals). |
| GLB JSON chunk read (counts only, no binary dumped) | All 6 original character exports and `skeleton/sheriff/billy/wizard.glb`: 0 skins, 0 clips. `dragon.glb`: 1 skin, 12 joints, 2 clips. `mounted-billy.glb`: 1 skin, 11 joints, 2 clips. |
| Runtime vs Blender exports | `dragon.glb` = `Dragon work/dragon-rigged.glb` (`8d17261b…`). `mounted-billy.glb` = `Mounted Billy work/refined/mounted-billy-rigged.glb` (`22ebf3bc…`); the top-level `mounted-billy-rigged.glb` (`d8cb43cb…`) is the earlier candidate. |
| `Sheriff stationary gesture/sheriff-mixamo-headShake-preview.glb` | SHA-256 `d9d2ea2e…` equals `approvedGlb.sha256` in `assets/animations/sheriff-headShake.SOURCE.json`. |
| `assets/animations/sheriff-headShake.json` | SHA-256 `de012cfb…` equals `clipDataSha256`. |
| Runtime models vs old `submission-preflight` | All 14 GLBs byte-identical. The two `assets/animations` files do not exist there. |
| `inspect_character_asset` MCP tool | Could not run: permission prompt unavailable in non-interactive mode. The JSON-chunk read above replaced it. Triangle counts were not measured. |

## Sheriff approved motion record

`sheriff-headShake.SOURCE.json`: clip `Mixamo_headShake_retargeted`, 2.5667 s, 78 keyframes, 17 tracks; motion from Mixamo headShake via three.js r180 `Xbot.glb`; terms "Adobe/Mixamo terms apply, not the three.js MIT code license"; retarget by Codex; user approval "perfect!!!" on 2026-11-16; art is the user's Tripo Sheriff, unchanged. `kiro-approved-sheriff-idle.md` and `sheriff-transition-blend.md` repeat the same source and attribute runtime integration to Kiro and the blend to Codex. The repo does not contain a copy of Adobe's terms, only the link.

## Symlink audit (hub, `find -type l`, never followed into directories)

After all changes: 73 links. 71 resolve; 2 are intentionally broken pending a build (`Game/Play offline.html`, `Game/Web build`). 20 point to `current-release` (18 resolve). 6 still point into `submission-preflight` (listed below). 47 point elsewhere: 14 are the new `Key characters` links, 33 are historical task, replay, research, prototype and reference targets.

Before changes: 57 links, 0 broken, 24 pointing into `submission-preflight`. 20 of those were retargeted (table below); 4 are historical and stay.

## Changes made to the hub (all reversible)

Created `.worktrees/current-release` with `git worktree add --detach … 599450a` (it did not exist). It is clean, with no `dist`, `.artifacts` or `node_modules`.

Retargeted existing symlinks only (old target → new target; new = `current-release/` plus the path shown). Nothing that was a real file was changed.

| Hub link | Old target (under `.worktrees/submission-preflight/`) | New path under `current-release/` |
| --- | --- | --- |
| `3D Models/Game GLBs` | `assets/models` | `assets/models` |
| `Game/Source checkout` | (checkout root) | (checkout root) |
| `Game/Web build` | `dist/web` | `dist/web` (not built) |
| `Game/Play offline.html` | `dist/cowboys-vs-wizards-board-duel.html` | same (not built) |
| `Art and References/Approved card art` | `assets/cards` | `assets/cards` |
| `Art and References/Environment and game media` | `assets/media` (relative form) | `assets/media` |
| `Kiro/Build log.md` | `docs/kiro-build-log.md` | same |
| `Kiro/Kiro brag sheet.md` | `docs/kiro-brag-sheet.md` | same |
| `Kiro/Workflow replay report.md` | `docs/evidence/kiro-workflow-replay.md` | same |
| `Kiro/Character asset evidence.md` | `docs/evidence/kiro-character-assets.md` | same |
| `Kiro/Specs and Workflows` | `.kiro` | `.kiro` |
| `Fable/Reports/<name>.md` for fable-match-engine, -sheriff-integration, -cpu-playtests, -assets, -wizard-readiness, -summon, -opening-holdout, -card-front-textures, -wizard-cast | `docs/evidence/<name>.md` | same |

To revert one, run `ln -sfn "<old absolute target>" "<hub link>"` with the old target above.

Created new items (nothing overwritten):
- `Game/Previous release offline.html` and `Game/Previous release Web build`, pointing to `submission-preflight/dist/…` (those files exist).
- `3D Models/Key characters/` with 14 relative symlinks: six originals, six optimized models, the approved Sheriff headShake GLB and its video. All resolve. The Billy and Wizard original pairings come from `asset-rig-inventory.json`, not from an explicit statement.
- `Asset inventory.txt` at the hub top level.

## Still pointing at `submission-preflight` (historical, left alone)

`Kiro/Character release checks`, `Kiro/Skeleton release checks`, `Submission/Current demo captures and checks` (all `.artifacts`, not present in a clean checkout), `Archive/Earlier Demo Videos/Demo before model import.mp4`, plus the two new Previous-release links.

## Limits and missing provenance

- Tripo license or plan terms for the originals are not recorded anywhere inspected. `Browser Download Copies` and `File Moves.tsv` prove file identity, not rights.
- The Mounted Billy original's SHA-256 is recorded only in the hub sums file. The Blender README cites its vertex count (1,032,549) but not its hash.
- No download receipt or Tripo task ID exists in the inspected files.
- Which original produced Billy and Wizard is inferred from the inventory JSON.
- Quaternius and Sprite Fusion license statements come from the hub preview READMEs. The license files they mention were not opened.
- `START HERE.txt` still describes `Play offline.html` and `Web build` as working; they are broken until `current-release` is built. It was not edited.
- Only `Downloads` and `Desktop` top-level names were scanned, with a name filter. Other folders were not audited.
- No builds, tests or game runs were done for this documentation change.

## Coordinator review

Codex checked the recorded Kiro completion (exit 0, 2026-11-17T01:37:10.203691+00:00) and corrected the manifest timestamp to that receipt. The original manifest clock value was unsupported. No model or Kiro audit result changed. JSON parsing passed after this metadata correction.


## Post-build coordinator verification

On November 16, 2026, at 5:49 p.m. Pacific (2026-11-17T01:49:50Z), Codex checked the hub again after the recording worker built the stable checkout. All **73 of 73 symlinks resolve**, including Game/Play offline.html and Game/Web build. The .worktrees/current-release checkout remained at 599450a27703fbdb8961d626c3e779512f54f29e; both dist/cowboys-vs-wizards-board-duel.html and dist/web/index.html exist. The earlier 71/73 count above remains the historical Kiro audit result, not the current state.

Codex updated the hub's Asset inventory.txt and appended this current-release check to START HERE.txt, preserving previous-build links. Pre-edit text copies are in this task's untracked artifact folder. This was a post-build path check, not another asset hash audit or game test.

The run receipt requests no model override, and the captured startup log does not identify the selected model. Therefore this receipt records **default CLI configuration**, not an observed Auto selection or cascade event.
