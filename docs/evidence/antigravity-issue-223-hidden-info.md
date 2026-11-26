# Evidence: Beginner Seat Privacy & `fast-check` Hidden-Information Invariance (Issue #223)

- **Date:** 2026-11-26 (America/Los_Angeles)
- **Base revision:** `93db9f3` (`main`)
- **Authoring agent:** Antigravity (branch `antigravity/wizard-hidden-info-223`; open for review, not merged to `main`)
- **Spec requirements:** [`.kiro/specs/beginner-seat-privacy/requirements.md`](../../.kiro/specs/beginner-seat-privacy/requirements.md) (`BSP-1`–`BSP-4`)

## 1. Root Cause & Opt-In Candidate Design (`BSP-1`, `BSP-2`)

In [`src/game/showdown/rules.js`](../../src/game/showdown/rules.js), `simpleStep(state, 0)` cleared only `blind.sides[opponent(side)].traps = []` and hashed `JSON.stringify(blind.sides)` to choose `moves[hash % moves.length]`. Because `blind.sides` retains `sides[opponent].hand`, `sides[opponent].deck`, and `sides[side].deck`, permuting unseen face-down cards changed `hash % moves.length` even when `viewFor(state, state.active)` was identical.

Per Issue #223 (*"Record the comparison before changing the released bot. The approved November 20 snapshot limits which bot and card changes ship"*), `playTurn(state, level, onAction, {seatPrivate: true})` adds a pure `seatPosition(state, side)` projection (matching `viewFor` in `contract.js` with zero circular imports) behind `{seatPrivate: true}` while keeping default `playTurn(state, 0)` frozen to the November 20 snapshot.

## 2. `fast-check` Real-Bug Discovery, Shrinking & Invariance Proof (`BSP-3`, `BSP-4`)

Verified in [`tests/game/beginner-hidden-info.property.test.js`](../../tests/game/beginner-hidden-info.property.test.js):

1. **Seed `6` (`first: "wizard"`) reproduction (`BSP-3`):** Swapping the top two unseen Cowboy draw-pile cards (`Outrider` and `Sheriff`) keeps `viewFor(state, "wizard")` identical. Without `{seatPrivate: true}`, `playTurn(..., 0)` summons `wizard-jack-o-lantern-1` vs. `wizard-skeleton-1`; with `{seatPrivate: true}`, both states summon the identical card and execute the identical pre-reveal turn sequence.
2. **Real bug caught & shrunk by `fast-check` (`BSP-4`):** Running `fc.check` (`seed: 20261126`) directly against unflagged `playTurn(state, 0)` catches the hidden-deck leak in `<10 ms` and shrinks in **`10` steps** to the minimal adjacent top-of-deck swap `{"seed": 41, "first": "cowboy", "i": 0, "j": 1}`. Passing `{seatPrivate: true}` resolves that shrunk counterexample.
3. **200-run `fast-check` invariance across all 4 bot levels (`BSP-1`, `BSP-3`):** Across `512` reachable game positions (`seeds 0..31`, both seats) and levels `0`, `1`, `1.5`, and `2`, permuting unseen `enemy.hand + enemy.deck`, swapping hidden `enemy.traps` identities, and permuting `own.deck` preserves `viewFor` and yields identical pre-reveal bot actions in `200/200` generated cases (`0` failures).

## 3. Recorded Trail, Practice & Gate Comparison Before Flipping the Default Bot (`BSP-2`, `BSP-4`)

Testing a direct flip of default `level: 0` surfaced **two concrete snapshot impacts** that explain why flipping the default must accompany a deliberate rules cut:

1. **Outrider Gate (`scripts/outrider-gate.mjs` / `tests/match/showdown-outrider-gate.test.js`):** All `10` frozen `Bone Fence` Outrider cases (`case-a`..`case-j`, where the Wizard runs at `level: 0`) turn `0 fresh, 10 stale` if default `level: 0` changes without regenerating the Outrider measurements and receipts. Keeping `{seatPrivate: true}` opt-in preserves `10/10 fresh` Outrider Gate verification.
2. **Naive first-legal clicker on Boot Hill (`tests/match/showdown-session.test.js`):** A test loop that blindly plays `legal.find(attack) ?? firstNonEnd` wins `26/40` (`65%`) of `seeds 0..39` under `seatPosition` vs. `>=36/40` under `blind.sides`, whereas `trail-sim.mjs`'s `simple` (`level: 1`) player still wins `100.0%` (`1,000/1,000`) of Boot Hill deals:

| Trail Duel (Wizard `level`) | Snapshot Careless (`lvl 0`) | `seatPrivate` Careless (`lvl 0`) | Snapshot Simple (`lvl 1`) | `seatPrivate` Simple (`lvl 1`) |
| --- | ---: | ---: | ---: | ---: |
| 1. Boot Hill (`0`) | 99% | 98.6% (99%) | 100% | 100.0% (100%) |
| 2. Raven Roost (`0`) | 100% | 99.8% (100%) | 100% | 99.7% (100%) |
| 3. The Bone Fence (`0`) | 70% | 72.1% (72%) | 86% | 85.5% (86%) |
| 4. Imp Hollow (`1`) | 40% | 38.5% (39%) | 84% | 84.4% (84%) |
| 5. The Hexed Mile (`1`) | 23% | 23.2% (23%) | 59% | 59.0% (59%) |
| 6. Dragon's Roost (`1.5`) | 21% | 22.5% (23%) | 40% | 40.3% (40%) |

- **`createShowdown` deals & Boot Hill `?practice=0` / `?practice=60` openings:** `100%` byte-for-byte identical (`59eb499d69e37046d016c7cd2b0461362e625d83de0b55b14163063f7f291a70` and `44f6413a1e2f97445bea6d7ac951235245eee54cb783f7cef06dda22047f19e2` both unchanged).
