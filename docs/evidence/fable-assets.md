# Asset report (job B)

Performed by Claude Fable 5.2 (Claude Code worker) on November 15, 2026, on branch
`fable/asset-audit`, Node v26.0.0. Everything below was observed in that run.

**Result:** `assets/models/` holds exactly eight `.glb` files. All eight are valid
GLB v2 containers. None has a skin, a joint or an animation clip.

This is a metadata report. It reads the GLB container and the JSON chunk only.
It cannot prove grip, smoothness or visual quality, and it says nothing about
how a model deforms or looks in the browser.

## Commands and results

Run from the worktree root.

| Command | Result |
| --- | --- |
| `node --test tests/assets/audit.test.mjs` | 15 tests, 15 pass, 0 fail, exit 0 (12 before the CLI tests below were added) |
| `node scripts/audit-assets.mjs` | 8 files, 0 invalid, exit 0 |
| `git status --short assets/` before and after the script | no output both times |
| `shasum -a 256 assets/models/*.glb` before and after the script | identical; modification times also identical |

## CLI exit code (automated)

Added by Claude Fable 5.2 (Claude Code worker) on November 15, 2026, on branch
`fable/asset-cli-test`, Node v26.0.0.

The CLI takes an optional directory: `node scripts/audit-assets.mjs [dir]`.
Without it the input is still `assets/models/`. Three tests spawn the real CLI
with `node:child_process` on a directory from `fs.mkdtempSync` under
`os.tmpdir()`, which each test removes afterwards. They write nothing inside
the repository.

| Temporary directory holds | Exit code | Output checked |
| --- | --- | --- |
| one malformed `.glb` (a valid file cut 4 bytes short) | 1 | `ERROR bad.glb: header length ...` and `1 .glb files, 1 invalid` |
| one valid minimal `.glb` | 0 | no `ERROR`, `1 .glb files, 0 invalid` |
| nothing | 1 | `0 .glb files, 0 invalid` |

One mutation check: with the line `if (failed || !names.length) process.exitCode = 1;`
removed, all 15 tests ran, 13 passed and 2 failed (the malformed-file and
empty-directory CLI tests, both `actual: 0, expected: 1`). After restoring the
line: 15 pass, 0 fail. No `audit-assets-*` directory was left in the temporary
folder, `git status --short assets/` printed nothing, and the SHA-256 of all
eight `.glb` files was identical before and after.

## Script output

```
| file            | bytes   | meshes | vertices | triangles | skins | joints | clips | extensions                             | unknown because |
| --------------- | ------- | ------ | -------- | --------- | ----- | ------ | ----- | -------------------------------------- | --------------- |
| billy.glb       | 2531696 | 1      | 25906    | 44000     | 0     | 0      | none  | KHR_materials_volume, FB_ngon_encoding | -               |
| board.glb       | 2988784 | 1      | 10864    | 14500     | 0     | 0      | none  | KHR_materials_volume, FB_ngon_encoding | -               |
| cowboy-tile.glb | 1023316 | 1      | 3944     | 5000      | 0     | 0      | none  | KHR_materials_volume, FB_ngon_encoding | -               |
| gateway.glb     | 1485068 | 1      | 11756    | 17500     | 0     | 0      | none  | KHR_materials_volume, FB_ngon_encoding | -               |
| revolver.glb    | 704192  | 1      | 6435     | 8500      | 0     | 0      | none  | KHR_materials_volume, FB_ngon_encoding | -               |
| saloon.glb      | 1864684 | 1      | 17929    | 19500     | 0     | 0      | none  | KHR_materials_volume, FB_ngon_encoding | -               |
| wizard-tile.glb | 989836  | 1      | 4078     | 5000      | 0     | 0      | none  | KHR_materials_volume, FB_ngon_encoding | -               |
| wizard.glb      | 2845456 | 1      | 27607    | 44000     | 0     | 0      | none  | KHR_materials_volume, FB_ngon_encoding | -               |
8 .glb files, 0 invalid
```

- **No skins or joints:** all eight (billy, board, cowboy-tile, gateway, revolver,
  saloon, wizard-tile, wizard).
- **No animation clips:** all eight.
- No file uses Draco or meshopt, so no geometry count is unknown here.
- Byte sizes, mesh counts, skins and clips match the earlier Codex inventory in
  `asset-rig-inventory.json` for all eight files. That inventory lists the old
  `assets/*.glb` paths.

