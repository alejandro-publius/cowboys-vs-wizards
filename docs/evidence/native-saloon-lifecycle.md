# Native Saloon lifecycle audit

Kiro agent session `native-saloon-lifecycle`, November 22, 2026, 20:32–20:34 PST
(America/Los_Angeles). This note was written by Kiro in a detached checkout. The
session was launched by the user's client. Kiro did not launch it, and no hook
was invoked with hand-written input.

Route audited: Kiro hook trigger → `.kiro/hooks/night-shift-activity.json` →
`node scripts/saloon-activity.mjs <Trigger>` → `recordActivity` in
`scripts/saloon-journal.mjs` → `.artifacts/night-shift-saloon/activity/a-<hash>.json`
→ `GET /night-shift/events` (`scripts/night-shift-saloon.mjs`) → Saloon live mode
(`src/ui/showdown-3d/night-shift-saloon.js`, labels from `src/ui/night-shift-presence.js`).

## What this session did

1. Listed the activity board before any write: 24 records. The earliest was this
   session's `SessionStart`, so the board held this session only.
2. Created `.artifacts/saloon-native/example.txt` with the Kiro write tool
   (`fs_write`). Then edited it with the Kiro replace tool (`str_replace`). The final
   content is the single line `edited placeholder text for the saloon lifecycle audit`.
3. Ran `node --test tests/match/night-shift-presence.test.js tests/match/night-shift-hooks.test.js tests/match/night-shift-server.test.js`
   once: exit 0, 47 tests, 47 pass, 0 fail, 6.39 s.
4. Listed the board again: 39 records. Read every record (each one holds only `id`,
   `at`, `kind`, `actor`, `phase`).
5. Ran `git status --short`: exit 0. The `.artifacts/` output is ignored by Git.
   The only untracked paths were the existing agent file and `node_modules` (both
   present before this session) plus this note.

## Evidence table (native hook records, this session)

Times are the hook's write time in UTC, so 04:33 UTC is 20:33 PST. "Session
action" is the Kiro tool call matched by order and count. The journal stores no
tool name or path, so each match is an inference from ordering, not a stored fact.

| Record id | at (UTC) | phase | actor | Session action |
|---|---|---|---|---|
| a-9afd57719a2a6383298e93d7 | 04:32:55.187 | SessionStart | singularity | session opened |
| a-8900d26c68df48d760d85635 | 04:32:55.329 | UserPromptSubmit | singularity | task prompt |
| a-a4e9428abef00f217e6d72fb, a-0986d8dfdfaaf4b4f714eeb8 | 04:33:00.548, 00.556 | PreToolUse ×2 | singularity | 2 parallel reads |
| a-b94a40f6a41fe8db4d6fb1fa, a-bff0637c427712de6eb264c0 | 04:33:01.078, 01.131 | PostToolUse ×2 | singularity | same 2 reads |
| a-a2c40a86cbb218958053c2fa, a-787b5c45ce8013f124154a47, a-2327202a5965a5b366633f1f | 04:33:04.099–05.341 | PreToolUse ×3 | singularity | 3 parallel reads |
| a-a50a9cfc2efc9d3d47752a3e, a-1b15a190df96cf2dfcfabbee, a-e262c961bd1ce0f95a8c6720 | 04:33:04.614–05.829 | PostToolUse ×3 | singularity | same 3 reads |
| a-40f43f33a46d089420152bc4, a-a6fdd4922f58504f703ac691, a-d38abdc56a6ef41c716882ba | 04:33:10.113–10.332 | PreToolUse ×3 | singularity | 2 reads + 1 shell call outside the allowlist |
| a-67cf3ecc56817aaec0155b27 | 04:33:10.952 | PermissionRequest | sheriff | that shell call; the request failed and the command did not run |
| a-c674687ef90831b4fdda75bd, a-0bfe332b9db50cebe69d0fcb, a-a9a37e3ebcdd53eb547a954f | 04:33:11.011–11.879 | PostToolUse ×3 | singularity | same 3 calls |
| a-ea483f2392088247758847e9 / a-93f39dcb1fe0c801a02bb662 | 04:33:16.162 / 16.795 | PreToolUse / PostToolUse | singularity | list `.artifacts` |
| a-354d377ceb24c4ddc5364c36 / a-85eb17735e7a902e41ef61ca | 04:33:18.733 / 18.969 | PreToolUse / PostToolUse | singularity | list journal root |
| a-4ef33bef5801f44f051bd3dc / a-56b6486b610f4494c2166d4b | 04:33:20.868 / 21.108 | PreToolUse / PostToolUse | singularity | baseline listing (24; its own Post came after) |
| a-bc1bd5801c9a568c442e26ce / a-ca8660afa4bef9129c77bea1 | 04:33:25.121 / 26.302 | PreToolUse / PostToolUse | singularity | read journal module |
| a-d31199c21ae1367b04d5204e | 04:33:33.637 | PreToolUse | singularity | **create** example.txt (`fs_write`) |
| a-daf1922ec976489cf5215503 | 04:33:33.829 | PostFileCreate | singularity | **create** example.txt |
| a-92fc25b70be1476e3a75ea91 | 04:33:33.947 | PostFileSave | singularity | **create** example.txt |
| a-4ad18e40771dc30687fb3608 | 04:33:34.341 | PostToolUse | singularity | **create** example.txt |
| a-f8ba2a406f3698e37c53ebc7 | 04:33:36.648 | PreToolUse | singularity | **edit** example.txt (`str_replace`) |
| a-78fb44660d94e79c6e990484 | 04:33:36.813 | PostFileSave | singularity | **edit** example.txt |
| a-eb5d05f20445110234430253 | 04:33:37.143 | PostToolUse | singularity | **edit** example.txt |
| a-b02b385c5c7f32bc003ab9d8 / a-dc077d3ee31d9025bc73b0db | 04:33:39.473 / 46.154 | PreToolUse / PostToolUse | singularity | allowlisted test run (6.68 s gap; test run reported 6.39 s) |
| a-11aa8a3e5575d0b85deb9200 / a-e9f2bf355ed1b536fb5950f7 | 04:33:48.673 / 48.856 | PreToolUse / PostToolUse | singularity | list journal root |
| a-ca86c10af69c01cdb3d2d10e | 04:33:50.793 | PreToolUse | singularity | post-run listing (39); its Post came after |

