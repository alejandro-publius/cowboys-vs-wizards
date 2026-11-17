# Kiro documentation link hook (issue 46)

Status: verified. The hook fired on real Kiro `fs_write` saves, failed on a
deliberate broken link and passed after it was removed.
Source: integration candidate 099847adcaa03a228a7a3eb421889501a355e4bd (not
main). Hook commit on top of it: see `git log` for this file.

## Hook

- `.kiro/hooks/check-project-doc-links.json`: `PostFileSave`, matcher
  `(^|/)docs/.+\.md$`, command `node scripts/check-doc-links-hook.mjs`.
- `scripts/check-doc-links-hook.mjs`: reads the event JSON from stdin, skips
  untracked files, runs `node scripts/check-links.mjs` (offline, no build or
  tests), forwards its output, exits with its exit code, and appends a receipt
  to `.artifacts/doc-link-hook/receipts.jsonl` (ignored by git).

## Observed

- Client: actual Kiro CLI 3.4.0 V3, launched by the coordinator; session `sess_afff8afb-fe19-499a-a869-11e72f45f791`.
  The hook event on stdin carried that same `session_id`,
  `hook_event_name: "PostFileSave"`, the worktree `cwd` and the absolute
  `file_path` of this document. Environment had `KIRO_SESSION_ID`.
- `kiro-cli --version` on this machine: `kiro-cli 3.4.0`. The coordinator launcher receipt and stream log identify the same CLI
  session. The worker initially called itself IDE; the launcher is the
  authoritative attribution.
- No new session was needed: the hook added in this session fired on the
  next save.
- Failing save, 2026-11-17T06:04:43Z (UTC): `fs_write` added a fake link to
  `./does-not-exist-hook-proof.md`. Receipt status 1, checker output:
  `docs/evidence/kiro-doc-link-hook.md:10 -> ./does-not-exist-hook-proof.md`
  then `123 Markdown files, 394 relative links and images, 1 broken`.
  Receipt `.artifacts/doc-link-hook/fail-receipt.jsonl`, sha256
  `3e8af1fc7869580da0d809c13233c1f40af0e06dd16f591919762e866afe31a7`.
- Passing save, 2026-11-17T06:04:59Z (UTC): `fs_write` removed the link.
  Receipt status 0, `123 Markdown files, 393 relative links and images, 0
  broken`. Receipt `.artifacts/doc-link-hook/ok-receipt.jsonl`, sha256
  `6f8b0d1aeba662e521753f052b9541ce0f2c5c3866797fefddff2b4b0f82700d`.
- The write that saved this final text also triggers the hook; it is
  appended to `receipts.jsonl` and is not hashed here.

## Not shown

- No Kiro IDE run was performed.
- Whether the hook's non-zero exit is surfaced to the user in an interactive UI was
  not observed; only the receipt records it.
- Candidate checks (verify-duel, build) are the coordinator's report, not
  re-run here.

## Recheck with revised wrapper (a59aad6)

The sections above are historical proof for the old wrapper (candidate
099847a). They do not cover the revised wrapper.

- Revised wrapper commit: `a59aad6` ("validate document hook events and
  preserve checkout aliases"). The correction: the wrapper reads the structured
  JSON event, so file paths containing spaces work; it checks tracking with Git
  literal pathspecs; it resolves checkout aliases such as `/var` and
  `/private/var`; and it rejects files that resolve outside the checkout. The
  coordinator has five regression tests for this. I did not rerun them.
- Session: `sess_88cb21c9-4565-49b1-a423-4535069dba51`. The task described
  the client as Kiro CLI 3.4.0 V3; this session's own metadata reported
  Kiro IDE. I did not verify the client independently.
- Failing save, 2026-11-17T06:21:54Z (UTC): `fs_write` added
  `[broken link](./intentional-missing-hook-recheck.md)`. Receipt status
  `failed`, `124 Markdown files, 397 relative links and images, 1 broken`.
- Passing save, 2026-11-17T06:21:59Z (UTC): `fs_write` removed the link.
  Receipt status `passed`, `124 Markdown files, 396 relative links and images,
  0 broken`.
- Both receipts are in the ignored `.artifacts/doc-link-hook/receipts.jsonl`
  (lines 1 and 2, `PostFileSave`, the session ID above). The write that saved
  this section also triggers the hook and is not recorded here.
