# Kiro CI coverage (issue #67)

Author: Kiro CLI 3.4.0. Base: main at 7ff323f. Source: https://github.com/alejandro-publius/cowboys-vs-wizards/issues/67

## Change
`.github/workflows/ci.yml` now runs, after `npm ci` and `npm test`:
1. `npm run build -- --web`
2. `node --test .kiro/powers/orb-duel-review/test/server.test.mjs`
3. `python3 -m unittest test_night_watch` (working directory `apps/night-watch/backend`)

Unchanged: `contents: read`, `persist-credentials: false`, Node 22, `npm ci`. No secrets, no new actions, no publishing or deploy steps. The Python tests are dependency-free and use the runner's system `python3`.

## Local verification (macOS, Node v26.0.0, Python 3.9.13)
- `npm test`: exit 0 (ends with `2/2 file(s) passed structural checks`).
- `npm run build -- --web`: exit 0, `Built dist/web/index.html` (dist/ is untracked by git).
- Review server: 4 tests, 4 pass, 0 fail.
- Night Watch: `Ran 6 tests ... OK`.

## Not verified
The workflow has not run on GitHub Actions (no push). Local Node is v26, not CI's Node 22, and Python is 3.9 rather than the runner's python3.
