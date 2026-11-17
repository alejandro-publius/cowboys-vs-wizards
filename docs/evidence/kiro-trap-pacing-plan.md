# Kiro trap zone and pacing plan (issue #60)

- Agent: Kiro CLI 3.4.0 V3. Date: 2026-11-14 (America/Los_Angeles).
- Base: main 8ace1ce, worktree `.worktrees/kiro-trap-pacing-60`. Rules version read: `orb-duel-draft-1`.
- Type: design only. No runtime code, art, dependency, deck or log was changed. No push or merge.
- Specs: [requirements](../../.kiro/specs/trap-zone/requirements.md), [design](../../.kiro/specs/trap-zone/design.md), [tasks](../../.kiro/specs/trap-zone/tasks.md).

## What was read

`AGENTS.md`, `src/game/state.js`, `actions.js`, `legal.js`, `view.js`, `clash.js`, `src/match/presenter.js`,
`scheduler.js`, and grep of `controller.js` for `cpuDelay`. Test files were listed by name only, not read.

## Decisions proposed

- One trap zone per side for a dedicated `trap` card kind with unique IDs (user-directed correction; converting a spell is a rejected shortcut). Set uses its own `trapSet` allowance, armed when
  `round > setRound` (interpretation A, next round). Compared with B (next own action phase): same first
  trigger under the current two-phase round, A needs less state, so A is recommended for pace and simplicity.
- One defensive auto-trigger at clash start cancels the strongest enemy attack, then the card is discarded.
- Opponent sees only a face-down marker and `setRound`; set events are redacted; trigger reveals the card.
- Flag `traps` default off, so seeds 0 and 60 stay byte-identical when off.

## Pacing constants found in source (not measured)

| Wait | Symbol and file | Value |
|---|---|---|
| CPU request before each Wizard action | `cpuDelay`, `src/match/controller.js:87,147` | 600 ms |
| Round turnover | `DEFAULT_PAUSES["round-start"]`, `VISIBLE_DRAW_PAUSE`, `draw`, `"phase-start"`, `src/match/presenter.js` | 500 + 450 + 250 + 350 ms |
| Clash lead-in | `"phase-end"` + `clash` in `DEFAULT_PAUSES` | 150 + 250 ms |

Renderer cue lengths (summon, attack, spell `end`) were not inspected. No browser timing was taken, so no
latency or speed-up claim is made; the fast-play savings in design.md are arithmetic on these constants.

## Checks

| Check | Status |
|---|---|
| Any test, build or replay | not run (spec-only job) |
| Seed 0 and seed 60 flag-off parity | pending, task T9 |
| Hidden-info, one-turn, simultaneous clash, invalid action, cancel tests | pending, tasks T2 to T6 |
| Human playtest of pace or trap clarity | pending |

## Blockers and open decisions

Owner items O1 to O3 in requirements.md: trap card prototype (name, copy count, art, copy), flag-gated deck migration, tie-break. No card content is specified or created here.
Trap marker visuals require a plan with the user before any asset work. Design inspiration only from
Yu-Gi-Oh (trap not usable the turn it is set) and Pokemon (few predictable per-turn actions); nothing imported.
