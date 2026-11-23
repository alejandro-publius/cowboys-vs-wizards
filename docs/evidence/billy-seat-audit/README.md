# Billy seat audit

## What Kiro controls

- The thresholds are written and protected in two named rules in the [balance contract](../../../.kiro/specs/night-shift-balance-contract/requirements.md). NSB-1 keeps each faction at 45–55%. NSB-2 lets the opening player's distance from 50% grow by at most 1 percentage point over the baseline.
- A fenced agent edits one number in a scratch copy. It receives a failed attempt's ID and observations only in a later brief. A different reviewer step derives each decision ([workflow](../../../.kiro/workflows/night-shift-review.workflow.json)).
- The project's existing prospective contract check judges proposals. Billy attack 2 → 1 is a proposal and was never applied.

## Reproduce

```sh
node scripts/billy-balance-gate.mjs --arm baseline   # exit 2, RED: 59.792% Cowboys
node scripts/billy-balance-gate.mjs --arm candidate  # exit 0, PASS: 51.920% Cowboys
node scripts/billy-seat-audit.mjs --verify           # reruns all outcomes
```

The [gate](../../../scripts/billy-balance-gate.mjs) re-derives [result.json](result.json) from `outcomes.csv.gz` before it reads the contract.

## Result

| Billy attack | Cowboy share, all seats | Cowboy share, Cowboys open | Cowboy share, Wizards open | First-to-act share |
| --- | ---: | ---: | ---: | ---: |
| 2 (baseline) | 59.792% | 69.204% | 50.380% | 59.412% |
| 1 (candidate) | 51.920% | 60.056% | 43.784% | 58.136% |

First-to-act share is a separate measure: games won by whichever faction acted first. NSB-2 is a relative skew limit, so the candidate passes while an opening advantage remains.

## Scope

25,000 held-out shared seeds × 2 starting factions × 2 Billy versions = 100,000 **Node engine** duels, level-2 bots on both sides. The engine, decks and bots are fixed at historical source `eedab9385931e093e156fdb7885c470eb2ec64eb`. The result makes no claim about players in general.

## Integrity

The immutable [protocol](protocol.json) was published before measuring at commit `468f04181639c855f96c9565cff3e5690b0702f3`, rooted on the exact frozen source above. [result.json](result.json) records two digests:

- `protocolSha256`: the protocol's normalized SHA-256, `195057485d248f0c0fa7a113f263e19d8d34fc446f8712042c01f536f6b369b3`.
- `csvSha256`: the SHA-256 of the raw, uncompressed outcomes CSV, `947167821e4480482145a9d30fc6237a4dbe92c795e0a936572a56786b8b706f`.

`outcomes.csv.gz` does not contain the protocol digest. The quick gate recomputes both digests before it reads the contract.

## Negative controls

A real control ran on a disposable copy where only the written NSB-1 range changed, from 45–55 to 49–51. The identical measured 51.920% turned RED. No repo policy was edited.

In an isolated checkout with the same session-level write grant, the native PreToolUse hook intercepted an `fs_write` to a protected path before the file was created.

The reviewer profile's Stop hook only reports unmet rules. Successful completion is controlled by the workflow's explicit fresh-stamp guard.

## Audit workflow

The registered four-step audit workflow `wf_27f8bf0bb063c889` reached `completed`, and all four of its prescribed commands exited 0.

## Native free-choice workflow: six proposals, six rejections

The Billy audit above is independent of this run. It measures the fixed Billy proposal from the original run, not any of the six edits below.

The ordinary native Kiro CLI workflow `wf_3e26f2fcd93c25a1` was given no card choices. Kiro picked the card and the number in each attempt, and the separate reviewer step rejected all six. The [workflow](../../../.kiro/workflows/night-shift-review.workflow.json) allows at most six attempts, so the loop ended there. Each edit was made in a scratch snapshot, and no live card changed.

Baselines on 200 deals per set: tuning seeds 0–199 had 60.75% Cowboy wins and a 58.75% first-player share; holdout seeds 100000–100199 had 59.00% and 60.50%.

| Attempt | Kiro's edit | Cowboy wins, tuning | Cowboy wins, holdout | First-player share, tuning | First-player share, holdout | Rejected by |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Sheriff health 3 → 4 | 66.00% | 61.75% | 58.00% | 59.25% | NSB-1, both sets |
| 2 | Sheriff health 3 → 2 | 56.50% | 52.00% | 56.50% | 57.50% | NSB-1, tuning |
| 3 | Skeleton health 3 → 4 | 57.00% | 53.25% | 59.50% | 58.75% | NSB-1, tuning |
| **4** | **Skeleton attack 1 → 2** | **48.50%** | **46.00%** | **60.00%** | **59.00%** | **NSB-2, tuning** |
| 5 | Bone Wall (`wizard-bone-wall`) health 4 → 5 | 54.00% | 56.00% | 57.00% | 60.00% | NSB-1, holdout |
| 6 | Jack-o'-Lantern (`wizard-jack-o-lantern`) health 1 → 2 | 56.50% | 56.25% | 60.00% | 59.75% | NSB-1, both sets; NSB-2, tuning |

Attempt 4 is the only edit that met NSB-1 on both sets, at 48.50% and 46.00% Cowboy wins. On tuning seeds the first player's share rose from 58.75% to 60.00%, so the distance from 50% grew by 1.25 points against the 1 point NSB-2 allows. The reviewer recorded `tune: first-seat skew grew 8.75 -> 10.00 pp (tolerance 1)`. The brief for attempt 5 included that row. Likewise, the brief for attempt 2 received attempt 1's edit, the failed rule ID NSB-1, and its tuning and holdout measurements.

- [Every proposal and terminal verdict](kiro-run.json)
- [Receipts and recorded games](native-proposals.tar.gz)

To replay the receipts from a clean checkout:

```sh
mkdir -p .artifacts/contest-balance
tar -xzf docs/evidence/billy-seat-audit/native-proposals.tar.gz -C .artifacts/contest-balance
node scripts/contest-balance.mjs verify              # latest decision, attempt 6
node scripts/contest-balance.mjs verify --attempt 4  # the NSB-2 rejection
```

## Provenance

Three separate events produced the Kiro balance evidence. None of them is the six-attempt run above.

1. **Original three-proposal run.** Kiro CLI proposed Sheriff health 3 → 2, Skeleton health 3 → 4 and Billy attack 2 → 1 in an isolated worktree at `eedab9385931e093e156fdb7885c470eb2ec64eb`. The reviewer passed Billy only. The audit on this page measures that fixed Billy proposal ([recorded run](../kiro-contest-run.md)).
2. **Scripted two-edit repeat demonstration.** An older workflow fed two known, preselected edits through the repeat loop. It shows only the retry mechanics, not Kiro's choices.
3. **Independent 10k replay verifier.** The native Kiro 3.5.0 V3 CLI (Opus 5.5) invoked the recording shell and verified the historical 10k replay. This verified recorded games and proposed no edits.
