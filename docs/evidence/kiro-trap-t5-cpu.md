# Trap T5: trap-aware CPU (issue #95)

Date: 2026-11-17 (America/Los_Angeles). Base: `main` at 1f6f80c, after T1 #91,
T2 #93, T3 #96 and T4 #98. Branch `kiro/trap-cpu-95`. Work done by Kiro (Kiro
CLI 3.4.0 per the session user agent; model Claude Opus 5.5 as reported by the
session context). The session emitted no credit or usage figures, so none are
recorded here. Headless rules work only: no 3D, model, sound, art, animation,
UI, renderer, presenter, card, deck or CI change.

## Problem

`chooseAction(view)` called `legalActions` with the shipped `CARDS`, so it
could not see a trap card and never chose `set-trap`. Contract:
[trap-prototype-contract.md](../submission/trap-prototype-contract.md)
section 6; task T5 in [tasks.md](../../.kiro/specs/trap-zone/tasks.md).

## Change

[`src/game/cpu.js`](../../src/game/cpu.js), `chooseAction(view, { cards = CARDS } = {})`:

1. Best summon if it scores above ending the phase (unchanged).
2. New: if `view.traps.enabled`, `view.round < MAX_ROUNDS`, the viewer's own
   `trap` zone is `null` and a `set-trap` for a trap card in its own hand is
   in `legalActions(view, viewer, { cards })`, choose the first such action
   (hand order).
3. Otherwise the best spell over the existing gain floor, then end-phase
   (unchanged).

The rule reads only the viewer's own hand, zone and the round. It never reads
the opponent's `trap` marker. `cards` is passed to `legalActions` for kind
lookups only; board troops are still scored from `CARDS`. No RNG. Without
`traps.enabled` the trap step returns `null` and the old expression runs.

`chooseEasy` and `chooseHard` are unchanged and do not accept `cards`. With a
trap card in hand they would throw in `legalActions` (unknown ID). Shipped
decks hold no trap, so this cannot happen today. Making easy and hard
trap-aware is left open (see Remaining).

The rule applies to whichever side the CPU plays. The game's CPU is the
Wizard, and the tests exercise the Wizard.

## Verification (run in this session)

New [`tests/game/trap-cpu.test.js`](../../tests/game/trap-cpu.test.js), 10
tests. Fixture trap IDs exist only in that file and reach the engine through
the `cards` option of `applyAction`, `legalActions` and `chooseAction` on
cloned `createMatch(seed, { traps: true })` states.

| Property | Test |
| --- | --- |
| Beneficial summon, then `set-trap` (a killing spell was legal), then end-phase; `castUsed` and `tactical: "trap"`; cast rejected `cast-after-trap`; the same position without the trap casts | 1 |
| No beneficial summon: the set comes first and the summon is then closed | 2 |
| Zone full plus a second trap in hand: no `set-trap` listed, each choice equals the no-trap choice; zone cleared: the second trap is set | 3 |
| Round 9: no set, order `summon, spell, end-phase`; round 8: `summon, set-trap, end-phase` | 4 |
| Opponent trap empty or holding either of two fixture IDs, with hidden hand and deck orders changed: no ID in the view JSON, the same choice, and a Proxy that throws on any read of the opponent's `trap` is never triggered | 5 |
| Fixture CPU-vs-CPU on seeds 0-49 and 60 (Wizard: one fixture trap in hand, one at deck index 3): every action in the legal list and accepted, view unchanged, at most one of each type per phase, no set in round 9 or onto a full zone, no set and cast in one phase, no summon after a set, result within `MAX_STEPS`, identical replay | 6 |
| Easy, normal and hard (Wizard) against normal (Cowboy) on seeds 0-199: SHA-256 of `[actions, result]` equals the digest recorded on 1f6f80c before the change, both flag off and flag on with no trap dealt | 7-9 |
| Seeds 0 and 60, normal both sides: flag off, flag on, and flag on with the fixture catalog but no trap dealt give the same actions and result; no `set-trap` | 10 |

Fixture-run counts for test 6 (51 matches, rules version
`orb-duel-draft-1+traps`, CPU normal both sides, fixture Wizard traps only):
96 sets, 91 `trap-trigger` events; Wizard 32 wins, Cowboy 16, 3 draws;
45 base-destroyed, 6 round-limit. The Wizard never held a trap with a full
zone in this corpus, so the zone-full case is covered only by test 3. These
counts describe a fixture with no approved card and say nothing about balance.

Recorded digests (Cowboy normal vs Wizard level, seeds 0-199, flag off = flag
on with no trap, before and after the change):

- easy `1e8249bb9df6e5919d125eba0453c0394a0f0623fa686ce8c7f395c5286a0298`
- normal `e6867ef19b9c11edb39e2f6364035987b19ba666b71edc42e3d80b68e1a1508c`
- hard `d8f564e03ea6452023e7690cdf3fff6352fdc42e9c6e7d52b004090713a6c19d`

Commands and results:

- `node --test tests/game/trap-cpu.test.js`: 10 pass, 0 fail.
- Same file against the pre-change `cpu.js` (restored afterwards): 6 fail
  (tests 1-6), 4 pass (the parity tests 7-10).
- `node --test tests/game/cpu.test.js` (unchanged file): 12 pass, 0 fail,
  including the c65f49e seeds 0-199 normal digest.
- `node scripts/verify-duel.mjs`: 277 pass, 0 fail, exit 0; GLB structure
  preflight 2/2 pass.
- `node scripts/check-links.mjs`: 0 broken.

Not run: renderer build, browser replay, playtest. T5 changes no rendered code.

## Remaining

- Whether "set whenever possible" helps or weakens the CPU needs approved trap
  cards (T0) and a seeded rerun; the fixture counts above are not that rerun.
- Easy and hard do not accept `cards` and never set a trap. Open decision.
- `docs/kiro-build-log.md` entry is coordinator-owned (T10).
