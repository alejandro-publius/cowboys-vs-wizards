# Custom Cowboy deck simulation (Kiro)

Attribution: base `599450a` (PR #14 title/menu and deck builder) is Codex's work, including the menu and `src/game/deck-builder.js`. Kiro wrote only `tests/game/custom-deck-simulation.test.js` and this note, on branch `kiro/custom-deck-simulation`. No runtime, UI, art, `.kiro`, dependency or `src/main.js` change. Evidence commit `c69a3fe` was not touched.

## Command and result (run once)

```
node --test tests/game/custom-deck-simulation.test.js tests/game/deck-builder.test.js
```

9 tests, 9 pass, 0 fail. Simulation diagnostics:

- 128 samples, each played twice. Replays matched on every action, event and per-step state.
- 2199 actions in total (per sample min 9, max 40; bound `MAX_ROUNDS*2*3` = 54).
- 1419 CPU decisions, each with a hidden-field perturbation check.
- 111 of 128 decks contain Deadeye spells.
- Endings: base-destroyed/wizard 85, base-destroyed/cowboy 37, base-destroyed/draw 6. None needed the round limit. These are outcomes under this CPU and random-opponent mix. They are not a balance estimate.

## Sample construction

All 128 compositions are distinct and accepted by `validateDeck` and `validateDeckIds`. Seed for sample `i` is `(i*7919+13) % 100000`. The Wizard deck is always `DECKS.wizard`.

Seven named edges (counts Sheriff/Billy/Mounted/Deadeye):

1. six Mounted, one Sheriff, five Billy: 1/5/6/0
2. six Mounted, one Sheriff, five Deadeye: 1/0/6/5
3. six Mounted, two Sheriff, two Billy, two Deadeye: 2/2/6/2
4. maximum spells (six Deadeye): 3/3/0/6
5. no spells: 6/4/2/0
6. one Sheriff: 1/5/0/6
7. default deck: 6/3/1/2

The other 121 come from one pass over the finite list of valid compositions (Sheriff 1-6, others 0-6, total 12), ordered by a seeded shuffle. There is no generate-and-reject loop.

Play modes rotate by sample index (32 each): CPU Cowboy vs seeded random Wizard, seeded random Cowboy vs CPU Wizard, CPU vs CPU, and CPU Cowboy vs random Wizard again. The random side picks a seeded choice from `legalActions`.

## Checked at setup and after every action

- Each side holds exactly its selected 12 IDs across deck, hand, discard and board (Cowboy compared with its custom IDs, not `DECKS.cowboy`). IDs are globally unique and belong to the right faction.
- Three board slots, troop health 1..card health, base orbs integer 0..5, round 1..9.
- Every legal action is accepted, advances `revision` by exactly 1, and does not mutate the input state.
- The CPU action is one of the offered legal actions.
- The game ends within the action bound. A terminal state has no active side and no legal actions for either side. An ended match has a destroyed base or is at round 9.

## Hidden-information check scope

The CPU is given only `publicState(state, side)`. At each CPU decision the test asserts that the view has no opponent `hand`, no `deck` arrays, and no `seed` or `rng`. It then builds the same position with the opponent's hand/deck order reversed across the two zones, the viewer's own deck order reversed, and seed/rng changed. The public view and the CPU action must be identical. This covers those fields on these 1419 positions. It is not a proof that no other information leaks (for example, discard contents and deck counts are public by design).

## Gaps and findings

- No application defect found. No reproducer needed.
- Not tested: visuals, the browser menu or deck builder UI, user acceptance, and balance. The Wizard side always uses its fixed deck, and the random side is not a model of a human player.
- Not run, per task scope: build, full suite, browser checks.
