# orb-duel-replay report

Source: the two workflow step results (`verify-duel`, `verify-showdown`). No source was edited by either step.

## Run 1: seed 0 (step `verify-duel`)

| Field | Value |
|---|---|
| Command | `node scripts/verify-duel.mjs --browser` |
| Exit status | 0 |
| Revision | e9aeb06 |
| Observed steps | 8 of 8 (pending step IDs: none) |
| Console errors | 0 |
| Build SHA-256 | `a5d0c756077e89afa4f8a107c64e863a7d09cba48456f8229a8b42b4fa208bd2` |
| Receipt path | `.artifacts/kiro/replay/browser-run.json` |

Other results from this step:
- Node tests: 157 tests, 157 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo (4845.95 ms).
- Asset structural checks: 2 of 2 files passed (`dragon.glb`, `mounted-billy.glb`). Structure only, not motion quality.
- Build output: `dist/cowboys-vs-wizards-board-duel.html`.
- Browser: Chrome/157.0.8103.52, seed 0.

## Run 2: seed 60 (step `verify-showdown`)

| Field | Value |
|---|---|
| Command | `node scripts/browser-match-check.mjs --showcase --summary --out-dir .artifacts/kiro/showcase` |
| Exit status | 0 |
| Revision | e9aeb06 |
| Observed steps | 4 of 4 (pending step IDs: none) |
| Console errors | 0 |
| Build SHA-256 | `a5d0c756077e89afa4f8a107c64e863a7d09cba48456f8229a8b42b4fa208bd2` |
| Receipt path | `.artifacts/kiro/showcase/browser-run.json` |

Browser: Chrome/157.0.8103.52, seed 60.

## Hash comparison

The two build SHA-256 values are identical, so both replays used the same standalone duel HTML. Both values are the hashes printed by the replays. Neither step hashed the file separately.

## Pending values

None. Every requested field was reported by both steps.
