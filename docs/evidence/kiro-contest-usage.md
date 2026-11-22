# Kiro contest usage hook and submission check

- **State** — implemented, not run. No native Kiro session has fired these
  hooks yet, no receipt exists, and none of the commands below has been run
  by the authoring worker (it had no shell). The coordinator runs the
  reproduction and integration and records the results here.
- **Performed in** — Kiro (Opus 5.5 worker session, file tools only).
  The coordinator's launcher receipt is the authority for the exact client
  and version; this note does not assert one.
- **Problem** — the contest write-up needs usage facts that came from real
  sessions, not from the presence of configuration, and a quick offline
  check of the delivery rules (public licensed source with the root `.kiro/`
  directory, project URL, demo video).

## Files

| File | Purpose |
| --- | --- |
| [`.kiro/hooks/contest-usage.json`](../../.kiro/hooks/contest-usage.json) | `Stop` command hook: `node scripts/contest-usage.mjs` |
| [`.kiro/hooks/contest-usage-tools.json`](../../.kiro/hooks/contest-usage-tools.json) | Optional `PostToolUse` observer, same command. Kept in its own file so that, if the installed Kiro rejects this trigger or needs a matcher, the `Stop` hook still loads |
| [`scripts/contest-usage.mjs`](../../scripts/contest-usage.mjs) | Hook command. Reads stdin JSON, appends one sanitized line to ignored `.artifacts/kiro-contest-usage/receipts.jsonl`, always exits 0 |
| [`scripts/contest-usage-lib.mjs`](../../scripts/contest-usage-lib.mjs) | Pure sanitizing, folding and rendering functions |
| [`scripts/contest-usage-render.mjs`](../../scripts/contest-usage-render.mjs) | Appends unrendered `Stop` receipts to [`docs/KIRO_USAGE.md`](../KIRO_USAGE.md); `--check` reports without writing |
| [`scripts/contest-submission-check.mjs`](../../scripts/contest-submission-check.mjs) | Offline submission check (Node and Git only) |
| [`scripts/contest-usage.test.mjs`](../../scripts/contest-usage.test.mjs) | Node built-in tests for all of the above |

## Design decisions

- **Receipt file, then renderer.** The hook does not edit the tracked page.
  Concurrent sessions, the existing `PostFileSave` documentation hook and
  mid-session diffs make a direct append to a tracked Markdown file unsafe.
  The renderer is deterministic: rows are keyed by a 16-hex receipt ID,
  existing rows are never rewritten or removed (a lost receipts file deletes
  nothing), and a rerun appends only missing IDs.
- **Sanitized by construction.** The record is built from an allowlist:
  session ID (pattern-checked, so an email address cannot pass), event name,
  time, turn number, fixed tool categories, names of event fields, two
  booleans about `cwd` and `KIRO_SESSION_ID`, and the hook's own action.
  Tool names, tool inputs and outputs, prompts, paths and environment values
  are never copied. Tests feed a fake key, an email and a home path through
  every event type and assert none reaches the receipt.
- **Nothing inferred.** No row is produced from configuration. Client,
  model, credits and Crew or Web use are not recorded, because the hook
  event does not state them. Any such claim needs its own launcher receipt
  or screenshot.

## Submission check: automated vs human

`node scripts/contest-submission-check.mjs [--json] [--demo URL] [--site URL] [--repo URL]`

| Item | Kind | Decided by |
| --- | --- | --- |
| `kiro-tracked` | automated | `git ls-files -- .kiro` is non-empty |
| `kiro-not-ignored` | automated | `git check-ignore --no-index .kiro/` finds no rule |
| `kiro-tracked-but-ignored` | automated (warn) | tracked `.kiro` files that also match ignore rules |
| `kiro-untracked` | automated (warn) | `.kiro` files present but not committed |
| `kiro-json` | automated | every tracked `.kiro/**/*.json` parses |
| `license` | automated | root `LICENSE`/`COPYING` exists, is tracked, and its text matches a known license; the repository's file is recognized as MIT (asserted in the tests) |
| `remote` | automated (warn) | `origin` is a github.com remote. Public visibility is not checked |
| `usage-doc` | automated | `docs/KIRO_USAGE.md` has its markers; warns if local receipts are unrendered |
| `demo-link`, `site-link`, `repo-link` | automated when a URL is passed, human otherwise | URL form (https; YouTube video ID; github.com owner/repo) and presence in `README.md`. No URL is fetched |
| `readme-youtube` | automated (info) | count of YouTube links in `README.md` |
| `human-*` | human | repository public, site plays a duel, video public and under three minutes, write-up claims linked |

Exit code 1 means at least one automated item failed; human items never
change the exit code. The structure follows the requested launch-check
model (each item labelled automated or human); the code is written for this
repository and copies nothing.

## Reproduction (pending, coordinator)

1. Fast checks: `node --test scripts/contest-usage.test.mjs` and
   `node scripts/contest-submission-check.mjs`. Expected on this checkout:
   `license` passes as MIT; `kiro-untracked` warns until the new hook files
   are committed.
2. Native hook: start one fresh Kiro session in this checkout, ask for one
   file read, let the turn end. Confirm that
   `.artifacts/kiro-contest-usage/receipts.jsonl` gained a `recorded-stop`
   line with that session's ID (and `recorded-tool` lines if the
   `PostToolUse` observer loaded). Record whether each trigger fired.
3. `node scripts/contest-usage-render.mjs`, then rerun it and confirm it
   appends 0 rows.
4. Optional: capture a screenshot as described in
   [`docs/KIRO_USAGE.md`](../KIRO_USAGE.md#capturing-a-screenshot-of-a-real-session).

Open points for the native run: whether the installed Kiro accepts `Stop`
and `PostToolUse` as trigger names in a standalone `.kiro/hooks/` file
without a matcher, and which fields its events carry (the receipt lists
field names, so the first real row answers this).

## Results

None yet. Record the command, client and version from the launcher, session
ID, exit status and receipt ID for each run here.
