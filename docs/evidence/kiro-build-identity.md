# Build identity for the live site (issue #54, checklist item 4)

Agent: Kiro CLI 3.4 (V3), owned worktree off `main` e23063342ecc84ddb68c1e1f705caa9cf668850b. Nothing was pushed, merged or deployed.

## What changed
- `scripts/write-build-identity.mjs` writes `dist/web/build.json` after the web build: `version` 1, exact 40-hex `commit`, ISO UTC `builtAt`, SHA-256 of `index.html`. No paths, session data or environment values. The commit comes from `--commit` or, failing that, `GITHUB_SHA`; invalid input exits 1.
- `scripts/verify-build-identity.mjs` takes the expected commit and expected `index.html` digest from the caller. It fetches the live `build.json` and the live `index.html`, and fails unless the manifest commit, the manifest digest and the digest of the served HTML bytes all equal the expected values. The manifest is parsed as JSON only, and no URL in it is followed. Requests carry a `?cb=` query, a 10 s timeout and up to 8 attempts 5 s apart. It then exits 1 with the last reason.
- `.github/workflows/pages.yml`: the build job writes the manifest and exports the `index.html` digest as a job output. The `deploy` job is unchanged except that it exposes `page_url`. A new `verify-live` job (`needs: build, deploy`, `contents: read` only, `persist-credentials: false`, no `continue-on-error`) runs the verifier with `$GITHUB_SHA` and the build job's digest. `pages: write` and `id-token: write` stay on `deploy` only. Existing `concurrency: pages` still serializes runs.
- README Verify table: one new row.

## Checks run (local)
| Command | Exit |
| --- | --- |
| `node --test tests/assets/build-identity.test.mjs` (7 tests: valid manifest and exact hash; bad commit, digest, timestamp and extra keys; CLI env handling; local HTTP fixture success; wrong commit, tampered HTML, wrong digest, 404 and invalid JSON each failing after the attempt budget; retry then pass; bad expectations and non-https URL) | 0 |
| `npm run build -- --web` | 0 |
| `node scripts/write-build-identity.mjs --commit e23063342ecc84ddb68c1e1f705caa9cf668850b` | 0 |
| `node scripts/write-build-identity.mjs --commit zzz` | 1 (expected) |

Sample manifest from that local build (`dist/web/` is git-ignored, so this is not committed):

```json
{"version":1,"commit":"e23063342ecc84ddb68c1e1f705caa9cf668850b","builtAt":"2026-11-17T07:09:54.476Z","indexHtmlSha256":"ac0806f6bed48cbb2a32064bd89674c0c50245e379ca50e2d5dcaa57ffec8eb5"}
```

`shasum -a 256 dist/web/index.html` printed the same digest. The workflow YAML was not run through Actions or a YAML linter here.

## Expected behaviour after the coordinator merges
On a push to `main`, after `deploy`, `verify-live` passes once `https://alejandro-publius.github.io/cowboys-vs-wizards/build.json` reports the pushed commit and the served `index.html` hashes to the digest the build job computed. Until the CDN catches up it logs `Attempt n/8 failed: ...` and retries. After 8 failed attempts (about 35 s of waiting) the job fails.

## Remaining limits
- Live verification is pending: it can only happen after merge and deploy. The local HTTP fixtures are not live proof.
- A `workflow_dispatch` run on `main` deploys and verifies the dispatched commit, as a push does.
- The retry budget (about 35 s) may be short if Pages propagation is slower. It is a one-line change to `--attempts`/`--delay-ms`.
- The check proves the live HTML and manifest match this run's build. It does not cover other files such as `assets/`.
- The CI test workflow was not edited. `npm test` picks up the new test automatically.
