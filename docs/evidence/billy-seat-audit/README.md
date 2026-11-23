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

The immutable [protocol](protocol.json) was published before measuring at commit `468f04181639c855f96c9565cff3e5690b0702f3`. Verify its normalized SHA-256 `195057485d248f0c0fa7a113f263e19d8d34fc446f8712042c01f536f6b369b3` in result.json and `outcomes.csv.gz`, rooted on the exact frozen source above.

## Negative control

A real control ran on a disposable copy where only the written NSB-1 range changed, from 45–55 to 49–51. The identical measured 51.920% turned RED. No repo policy was edited. The reviewer profile's Stop-action diagnostic differs from the success guard.

## Provenance

The native Kiro 3.5.0 V3 CLI (Opus 5.5) invoked the recording shell and verified the old 10k replay. That old workflow's deterministic two-attempt demonstration preselected the inputs ([earlier run](../kiro-contest-run.md)). This note records no status or result for the new free-choice workflow. A separate native trace may be appended later.
