# Character animation plan

Prepared by Codex on November 14, 2026, Pacific time, from the user's Lucca Cerf reference. Proposed checks below are not passed results.

## Reference and limits

Source: [Lucca Cerf's character-factory-skills](https://github.com/luccacerfz/character-factory-skills), commit `2db5685a73b9089b703f8f9529cb7ac68f898f04`, MIT. Seven upstream documents are retained in `references/lucca-character-factory/` with the original license and source map. They are reference documents, not an installed executable pipeline.

The upstream Python tools, shell scripts and Unity C# importer are private and absent. Its commands cannot run here unchanged. Use its rigging, timing, contact and visual-review methods with our existing Three.js/GLB renderer. Keep the original art and approved board/card direction. Avoid a Unity migration or importing the full reference collection into every Kiro prompt.

## Verified starting point

See `evidence/asset-rig-inventory.json`. The optimized Billy and Wizard and their original Downloads exports have zero glTF skins, zero joint lists and zero embedded animation clips. The Sheriff original is also static. Existing `rig.js` supplies procedural deformation, so this finding does not mean the demo cannot move; it means we do not yet have exported skeletal animation suitable for the upstream pipeline. Blender 5.2.0 LTS is installed (version command verified); the upstream guide targets 4.5, so script/API compatibility requires checking. Its MCP connection has not been verified.

## Order

1. Finish the headless card engine, legal actions and combat-event contract in Kiro (`kiro-task-01.md`).
2. Audit the wizard's actual rest mesh and staff first. Inspect front/side and hand close-ups, identify whether the staff can be separated cleanly, and measure arm/hand landmarks. Do not guess a hand position from the posed bounding box. Record whether the existing model can be rigged or requires a new empty-hand export plus separate staff. This audit must name a concrete asset request if blocked.
3. Rig only that character, with the prop on a separate attachment, at most 50 deforming bones as an initial budget and up to four skin influences per vertex. Document any justified exception. Preserve the original GLB.
4. Author idle, cast, hit and defeat clips. Define wind-up, release, impact and recovery. Maintain a stable staff grip and intentional foot contacts. Summoning is a later clip once this set reads well.
5. Export GLB and load it into the actual browser renderer. Validate scale, axes, skin deformation, staff attachment, floor contact and animation transitions after import. Blender-only measurements cannot establish browser correctness.
6. Repeat for Billy with idle, draw/shoot, hit and defeat. Keep muzzle flash, shot, projectile impact, hit reaction and orb loss tied to explicit events from the same action ID. Damage is applied once by the engine; animation presents it and never computes damage independently.
7. Integrate card selection, placement, health-orb display and these reactions. Use the actual approved card back as a texture on a thin card mesh. Additional roster models remain explicit asset dependencies.

## Measurements and visual review

- Define physical scale before using millimetre thresholds: scene units currently are not documented as metres. Record the conversion and fixed sample rate.
- Initial upstream-inspired targets: idle loop positional closure within 2 mm, stance pose differences within 1 mm, planted-foot drift within 1 mm per sampled frame. Airborne and intentional travel intervals are excluded by declared clip metadata, not by hiding failing frames.
- Check skinned surfaces and prop contact, not only joint or socket origins. A zero socket drift does not prove a convincing hand grip.
- Inspect actual board-camera size as well as close-ups. Save idle, wind-up, release/contact, hit, and defeated frames; include an actual-size silhouette. The 64-pixel upstream test is a reference, not an assumed size for our camera.
- Read `character-clips.md` sections 2c, 2d, 5 and 6b for the wizard; `character-rig.md` sections 2–5 for landmarks/props; `character-engine.md` section 1 for post-export checks. Its scripts are examples of methods, not available executables.
- Review one captured attack before spending credits on the remaining set. Fix demonstrated blockers first. A numerical contact check supports geometry; the rendered result supports appearance. Neither guarantees a judge score.

## Credit discipline

Load only the relevant reference section for each task. Work on one character and one clip at a time. Reuse meshes, materials and the existing scene. Use deterministic scripts for measurements. Request visual criticism only against captured evidence; do not launch repeated critic rounds without a new change. Do not run paid Tripo generation or reference-video APIs under this brief.