## What the numbers mean

- Vertices are the `POSITION` accessor counts summed over mesh primitives.
  Triangles are index count / 3, or vertex count / 3 for an unindexed primitive.
  Each primitive is counted once, not once per node that uses the mesh.
- These are the counts the JSON declares. The script does not decode the binary
  chunk or check that accessors fit their buffers.
- Every file declares `FB_ngon_encoding`, so the triangle counts are of the
  triangulated mesh, not the original polygon faces.
- Joints are distinct joint nodes across all skins.

Reported as `unknown`, never 0:

| Case | Vertices | Triangles |
| --- | --- | --- |
| Draco-compressed primitive (the decoder defines the counts, not the accessors) | unknown | unknown |
| Primitive with no usable `POSITION` accessor | unknown | unknown |
| Mode other than 4 (points, lines, strips, fans) | counted | unknown |
| Index count missing or not a multiple of 3 | counted | unknown |

One unknown primitive makes the file total unknown; there is no partial sum.
Meshopt compresses buffer views below the accessors, so accessor counts stay
authoritative and are counted. A file with no meshes reports 0, because that
is known.

Rejected with a per-file error and exit code 1: fewer than 12 bytes, wrong
magic, version other than 2, header length different from the file length
(covers truncation and trailing bytes), a chunk header or chunk body past the
end of the file, a first chunk that is not JSON, no chunk at all, JSON that
does not parse or is not an object.

## Mutation checks

Each guard was removed from `scripts/audit-assets.mjs` in place, the test
command above was run, and the script was restored. This was done before the
CLI tests existed, when the file had 12 tests. All 12 ran each time, so each
red is a failed assertion, not a startup crash.

| Guard removed | Result | Test that went red |
| --- | --- | --- |
| Chunk-bounds check | 11 pass, 1 fail | chunk running past the end of the file is rejected |
| Chunk-header bounds check | 11 pass, 1 fail | chunk running past the end of the file is rejected |
| Header-length check | 11 pass, 1 fail | header length that differs from the file length is rejected |
| Unknown treated as 0 in totals | 9 pass, 3 fail | undetermined geometry is unknown, never zero; one undetermined primitive makes the file total unknown; report sorts by filename |
| Non-triangle mode branch | 11 pass, 1 fail | undetermined geometry is unknown, never zero |
| Draco branch | 11 pass, 1 fail | undetermined geometry is unknown, never zero |
| First-chunk-is-JSON check | 11 pass, 1 fail | first chunk must be JSON |
| Magic check | 11 pass, 1 fail | bad magic is rejected |

After restoring, the script's SHA-256 matched its pre-mutation value and the
test command gave 12 pass, 0 fail.

## Next actions, following `character-animation-plan.md`

1. **Wizard rest-mesh and staff audit (plan step 2).** `wizard.glb` is one glTF
   mesh with no skin. Metadata cannot tell whether the staff is a separable part
   of that mesh. Inspect it in Blender (front, side, hand close-ups), measure the
   arm and hand landmarks, and record either "riggable as is" or a concrete
   request for an empty-hand export plus a separate staff.
2. **Rig the wizard only (step 3).** Staff on a separate attachment, at most 50
   deforming bones, at most four influences per vertex. Save the rigged model
   as a new file; leave `wizard.glb` untouched.
3. **Author idle, cast, hit and defeat (step 4), export and load in the browser
   renderer (step 5).** Rerun `node scripts/audit-assets.mjs` on the new export.
   It should then show one or more skins, a joint count within the budget and
   those four clip names. That only shows the data exists; grip, foot contact
   and how the motion reads need the rendered checks in the plan.
4. **Billy next (step 6).** `billy.glb` is also one unskinned mesh, and
   `revolver.glb` is already a separate file. Clips needed: idle, draw/shoot,
   hit, defeat.
5. **No rig needed** for board, cowboy-tile, wizard-tile, gateway and saloon
   under the plan; they are static scenery. The revolver needs an attachment
   point on Billy's rig, not a skeleton of its own.

Not done here: no Blender inspection, no browser load, no build, no scale or
frame-rate measurement. The script does not check 4-byte chunk alignment,
`asset.version`, or accessor and buffer-view bounds.