Later reads in this session added more PreToolUse/PostToolUse records. They are
not listed here.

Observed facts:
- Every fs_write and str_replace call produced a full native record sequence. The
  create produced PreToolUse → PostFileCreate → PostFileSave → PostToolUse within
  0.70 s. The edit produced PreToolUse → PostFileSave → PostToolUse within 0.50 s.
  The create fires both file triggers. The edit fires only PostFileSave.
- The test run wrote nothing to the real journal. No record falls between its
  PreToolUse and PostToolUse. The tests use their own temporary roots.
- No `events/` (headline) board was created. This is expected: the only headline
  hook in `.kiro/hooks/night-shift-saloon.json` matches `task_update`, and this
  session made no `task_update` call.

## Missing events

These phases are bound in `night-shift-activity.json` but have no record from this session:

- **Stop** and **SessionEnd**: they fire after the agent's turn ends, which is after
  this note was written. They are unobserved here, not shown to be broken.
- **PostFileDelete**: no delete happened. The task permits no delete.
- **PreTaskExecution / PostTaskExecution**: no spec task ran.
- **PreCompact / PostCompact**: no context compaction happened.
- Headline board: no **wanted** (`task_update`) event, because no `task_update` ran.

## Native presence vs decoded/synthetic coverage

- **Native presence** (this note): the record exists because the Kiro runtime fired the
  configured hook during a real session. It shows which phases this Kiro build delivers
  and in what order. It cannot show the raw payload, because the journal discards it by
  design. So this note cannot show whether the runtime sent an invocation id. The
  record id is a hash either way.
- **Decoded/synthetic coverage** (the allowlisted tests): the tests send constructed
  payloads to the same `saloon-activity.mjs` command and journal functions in
  temporary roots. They prove decoding, sanitising, dedupe, retention and the server
  contract for all 14 phases and legacy names. They do not prove that Kiro fires any
  of these phases. The test named "real command writes a native hook event" runs the
  real command on synthetic stdin. It is not a native runtime event.
- The checked-in recording (`src/ui/night-shift-recording.json`) is an earlier capture.
  This audit did not change it and did not re-verify it.

## What viewers can see

The Saloon receives `{actor, phase}`, its id and its time only. Each record becomes
one ambient line: "<Actor> sees <phrase>". For example, this session's file create
would show "Singularity sees a new page appear", and the denied shell call would show
"Sheriff sees someone ask leave to act". Viewers never see file names, commands,
prompt text, tool names, session ids or content. They cannot tell this session's
example.txt from any other file. Public builds show only the recording. Live records
appear only with `?saloon=live` on a loopback `http:` page served by
`scripts/night-shift-saloon.mjs`. This session did not open a browser or the live UI.

## Two-second target

Existing evidence cannot verify it. No measurement covers the time from hook to
Saloon screen. What exists:
- Hook → journal: the `at` field is the hook's write time. It is not the moment of
  the tool action, so the delay before it is unmeasured. Records arrive within 0.2–0.7 s
  of the matching PreToolUse, which bounds the hook gaps only.
- Journal → screen: the live poll interval is `POLL_MS = 3000` in
  `src/ui/showdown-3d/night-shift-saloon.js`. From that constant, a record written
  just after a poll waits up to about 3 s before the next fetch. As configured, the
  live mode cannot guarantee 2 s for every event. This is inferred from source and
  was not measured.
- `docs/evidence/kiro-closeout-performance.*` holds a two-second animation-frame
  sample of the game page. It is unrelated to this route.

## Limitations

- One session, one machine, one Kiro build. Matching records to tool calls relies on
  order and count, because records carry no tool name, path or session id.
- The journal is shared by every session in this checkout. In a reused checkout,
  separate this session's records by time window.
- Activity retention keeps the newest 192 records once there are more than 256.
  Long sessions lose their early records.
- Stop and SessionEnd records were not seen. Check them after the session ends.
- No build, server, browser or live-UI check ran here. The Saloon view described
  above comes from source, not rendered review.
- `docs/kiro-build-log.md` is coordinator-owned and was not updated.

## Shortest clean replay

In a fresh checkout (so the board starts empty), run the same agent:

```
kiro-cli chat --agent native-saloon-lifecycle
```

Give it the task in this agent's prompt. Afterwards, list
`.artifacts/night-shift-saloon/activity/` and sort the records by `at`. Kiro did not
run this command in this session; the user's client launched the session.
