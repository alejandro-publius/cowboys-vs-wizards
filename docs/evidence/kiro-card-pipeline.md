# Kiro card authoring and balance evidence

## Card registration

The card pipeline stores eight source specs under `.kiro/specs/duel-card-pipeline/cards/`. A direct comparison of the previous and generated registries matched all 24 card IDs, fields and copies. Both 12-card deck orders match. The combined playable candidate passed 107 Node tests and both Chrome replays. [Card requirements](../../.kiro/specs/duel-card-pipeline/requirements.md) · [Release preflight](kiro-submission-preflight.md)

In an isolated Kiro CLI 3.3.0 trial on `36ecede`, Kiro changed only the Skeleton spec’s `health` value from 3 to 4. The `PostFileSave` hook regenerated the catalog. The receipt recorded three passing registration tests and exit 0. All six runtime Skeleton cards then showed health 4. The trial and generated diff are recorded under `.artifacts/kiro/` in the `submission-card-hook-check` worktree. [Save hook](../../.kiro/hooks/sync-duel-card-specs.json) · [Registration tests](../../tests/game/card-specs.test.js)

The current wrapper records the exit code of each command it runs. On the baseline it recorded three successful commands. In a scratch copy with Skeleton health 9, validation returned 1 and stopped the check before the test suite. [Check wrapper](../../scripts/check-card-specs.sh)

Run `node scripts/sync-card-specs.mjs --check` to check for a stale catalog or `sh scripts/check-card-specs.sh` to regenerate and test it.

## Summoning Circle Workflow

The saved recipe takes `card` and `proposal` as inputs. It runs authoring, an independent requirements check, registration and a 100-match simulation as four separate steps. In the isolated `wizard-skeleton` trial, Kiro saved `health = 4` and a second agent confirmed that this differed from the baseline as proposed. Registration passed all three tests. The final step ran seeds 0–99 and observed 26 Cowboy wins, 65 Wizard wins and nine draws. The coordinator granted individual tool approvals and retried registration after the terminal session closed. [Workflow](../../.kiro/workflows/card-summoning-circle.workflow.json)

The `review existing` run completed all four steps with the three-orb baseline and left a clean Git checkout. Its seeds 0–99 produced 50 Cowboy wins, 35 Wizard wins and 15 draws. Both runs’ registration receipts are retained under `.artifacts/kiro/` in the trial worktree.

## CLI Spec mode and approval policy

A read-only run in CLI Spec mode reviewed the hook configuration and checked the wrapper against R4, including the receipt paths and exit propagation. The successful and invalid-card executions above verify those behaviors.

In a scratch workspace configured with the local command sandbox, Kiro showed the session as sandboxed. After switching that workspace to Approve for me, Kiro marked the exact seed-60 simulation command **Approved for you** and ran it to completion. The full Summoning Circle trials used individual approvals. [Kiro approval policy](https://kiro.dev/blog/introducing-approve-for-me/) · [Local command sandbox](https://kiro.dev/docs/sandbox/)

## Kiro Crew balance preview

Kiro Crew 0.12.2 ran the game’s existing simulator through `kirocrew cron preview`. The comparison held the CPU policies, seeds 0–999 and deck orders constant. The candidate changed the Skeleton’s health from 3 to 4 and regenerated the catalog before running.

| Result over 1,000 matches per variant | Three orbs | Four orbs |
| --- | ---: | ---: |
| Cowboy wins | 425 | 222 |
| Wizard wins | 472 | 663 |
| Draws | 103 | 115 |
| First-seat wins | 583 | 481 |
| Second-seat wins | 314 | 404 |

The Wizard win rate rose by 19.1 percentage points. The first-seat win-rate gap fell from 26.9 to 7.7 points. The candidate retains the three-orb Skeleton because the extra orb strongly shifts the simulated faction results toward the Wizard. These are CPU-vs-CPU results on the same 1,000 seeds per variant. The raw reports, preview script and combined receipt are in `.artifacts/kiro/crew-preview/` in the preflight worktree. [Simulator](../../scripts/simulate-matches.mjs)
