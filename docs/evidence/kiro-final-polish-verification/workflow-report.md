# orb-duel-replay-final-polish report

Frozen game HEAD: 02b1bf8

## Run 1: seed 0 (verify-duel step)

| Field | Value |
|---|---|
| Command | `node scripts/verify-duel.mjs --browser` |
| Exit status | 0 |
| Revision | 02b1bf8 |
| Observed steps | 8 of 8 (pending IDs: none) |
| Console errors | 0 |
| Build SHA-256 | `873a8962396263a4feb2dc382bdb3f464cdb203d0eb19f1cc153caa82a3e6eca` |
| Receipt path | `.artifacts/kiro/replay/browser-run.json` |

Node tests: 157 run, 157 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo.
Asset structure preflight: 2 of 2 files passed (`dragon.glb`, `mounted-billy.glb`).
Browser: Chrome/157.0.8103.52, seed 0.

## Run 2: seed 60 (verify-showdown step)

| Field | Value |
|---|---|
| Command | `node scripts/browser-match-check.mjs --showcase --summary --out-dir .artifacts/kiro/showcase` |
| Exit status | 0 |
| Revision | 02b1bf8 |
| Observed steps | 4 of 4 (pending IDs: none) |
| Console errors | 0 |
| Build SHA-256 | `873a8962396263a4feb2dc382bdb3f464cdb203d0eb19f1cc153caa82a3e6eca` |
| Receipt path | `.artifacts/kiro/showcase/browser-run.json` |

Browser: Chrome/157.0.8103.52, seed 60.
Node test counts: not applicable to this command (pending; the verify-showdown step did not report them).

## Hash comparison

Seed 0 and seed 60 build SHA-256 values are identical (`873a8962…6eca`), so both replays ran the same built HTML.
