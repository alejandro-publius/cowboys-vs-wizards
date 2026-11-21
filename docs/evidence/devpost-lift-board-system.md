# Devpost lift: board-system worker (Kiro CLI 3.5.0)

Date: 2026-11-20, America/Los_Angeles. Branch `kiro/devpost-lift-board-system`, base main `ea183ee`.
Agent: Kiro CLI worker board-system. No human played or reviewed anything for this note.

## What was added

- `.kiro/specs/showdown-board-zones/requirements.md`: Fable's Boot Hill board pass restated as
  checkable IDs BZ-01 to BZ-12, plus review rules RV-01 to RV-05 and Fable's open decisions.
- `.kiro/specs/showdown-board-zones/design.md`: each ID mapped to an existing repo check, run
  preconditions, and the outside references (X-047 InteractionKit, X-049 SpookBnB, video 55) as given
  in the brief. This worker did not re-read them; no Web was used.
- `.kiro/specs/showdown-board-zones/witness/*.snippet`: two broken-witness scripts.
- `.kiro/workflows/showdown-board-review.workflow.json`: native recipe with inputs `expected_sha` and
  `base_sha`. It has a gate, a `parallel` step running two tracks (`rules-flow`, `privacy`, `joinPolicy: all`)
  and a join. The structure copies `independent-release-review` and `showdown-ride-search`.

No game source, CSS, QA runner or package file changed.

## Status

The recipe has **not** been launched. No native workflow run, spec execution or K-003 receipt exists
for it. Launch it only on the combined board commit (UI + CSS + `scripts/browser-showdown-board-zones.mjs`),
from a detached clean checkout of that commit:

    run_workflow workflowPath=<repo>/.kiro/workflows/showdown-board-review.workflow.json
      inputs: expected_sha=<40-hex combined commit>, base_sha=ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df

## Measured on main `ea183ee` (manual commands, not a workflow run)

Setup: macOS, default Chrome path, shared `node_modules` symlink, outputs under ignored `.artifacts/`.

| Command | Exit | Observed |
| --- | --- | --- |
| `npm run build` | 0 | `build ea183ee29dbd`; HTML SHA-256 `d570e411…1cbc3c` |
| `grep -c "$(git rev-parse --short=12 HEAD)" candidate.html` | 0 | 1 match (build label) |
| `MODES=hotseat node scripts/browser-showdown-modes-check.mjs candidate.html …` | 0 | 1 check passed, 8.6 s |
| same on `witness-curtain-leak.html` (SHA-256 `50d42102…8c8350`) | 1 | `not ok - [hotseat] card ids behind the curtain: cowboy-bear-trap-1,cowboy-deadeye-1,cowboy-ranger-1,cowboy-covered-wagon-2` |
| same on `witness-zone-break.html` (SHA-256 `5fddf7a6…26c8fa`) | 0 | expected: the witness touches only `data-zone` markup, which main lacks |

So the existing hotseat check detects the curtain witness, and the zone witness does not break
unrelated flows. The witness insertion command in the gate prompt was run literally and gave the
same leak witness bytes as the measured one.

## Limits and pending

- `scripts/browser-showdown-board-zones.mjs` is not on main. Its interface is assumed to be
  `<html> <outDir>`, exiting non-zero on failure. The recipe tells the steps to follow the script's
  header if it differs. Whether it detects either witness is unmeasured.
- The zone-break witness is untested against real `data-zone` markup.
- The "public gate" in BZ-12 has no path set in the design, so it is pending in every review.
- These checks run headless Chrome on one Mac. They cover flow, DOM content and hidden information
  only. Appearance, clarity, fun and real phones are not covered.
