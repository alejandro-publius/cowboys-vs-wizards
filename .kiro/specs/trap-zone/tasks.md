# Trap zone: tasks

Author: Kiro CLI 3.4.0 V3. All items are PENDING; nothing here has been implemented or run.
Update (issue #85): prototype is A + X. T1, T2, T3 and T5 below carry the A variant wording; named tests are in
`docs/submission/trap-prototype-contract.md` section 9 and are PENDING, not run.
Each task is one focused commit. Run the closest test first (`node --test tests/game/<file>`),
then `node scripts/verify-duel.mjs` once at the end. No renderer build until T6.

- [ ] T0 Owner gate (O1, O2): user approves trap card prototype, art source, copy count and deck migration. No later task creates card content without it.
- [ ] T1 Flag and state (R1, R7, R8): add `traps` option to `createMatch`, `sides[*].trap`, `allowances[*].tactical` (A; `trapSet` only for B), `trap` card kind, `RULES_VERSION` suffix. Test: flag-off `createMatch(0)` and `createMatch(60)` deep-equal the 8ace1ce state; flag-on adds only `trap: null` and `allowances.tactical: null` (no `trapSet`).
- [ ] T2 `set-trap` action and `legal.js` (R2, R6, R13): shared checks, then `traps-disabled`, `card-not-in-hand`,
      `not-a-trap` (spell and troop), `trap-too-late`, `trap-zone-full`, `trap-after-spell`; plus `summon-after-trap` and `cast-after-trap` on the existing actions.
      Test: each rejection returns the same input state object in that order; apply once; `castUsed` and `tactical = "trap"` set, `summonUsed` unchanged; no `set-trap` in legal list in round 9; legal list matches `applyAction`.
- [ ] T3 Clash trigger (R3, R4, R9): in `clash.js`, snapshot-based trigger and `trap-trigger` event.
      Tests: not armed in the set round (one-turn); armed next round; highest attack and lane tie-break;
      no target keeps trap; cancelled attacker emits no `damage` and the troop stays on the board; `trap-trigger` precedes `damage`; simultaneous traps on both sides give order-independent result.
- [ ] T4 Public view and redaction (R5): `view.js` face-down opponent trap, redacted `trap-set` event.
      Test: serialise the opponent view and events; the set `cardId` is absent until `trap-trigger`.
- [ ] T5 CPU (R11, R13): deterministic set rule (summon, then trap if held and round < 9, else cast) in `src/game/cpu.js`, public view only.
      Tests: CPU never reads opponent trap card; seeded CPU-vs-CPU runs on seeds 0 and 60 end legally with flag on; `tests/game/cpu.test.js` unchanged with flag off.
- [ ] T6 Presenter and controller (R10): `EVENT_TYPES`, `DEFAULT_PAUSES`, `displayed` patch for `trap`.
      Tests in `tests/match/presenter.test.js`: displayed state deep-equals `to` after a batch with trap events;
      cancel mid-trigger via `reset()` and via `scheduler.advance()` leaves no callback acting; restart clears trap.
- [ ] T7 Properties (`tests/game/invariants.test.js`): card conservation per side (deck+hand+board+trap+discard constant),
      unique ownership, deterministic replay of an action list, orbs within 0-5 after traps. Keep any failing seed.
- [ ] T8 Fast-play option (R12), separate commit and flag: `pace` option feeding `pauses` and `cpuDelay`.
      Tests: damage and defeat event order and impact order identical under both paces; `clash` and `result` pauses unchanged.
- [ ] T9 Parity gate: `node scripts/play-match.mjs` or the existing seed-0 and seed-60 replay (`orb-duel-replay` workflow)
      with flag off, compared to a recorded 8ace1ce result; with flag on, record seeds, rules version, case count and results.
- [ ] T10 Evidence: one entry in `docs/kiro-build-log.md` and a file under `docs/evidence/` (coordinator-owned, not this job).

Blocked on owner: O1 to O3 in requirements.md (T0); trap card art, name and copy count, and any trap marker art needs a plan with the user first (AGENTS.md sourcing rule).
