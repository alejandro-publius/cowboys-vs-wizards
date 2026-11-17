# Project files: where things are

Prepared by Kiro CLI on November 16, 2026 (America/Los_Angeles) from the repo at commit `599450a` and the user's existing hub folder. Codex found the hub and prepared the brief. The hub's earlier organization and all art were not made by Kiro. Checks and limits are in [kiro-project-assets-closeout.md](evidence/kiro-project-assets-closeout.md); a machine-readable list is in [project-assets-manifest.json](evidence/project-assets-manifest.json).

## Start here

The hub is `/Users/alexvintera/Documents/Kiroween/Cowboys vs. Wizards`. Open **3D Models / Key characters** for labelled shortcuts to the models you asked about:

| Character | Original Tripo export (unedited) | Game version |
| --- | --- | --- |
| Mounted Billy (Billy on horseback) | `3D Models/Original GLBs/cowboy riding horse 3d model.glb` | `assets/models/mounted-billy.glb` |
| Purple Dragon | `3D Models/Original GLBs/purple dragon 3d model.glb` | `assets/models/dragon.glb` |
| Skeleton | `3D Models/Original GLBs/skeleton warrior 3d model.glb` | `assets/models/skeleton.glb` |

## Categories

| Category | What it means | Where |
| --- | --- | --- |
| Original | The user's Tripo downloads, 63–71 MB each, never edited. 16 files; all match `SHA256SUMS.txt`. | hub `3D Models/Original GLBs`; verified copies of 14 also in `Archive/Browser Download Copies/3D Models` |
| Optimized runtime | Reduced copies that the game loads, 0.7–4.8 MB each. | repo `assets/models/` (hub `3D Models/Game GLBs`) |
| Game-authored motion | Dragon and Mounted Billy carry `*_attack` and `*_idle` clips. The shipped files are byte-identical to the Blender export files. | `assets/models/dragon.glb`, `mounted-billy.glb`; Blender sources in hub `3D Models/Blender` |
| Approved source motion | One. Sheriff's Mixamo headShake, approved by the user on November 16, 2026. | `assets/animations/sheriff-headShake.json` and `.SOURCE.json`; preview in hub `Game/Animation previews/Sheriff stationary gesture` |
| Motion candidates | Other Sheriff, Billy, Dragon and roster previews. Several are rejected or pending the user's review. They are not in the game. | hub `Game/Animation previews` |
| Procedural rigs | Billy, Wizard and Sheriff are static meshes (no skin, no clips). Code in `src/render/rig.js` moves them. Skeleton is static too, and uses the game's summon, hit and defeat cues. | `src/render/` |
| Variant | `mounted-billy 2.glb`, found untracked in the old preflight checkout. Not used by the game. | hub `Archive/Model Variants` |

Optimized runtime files and their skeletons:

| File | Skins | Joints | Clips |
| --- | --- | --- | --- |
| `dragon.glb` | 1 | 12 | `dragon_attack`, `dragon_idle` |
| `mounted-billy.glb` | 1 | 11 | `mounted_attack`, `mounted_idle` |
| `skeleton.glb`, `sheriff.glb`, `billy.glb`, `wizard.glb` | 0 | 0 | none |

Mounted Billy's top-level Blender work folder holds an earlier candidate that failed the hand-deformation gate. The shipped file matches `Mounted Billy work/refined/`, and `Mounted Billy.blend` matches the refined rig.

## Other hub folders

| Need | Hub folder |
| --- | --- |
| Card art, generated concepts, reviews, Blender/Tripo reference repos | `Art and References` |
| Kiro brag sheet, build log, specs and workflows, per-task evidence | `Kiro` |
| Fable reports, opening-hand holdout, Dragon review | `Fable` |
| Demo video, Devpost draft | `Submission` |
| Earlier builds, bundles, prototype checkouts, moved-file list | `Archive` (`File Moves.tsv`) |
| Summary of this document | `Asset inventory.txt` |

## Licenses and provenance, only where recorded

- **Tripo originals.** The repo and hub record that they are the user's own Tripo exports. They contain no license file. Nothing in the repo shows their commercial terms. Those are Tripo's terms for the user's account and plan, so check them before treating the models as royalty-free.
- **Sheriff headShake.** `sheriff-headShake.SOURCE.json` records the motion as Mixamo headShake taken from three.js r180 `Xbot.glb` (sources listed in that file). It states that Adobe/Mixamo terms apply, not the three.js MIT code license. Codex retargeted it. The user approved the visible gesture ("perfect!!!"). The clip data (`sheriff-headShake.json`) has SHA-256 `de012cfb…`, which matches the `clipDataSha256` field.
- **Quaternius candidates** (Billy Pistol_Idle_Loop, Dragon Yes, RobotExpressive, Horse). The hub READMEs record them as CC0 with licenses retained alongside the sources. They are candidates only.
- **Sprite Fusion fire** (Dragon fire-ring preview): MIT, per its hub README.
- **Three.js and Rapier** notices ship in the build ([README](../README.md#assets-and-attribution)).
- No license is recorded for the Kiro-authored Dragon and Mounted Billy clips beyond the project repository itself.

## Current-release shortcuts (as of November 16, 2026)

Hub shortcuts to code, models and docs now point to a stable detached checkout, `.worktrees/current-release`, at `599450a`. The root checkout is expected to advance this checkout after integration.

- Game/Play offline.html and Game/Web build point to current-release/dist. Both builds exist; Codex verified these links and all 73 hub symlinks at 5:49 p.m. Pacific on November 16, 2026, after the recording worker built this checkout.
- Game/Previous release offline.html and Game/Previous release Web build preserve the old submission-preflight build at 177bac8. Play Cowboys vs. Wizards.webloc opens the live site. The two current-build links were pending during the earlier Kiro audit; the post-build note in the evidence records their resolution.
- Left on `submission-preflight` deliberately, because they are historical artifacts that do not exist in the stable checkout: `Kiro/Character release checks`, `Kiro/Skeleton release checks`, `Submission/Current demo captures and checks`, `Archive/Earlier Demo Videos/Demo before model import.mp4`.
- Task, replay and branch links still point to their own worktrees.
