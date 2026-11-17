# Night Watch installation repair and Crew readiness

Date: 2026-11-16 (America/Los_Angeles). Base: game release `b5cecc6`.
Scope: the optional Crew app and its verification; no gameplay, art, animation,
global permissions, or production schedule changes.

## Completed and verified

| Check | Observed result |
| --- | --- |
| Gateway | Normal Crew gateway running, version 0.12.2 |
| Installed app | Supported `kirocrew app update` upgraded Night Watch 0.1.1 → 0.1.2, exit 0 |
| Update source | Current release's `apps/night-watch` at `b5cecc6` |
| Installed files | SHA-256 comparisons matched app.json, balance.py, server.py, test_night_watch.py, and ui/index.mjs to that release |
| Saved data | Existing config/history file hashes were unchanged by the update |
| Activation | Still disabled; trust and permissions were not changed |
| Backend checks | All 6 Python tests passed, including current profile imports and legacy snapshots |
| UI syntax | `node --check apps/night-watch/ui/index.mjs` passed |
| Crew engine route | `kirocrew kas route` returned `kiro-cli` |
| Basic Crew response | Supported `kirocrew chat -m` no-tool connectivity request returned `CREW_READY` in 9.2 seconds, exit 0 |
| Schedule compatibility | `kirocrew cron add --help` confirms the app's command, timeout, managed-by, timezone, minimal-context, and session flags exist |
| Production schedule | No Night Watch schedule created; gateway reported 0 cron jobs |

The installed app now contains the already-released 0.1.2 profile-extraction fix.
This repair did not create a new backend fix or claim a new gameplay feature.

## Actual Kiro contribution

Kiro CLI V3 performed a bounded review with file read/write tools. Its process
finished in 75 seconds with exit 0, without timing out. It inspected the Night
Watch manifest, backend/UI, selected installed Crew source, and the operator
trust boundary, then authored the initial diagnosis. It found no demonstrated
new app defect and made no application source changes.

The coordinator checked its findings, corrected the trust UI location below,
performed the supported installation update, ran the checks above, and edited
this receipt. An untrusted shell-tool request was refused during the worker's
run; no broader tool grant was added. Raw worker output and operational receipts
remain outside the tracked repository in the local repair artifact directory.

## Timeout diagnosis: narrowed, not resolved

The earlier 326-second Crew taskrunner attempt produced ACP pre-turn-drain
warnings but no browser output or useful result. Those warnings do not establish
the root cause. This run did not reproduce that long browser task.

The successful 9.2-second direct Crew chat proves the selected CLI relay can
answer a simple request in this environment. It does not prove that the taskrunner,
browser tools, or complete review workflow works. The configured auto model,
KAS route, sandbox, approval policy, and global backend were unchanged.

A suggested manual/scheduled storage mismatch also remains unproven. Inspection
of Crew 0.12.2 shows app backend launch explicitly passes the resolved
`KIROCREW_HOME` (`apps/backend.py`), while cron children inherit the gateway's
environment with secret keys removed (`cron_script_child_env.py`). No observed
mismatch justified changing Night Watch's storage code.

## Exact remaining operator step

In Crew's **App Store**, open Night Watch's enable prompt and choose
**Trust this app alone**, then enable Night Watch. The Security page lists/revokes
grants; it is not the install/enable flow.

This is an operator trust decision, not an installation defect. Crew's installed
`dashboard/handlers/security_trusted_apps.py` documents that agents cannot make
these grants. `apps/execution.py` directs third-party apps to the App Store's
per-app prompt. Trust allows the app's Python to execute in the gateway's trust
domain; it is not a restricted filesystem capability. No agent grant, operator
token, configuration edit, or global third-party toggle was used.

After that human action:

1. Open Night Watch and run one report through its actual page. Confirm the
   result and persisted history are visible after reopening.
2. Verify a scheduled/manual invocation writes to that same history. Only after
   the manual UI check passes should the intended daily schedule be created.
3. If Crew browser review is still wanted, run a small bounded browser-specific
   check before retrying the full taskrunner job.

Live dashboard rendering, app API execution after enable, manual UI reporting,
and a production scheduled run remain unverified. No 10/10 or fully complete
claim is supported yet.
