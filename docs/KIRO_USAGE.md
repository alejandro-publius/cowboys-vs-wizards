# Kiro usage log (observed sessions only)

This page lists facts that a native Kiro hook observed in real sessions in this
repository. A row exists only when the hook actually ran and wrote a receipt.
Nothing here is inferred from configuration: a hook file, agent profile or
steering file in `.kiro/` is not evidence that Kiro used it.

## How rows get here

1. `.kiro/hooks/contest-usage.json` registers a `Stop` command hook:
   `node scripts/contest-usage.mjs`. Kiro runs it when a turn ends and pipes
   the event JSON to stdin.
2. `.kiro/hooks/contest-usage-tools.json` registers an optional
   `PostToolUse` observer with the same command. It records only the
   category of each tool call (read, write, shell, web, aws, delegate, mcp,
   other). The next `Stop` receipt folds those categories into its row.
3. The hook appends one sanitized JSON line per event to
   `.artifacts/kiro-contest-usage/receipts.jsonl`. That folder is ignored by
   Git. The hook never writes to this page, because a tracked document that
   changes in the middle of a session is unsafe for concurrent sessions and
   other save hooks.
4. The coordinator runs `node scripts/contest-usage-render.mjs` to append
   new `Stop` receipts below as rows. Each row has a receipt ID. A rerun adds
   only IDs that are missing, and the renderer never rewrites or removes
   existing rows. `node scripts/contest-usage-render.mjs --check` exits 1
   when unrendered receipts exist and changes nothing.

### What a receipt contains

- Session ID from the event, only if it matches `[A-Za-z0-9_-]{1,128}`.
- Hook event name, UTC time, the turn number within the session (count of
  recorded `Stop` events), tool-category counts since the previous `Stop`.
- Observed flags: names of the top-level event fields that were present
  (names only, never values), whether `cwd` in the event is this checkout,
  and whether `KIRO_SESSION_ID` was set and matched the event.
- Hook actions: what the hook itself did (`recorded-stop`, `recorded-tool`,
  `skipped-malformed`, `skipped-irrelevant`). A second `Stop` for the same
  session within 5 seconds with no tool events in between is treated as a
  repeat of the same turn: the hook prints `skipped-duplicate` and writes
  nothing.

### What a receipt never contains

Prompts, responses, tool inputs or outputs, tool names (only their fixed
category), file paths, environment values, tokens, credentials or email
addresses. The client (IDE, CLI, Web, Crew) and model are not recorded,
because the event does not state them. Name the client in a row's note only
from a launcher receipt or a screenshot of that session.

## Capturing a screenshot of a real session

A screenshot supports the claim that a row came from a specific session and
client. Take it during the session, not afterwards from logs.

1. Start the session in the client you want to document (for example
   `kiro-cli chat --v3` in this checkout, or Kiro IDE with this workspace
   open). Use a prompt that contains no private data.
2. Let one turn finish so the `Stop` hook fires. Read the session ID from
   the client (for Kiro CLI, the stream or session listing; for the IDE, the
   session details) and find the same ID in
   `.artifacts/kiro-contest-usage/receipts.jsonl`.
3. On macOS press Cmd+Shift+5, choose *Capture Selected Window*, and click
   the Kiro window. Include the client name, the visible session ID or turn
   and the finished turn. Crop out other windows, notifications, account
   names, email addresses and any token or key.
4. Save the image under `docs/evidence/` with the date and session prefix in
   the name, then render the receipts and link the image from the note
   column of the matching row. Record the client version from
   `kiro-cli --version` or the IDE's About panel at the same time.

A screenshot shows appearance and what the client displayed. It does not
prove totals, model routing or account usage.

## Observed sessions

No row is written by hand. Until the renderer appends a receipt, this table
is empty and no session has been recorded by this hook.

<!-- contest-usage:begin -->
| Receipt | Session | Stop (UTC) | Turn | Tool categories since last stop | Event fields present | Checkout / env match | Hook actions | Note |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| `54ae079e0189cf24` | `sess_a87f7bbc-b6ed-4368-877e-a80802e87c81` | 2026-11-22T22:08:05Z | 1 | read 1 | cwd, hook_event_name, session_id | cwd yes; env match | recorded-stop |  |
| `359f03da4b632e9c` | `sess_e67fa73c-6487-457f-a52a-718cb028c44e` | 2026-11-22T22:09:18Z | 1 | write 5 | cwd, hook_event_name, session_id | cwd yes; env match | recorded-stop |  |
<!-- contest-usage:end -->

## Submission check

`node scripts/contest-submission-check.mjs` runs offline with Node and Git
only (no npm install). See
[the contest usage evidence note](evidence/kiro-contest-usage.md) for what
it checks automatically and what stays a human check.
