# Night Shift review as a native Kiro workflow (K-071, K-048, K-050, K-082)

November 20, 2026, America/Los_Angeles. Worker: Kiro CLI (V3, model claude-opus-5.5), session
`sess_c0312de9-92fe-466e-b6cc-688b13fa4b58`, branch `kiro/showdown-sprint-night-native` at
`4069bf99cf8d37e1cb96b5720b88995df00540ed`.

**This is a test of tooling on a staged input.** It is not a balance finding or proposal. No card, rule, deck,
wording, band, scheduled-issue setting or GitHub issue changed. No human played; all games are CPU vs CPU with
the level-2 bot.

## Question

Does the saved recipe `.kiro/workflows/night-shift-review.workflow.json` run end to end as a native Kiro
workflow: a draft step, a separate reviewer step, then a re-verify step? Does the reviewer's guard reject the
same Sheriff health 3→4 draft that the direct CLI run rejected in [night-shift.md](night-shift.md#guard-on-a-deliberately-failing-candidate)?

## Input (staged)

- Finding: Night Watch staged scheduled report `e6713af867dc` on `e813ae8`, seeds 0–999 from both seats. Its
  band of 45–55% was illustrative, not a design target ([staged-scheduled.json](night-shift/staged-scheduled.json)).
- The original finding file `/tmp/nj/finding.json` (SHA-256 `2abc834f…`) no longer exists. I rebuilt it as
  [staged-finding.json](night-shift-native-showdown/staged-finding.json) from that run's record, plus
  `byStartingSide` from the [earlier proposal](night-shift/guard-sheriff-health-3-to-4/proposal.json). Its
  SHA-256 is `26bce4b6…6903`. `rules.tests` is unknown, so it is `null`. `rules.state` is `passed` because the
  scheduled run only reports after its rule tests pass. The file is labelled staged inside.
- Candidate: `cowboy-sheriff` `health` 3→4. This is the same staged example. The patch hash `8dbd4321…fad8` is
  identical to the earlier draft's.

## Native run

One `run_workflow` call from this session, with `workflowPath` set to the saved recipe and inputs
`finding=.artifacts/night-shift-native/finding.json report=e6713af867dc card=cowboy-sheriff field=health to=4`.
There was no retry.

Workflow `wf_0756c413da3e189f`: **completed**, with all three steps completed.

| Step | Agent / session | Command (run once) | Result |
| --- | --- | --- | --- |
| `draft-candidate` | wf-coder `sess_589bad8d-4676-4abf-8e51-0fca678801fc` | `night-review.mjs draft --finding … --report e6713af867dc --card cowboy-sheriff --field health --to 4` | exit 0. Draft `cowboy-sheriff-health-3-to-4-4069bf99-f26bce4`, base `4069bf9`. No file edited |
| `independent-review` | wf-code-reviewer `sess_406a6f44-11c2-49e6-948d-8b4cf26d51fd` | `night-review.mjs review --bundle .artifacts/night-review/<id>` | exit 1, **rejected** |
| `verify-proof` | wf-coder `sess_805fed90-183e-4ad5-b78d-49b6f5c58c37` | `night-review.mjs verify --bundle … --rerun` | exit 0: "ok (games replayed); recorded verdict rejected; tool script matches the current file" |

The review is recorded in [bundle.json](night-shift-native-showdown/bundle.json): `bundleSha256` `c5a38d59…fdcab3`,
created 08:59 AM PST. Its surface field is `local-cli`, not Kiro Web.

- Finding reproduced at `e813ae8` with Night Watch's runner: 2,000 games, Cowboys 1,188, first player 1,142,
  with no mismatched counts. It still holds at the base `4069bf9`, whose Showdown rules and cards are unchanged
  from `e813ae8`.
- Properties: 21/21 on the baseline and 21/21 on the candidate.
- Tune seeds 0–999: Cowboy share 59.40% → 63.60%, so faction skew went 9.40 → 13.60 pp. First seat went 57.10% →
  57.90%. Paired flips: 117 toward Cowboys, 33 toward Wizards.
- Holdout seeds 1000–1999: Cowboy share 61.05% → 65.30%, so skew went 11.05 → 15.30 pp. First seat went 58.25% →
  59.20%. Flips: 119 toward Cowboys, 34 toward Wizards.
- The advisory test `prototypes/showdown/rules.test.js` failed 5 of 27. It does not count toward the verdict,
  and the earlier direct run recorded the same five failing tests.
- Verdict reasons: "tune: faction skew 9.40 -> 13.60 pp did not improve" and the same for holdout.

These shares and skews equal the earlier direct CLI run on base `e813ae8`. The verdict matches too.

## Answer

The native chain works on this input. A separate reviewer agent decided the draft, the guard rejected it, and the
re-verify replayed every game and recomputed the same rejected decision. "Native" here means that Kiro
orchestrated the three steps. Each step ran the same local `scripts/night-review.mjs` command that the direct run
used.

## Not exercised

- An **accepted** verdict through the native workflow. Exercising it would need a new candidate, which was out of
  scope.
- The draft-step input refusals, and the reviewer's "no candidate to review" path. Pending.
- Scheduled Night Watch → reviewer hand-off with a real band. No band is approved, so this is pending and
  user-only.

The bundle, proposal, patch and staged finding are copied unchanged. Their only machine path is the staged
finding's note naming the deleted `/tmp/nj/finding.json`.
The game records and the `.artifacts/` tree are not committed.
