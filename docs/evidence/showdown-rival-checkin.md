# Showdown Overnight Rival: native scheduled check-in (K-078)

Date: 2026-11-20, America/Los_Angeles. Run by Kiro CLI (this worker) on Alex's
Mac against the local Kiro Crew gateway (gateway 0.12.2, CLI 0.13.0 selected).
Follows [rival-crew-receipt.json](../../experiments/showdown-dragon-strategy/rival-crew-receipt.json),
where the Daily Goal Reminder (cron 4c018491) never ran and returned
`HTTP 409: job is already running`.

## Labels

- Native: Kiro Crew one-shot cron `ec7901f4`, fired by the gateway scheduler
  (`trigger: scheduled`), running the Bot's agent `overnight-rival`.
- Scripted: none. Ground truth comes from the existing
  [rival-cases.json](../../experiments/showdown-dragon-strategy/rival-cases.json); nothing was re-run.
- Human: none. Alex typed nothing. Kiro CLI created the job on Alex's behalf.

## Prior automatic return

None found. Before scheduling (08:55 PST), the Bot's `last_active_ts` was
23:52:23 PST on 2026-11-19 (the owner-sent fallback turn). Heartbeat was off
and `kirocrew cron list` held only Night Watch `62736a74`.

## Steps

| Time (PST) | Action | Observed |
|---|---|---|
| 08:56:59 | `kirocrew cron add "K-078 Overnight Rival one-time goal check-in" ... --at "in 4 minutes" --timezone America/Los_Angeles --agent overnight-rival --timeout-secs 600 --auto-pause-after 1 --managed-by kiro-cli:rival-clock/k078-once` | `Added job: ec7901f4 [at 2026-11-20 09:01 PST]` |
| 08:57 | `kirocrew cron adopt ec7901f4 --session-of member-overnight-rival.memory-member-overnight-rival-e7d4b1a28ae54aa88f7eee010c0386be` | Job owned by the Bot's standing slot. Results go there |
| 09:01:02 to 09:01:24 | Scheduler fired the job | `GET /api/crons/ec7901f4/history`: run `c5ed075046d2`, `trigger: scheduled`, `status: success`, 22 207 ms |
| 09:01:39 to 09:01:53 | Delivery into the Bot slot | Gateway log: a turn on the slot ended with directive `nothing_to_do`, plus a warning `Turn-end contract violation ... 1 model event(s) after the terminal directive`. That delivered turn's text was not read |
| 09:03:54 | `kirocrew cron list` | `ec7901f4` is gone (one-shot deleted itself). Only Night Watch remains |

The job message told the Bot not to read chat history and not to write memory,
goals or schedules. It allowed only `memory_recall` for `rival-claim-s3-c5`.

## Result (run trace, paraphrased)

The trace reports one `memory_recall` call, which returned part 3/3. Parts 1/3
and 2/3 came from lessons injected at wake.

| Item | Bot said | rival-cases.json | Match |
|---|---|---|---|
| Seed-3 claim | Ranger 2/4 hits resting Dragon 3/4, Bear Trap set, Cowboys win T15. Hitting Jack loses T10 | A `c15`, B `w10`, `cowboyTrapsSet: [Bear Trap]` | yes |
| Seed-70 reversal | No trap. Hit Dragon: Wizard wins T14. Hit Jack: Cowboys win T17 | A `w14`, B `c17` | yes |
| Public board difference | No Cowboy trap. Wagon instead of Dynamiter. Wizard Base 4, not 3 | `visibleDifferencesFromSeed3`: trap, Dynamiter vs Covered Wagon, wizardBase 3 vs 4 | yes, all 3 |
| Evidence split | Trap: 5/5. No trap: 5/11. "Bot play only, not a human playtest" | `trapSet` 5/5, `noTrap` 5/11 | yes |

Last night's fallback answer left out the Wagon/Dynamiter difference. This
scheduled answer includes all three differences.

## Memory side effects

Read-only sqlite query on the Bot's `memory.db`: 3 live `semantic_memory`
rows contain `rival-claim-s3-c5`. The newest `memory_events` entry is still
2026-11-20T07:37:18Z (23:37:18 PST on 11-19). The check-in wrote nothing.

## Verdict

K-078 is proven natively for a one-shot cron: the gateway scheduler started an
`overnight-rival` turn on its own at the set time. The Bot recalled the claim,
the reversal and the full public board difference from its own memory and
lessons. Nothing was written to memory.

Still unproven: the Goals-page Daily Goal Reminder (cron 4c018491's 409) was
not retried. This run used the generic `cron add --at` path. Root cause of the
409 is still unknown, and the CLI/gateway version skew remains.
