# Devpost lift: board-system worker (Kiro CLI 3.5.0)

Date: 2026-11-20, America/Los_Angeles. Branch `kiro/devpost-lift-board-system`, base main `ea183ee`.
Agent: Kiro CLI worker board-system. No human played or reviewed anything for this note.

## What is here

- `.kiro/specs/showdown-board-zones/requirements.md`: Fable's Boot Hill board pass as IDs BZ-01 to
  BZ-12, review rules RV-01 to RV-05, Fable's open decisions. File-only spec: **K-003 unverified**.
- `.kiro/specs/showdown-board-zones/design.md`: ID-to-command map and run preconditions.
- `.kiro/workflows/showdown-board-review.workflow.json`: inputs `expected_sha`, `base_sha`. Steps:
  `gate` → parallel `rules-flow` + `privacy` (`joinPolicy: all`) → `join`. Pattern from
  `independent-release-review` and `showdown-ride-search`.

No game source, CSS, QA script or package file changed. The QA script is board-replay's
`scripts/browser-showdown-board-zones.mjs` at `490f005`, as recorded in `../board-qa-command.txt`.

## Recipe commands (`Q` = `node scripts/browser-showdown-board-zones.mjs --page dist/web/index.html --require-zones`)

| Step | Command | Must exit |
| --- | --- | --- |
| gate | SHA format, HEAD = candidate, detached, clean, base exists, script present, `node -e "require.resolve('playwright-core')"` | else `refused` |
| gate | `git diff --name-only <base> <sha> -- src/game/`; `node scripts/build-graybox.mjs --hosted`; `shasum -a 256 dist/web/index.html` | empty, label = sha |
| rules-flow | `Q --only raise,raise-narrow`; `Q --only raise,raise-narrow --witness break-pile`; `npm test` | 0, 1, 0 |
| privacy | `Q --only trap`; `Q --only trap --witness leak-name` | 0, 1 |

Each track rechecks HEAD and the page SHA-256 before and after, and compares the script's printed
revision and SHA-256 prefix with the gate's. Witness exit 0 (not caught) or 2 (usage) is a mismatch,
and the join's verdict is then `fail`. Commands run once in the foreground, with no retry.

## Measured on this branch at `1cd83b0` (main content, before zones UI; manual, not a workflow run)

The script was copied from `490f005` into the worktree for these runs and then removed.
`node -e "require.resolve('playwright-core')"` resolved v1.62.1 from the shared runtime without npx.

| Command | Exit | Last line |
| --- | --- | --- |
| `node scripts/build-graybox.mjs --hosted` | 0 | `build 1cd83b0ebeb5`; `dist/web/index.html` SHA-256 `5db47bef…9304eb3` |
| `node scripts/browser-showdown-board-zones.mjs --page dist/web/index.html --only trap` | 0 | `board zones: PASS · layout baseline · revision 1cd83b0ebeb5 · html sha256 5db47befe02e8e52` |
| same `--require-zones --only trap` | 1 | `board zones: FAIL · --require-zones but dist/web/index.html has the baseline layout` |
| same `--witness leak-name --only trap` (no `--require-zones`) | 2 | usage text |

So on a page without zones the recipe's positive tracks fail closed (exit 1), and the printed revision
and SHA-256 match the build. The witness exit 2 on a baseline page is outside the recipe, which
always passes `--require-zones` and treats 2 as a mismatch.

## Pending

- Positive and witness runs on the combined candidate (zones markup): coordinator's native launch.
- BZ-05 and BZ-11 have no asserting command; the "public gate" has no path set.
- Headless Chrome on one Mac: flow, DOM and hidden information only. No appearance, clarity, fun or
  real-phone claim.
