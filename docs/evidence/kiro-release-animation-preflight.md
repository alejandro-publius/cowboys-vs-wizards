# Release animation structure preflight

Date: 2026-11-16 (America/Los_Angeles). Branch: kiro-release-animation-preflight.

## What changed
- `scripts/check-sourced-animation.mjs` and `tests/assets/sourced-animation.test.mjs` were copied unchanged from Kiro's `kiro-sourced-motion-validation` worktree at d0bfb07. The script is byte-identical (sha1 425658f2...). Only these two files were imported, not that branch's history or docs.
- `scripts/verify-duel.mjs` now runs `scripts/check-sourced-animation.mjs assets/models/dragon.glb assets/models/mounted-billy.glb` right after the Node suites and before the optional `--browser` steps. It uses the existing `run` helper, so a nonzero exit stops verification with that status.
- Only the two animated shipped models are checked. Static models are not required to have animations. Rejected preview GLBs are not checked. No model, animation, rules or package file changed.

## Checks run (this worktree, node 26.0.0)
- `node --test tests/assets/sourced-animation.test.mjs`: 12 tests, 12 pass.
- `node scripts/verify-duel.mjs` (no browser): exit 0. 127 tests pass (the 115 existing plus these 12). Then `PASS assets/models/dragon.glb` and `PASS assets/models/mounted-billy.glb`, 2/2 files passed.
  - Dragon: 1 skin, 12 joints, clips dragon_attack and dragon_idle, 72 channels.
  - Mounted Billy: 1 skin, 11 joints, clips mounted_attack and mounted_idle, 66 channels.
- Negative check: a 100000-byte truncated copy of dragon.glb in `.artifacts/preflight/` (ignored by git) made the CLI exit 1 with `container: header length 4776532 does not match file length 100000`. The original GLBs were not touched (`git status` shows them unmodified). The standalone CLI was used for this, not a full verify-duel run.
- No unsupported glTF feature was found in either shipped GLB.

## Limits
A structure pass shows the animation arrays are well formed and in range. It is not motion, visual or provenance approval, and no browser replay was run for this change.
