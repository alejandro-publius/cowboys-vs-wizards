# Job C: match engine (phases, spells, clash, results)

Work by Fable (Claude Fable 5.2, Claude Code worker), 2026-11-15, on branch
`fable/match-engine`, extending job A (`docs/evidence/fable-summon.md`). Not
Kiro or Codex work. No CPU, renderer or UI. Balance is untested.

Requirements snapshot used: `.kiro/specs/orb-duel/requirements.md` in the main
checkout, uncommitted working copy over base commit 37960ed, read 2026-11-15,
sha256 `6a5a9ccf5c0a6535dfb59cd59856e18813de55c5271c76beaf923a35eed74780`
(recomputed with `shasum -a 256` at read time and after the work: same value).

## API

| Module | Exports |
| --- | --- |
| `src/game/cards.js` | `SIDES`, `CARDS`, `DECKS`, `tributeCost(stars)`, `opponent(side)`, `SPELL_DAMAGE` (1) |
| `src/game/state.js` | `createMatch(seed)`, `SLOT_COUNT` 3, `BASE_ORBS` 5, `OPENING_HAND` 4, `MAX_ROUNDS` 9, `RULES_VERSION` `"orb-duel-draft-1"` |
| `src/game/actions.js` | `applyAction(state, action)` |
| `src/game/legal.js` | `legalActions(state, side)` |
| `src/game/view.js` | `publicState(state, side)` |
| `src/game/clash.js` | `resolveClash`, `resultAfterClash`: internal to `applyAction` (they change the working copy) |

Start a match: `createMatch(seed)`, integer seed required (`TypeError` otherwise);
the caller generates one when the user gives none. Restart: `createMatch(state.seed)`.

State (plain JSON-safe data):

```js
{
  seed, revision, rng,          // rng is fixed after setup: nothing later draws from it
  round,                        // 1..9
  startingSide,                 // acts first this round; alternates each round
  activeSide,                   // whose phase it is; null once the match is over
  allowances: { cowboy: { summonUsed, castUsed }, wizard: { summonUsed, castUsed } }, // reset each round
  actionIds: [],                // IDs of accepted actions that supplied one
  result: null,                 // or { winner, loser, reason, round }
  sides: { cowboy: { baseOrbs, deck, hand, board: [null | { cardId, health }] x3, discard }, wizard: {...} },
}
```

`result`: `winner` and `loser` are side names, or both `null` for a draw; `reason`
is `"base-destroyed"` or `"round-limit"`; `round` is the round whose clash ended it.

Actions. Each takes `side`, `revision` (the state revision the caller saw) and an
optional non-empty string `actionId`:

```js
{ type: "summon", cardId, slot, tributes }       // tributes: own slot indexes, [] for none
{ type: "spell", cardId, target, destination }   // enemy slot indexes; destination optional (Singularity only)
{ type: "end-phase" }
```

`applyAction` returns `{ ok: true, state, events }` or `{ ok: false, reason,
state }` (the input object, untouched; no `events` key). Reasons, in check order:

| Reason | Meaning |
| --- | --- |
| `match-over` | The match has a result. Checked first, for any input |
| `invalid-action` | Not an object, unknown `type`, or `actionId` not a non-empty string |
| `duplicate-action` | `actionId` was already committed in this match |
| `stale` | `revision` differs from the state |
| `wrong-side` | `side` is not `activeSide` |
| summon | `summon-used`, `summon-after-spell`, then job A's list unchanged |
| spell | `cast-used`, `card-not-in-hand`, `not-a-spell`, `invalid-target` (no troop in that enemy slot), `invalid-destination` (not Singularity, target would die, or not an adjacent empty enemy slot) |

Events: ordered, public information only. Every event also carries `revision` (the
revision the action was applied to; the new state is one higher) and the action's
`actionId` when it had one.

| Type | Fields |
| --- | --- |
| `summon` | `side`, `cardId`, `slot`, `tributes` (slot indexes) |
| `spell` | `spell` (card name), `cardId`, `caster`, `target: { side, slot, cardId }`, `before`, `after`, `destination` only when moved |
| `damage` | `lane`, `attacker: { side, slot, cardId }`, `target: { kind: "troop", side, slot, cardId }` or `{ kind: "base", side }`, `amount`, `before`, `after` |
| `defeat` | `side`, `slot`, `cardId` (after a spell kill or a clash) |
| `phase-end`, `phase-start` | `side`, `round` |
| `clash` | `round` (marks the start of the clash) |
| `round-start` | `round`, `startingSide` |
| `draw` | `side` only |
| `result` | `result` (same object shape as `state.result`) |

The first side's end-phase gives `phase-end`, `phase-start`. The second side's gives
`phase-end`, `clash`, all `damage` (lane 0 to 2, cowboy before wizard in a lane), all
`defeat`, then `result`, or else `round-start`, up to two `draw` (starting side
first) and `phase-start`. Each health change and its `damage` event are written from
the same numbers. `amount` is the full attack; `after` is `max(0, before - amount)`,
so several hits on one base chain their `before`/`after`.

`legalActions(state, side)`: `[]` when the match is over or it is not that side's
phase. Otherwise complete actions with the current `revision` and no `actionId` (add
one to the copy you submit). Fixed order: summons in hand order (each tribute set in
ascending slot order, then each free or vacated slot), spells in hand order (target
ascending; plain cast, then each destination), `end-phase` last and always present.
It also accepts `publicState(state, side)` for the same side, with the same output.

`publicState(state, side)`: an independent copy.

```js
{ viewer, revision, round, startingSide, activeSide, allowances,
  result,   // null, or { winner, loser, reason, round, outcome: "win" | "loss" | "draw" } for the viewer
  sides: { [viewer]:   { baseOrbs, deckCount, handCount, hand, board, discard },
           [opponent]: { baseOrbs, deckCount, handCount, board, discard } } }
```

Hidden: the opponent's hand, both deck orders, `rng`, `seed` (it reproduces both
shuffles) and `actionIds`.

## Verification

Node v26.0.0, from the worktree root. The literal `node --test tests/game/` does not
run on this Node whatever the code: it loads the directory as a module
(`MODULE_NOT_FOUND`; 1 test, 0 pass, 1 fail). Command used: `node --test "tests/game/*.test.js"`.

Final result on the committed code: 30 tests, 30 pass, 0 fail (7 job A summon tests,
21 focused match tests, 2 seeded invariant checks). One earlier run was 28 pass, 1
fail of 29: the publicState test's own setup played a scripted match that ended
before the round it waited for. It now builds its position directly; no rules file
changed for it.

Seeded invariant checks (`tests/game/invariants.test.js`; plain seeded loops, no
testing library): match seeds 0–99, which include 14, 27 and 47. A mulberry32 picker
local to the test picks among legal actions until the match ends. After every step:
24 distinct card IDs each in one zone of its own side, troop health 1..max, bases
0..5, round ≤ 9, deck size, allowances per side per round, and `legalActions` equal
to the brute-force candidate actions `applyAction` accepts. Each walk runs twice and
the two runs are compared.

| Walk | Walks | Steps total | Min | Max (bound 54) | Seeds 14, 27, 47 | Endings |
| --- | --- | --- | --- | --- | --- | --- |
| uniform (any legal action) | 100 | 1719 | 9 | 38 | 15, 11, 10 | base destroyed 99 (cowboy 47, wizard 36, draw 16), round limit 1 |
| sparse (summons offered 15% of steps) | 100 | 1762 | 9 | 25 | 21, 18, 21 | base destroyed 68 (cowboy 40, wizard 25, draw 3), round limit 32 (cowboy 11, wizard 8, draw 13) |

Sanity breaks, one bounded pass: each rule was broken in place, the same command
run, the file restored from a backup and compared byte for byte.

| Break | Result | Failing tests |
| --- | --- | --- |
| Excess clash damage spills past a blocker to the base | 29 pass, 1 fail | blocking troop absorbs the whole attack |
| Clash stops once a base is at zero | 28 pass, 2 fail | both bases at zero is a draw; one base at zero and the rest still resolves |
| `publicState` includes the opponent's hand | 29 pass, 1 fail | publicState hides the opponent's hand |

After the last restore: 30 pass, 0 fail, `git diff --stat` empty against the engine
commit. The walks did not catch the first two breaks; only the focused tests did.

Job A files changed: `tests/game/summon.test.js` (two assertions read
`allowances[side].summonUsed` in place of the removed top-level `summonUsed`) and
`docs/evidence/fable-summon.md` (one paragraph listing what job C changed).

## Requirements and design against the owner's decisions (decisions win)

- Requirement 1.9 has the Engine generate a seed when none is supplied. The engine
  requires an integer seed; the UI controller generates one.
- Kiro's design lists a top-level `summonUsed`; it is now `allowances[side]`.
- Kiro's design says "each clash returns an events list" and "`result` is win, loss
  or draw". The clash is not a separate call: its events are in the second side's
  `end-phase` result. `state.result` names sides; win/loss/draw is
  `publicState(...).result.outcome`.
- No other disagreement found. "Per Round" and "per action phase" limits are the
  same here: a side has one phase per round.

## Limitations and open questions

1. A deck cannot run out before the last draw in real play (eight cards, eight
   draws), so "empty deck continues" is tested only on a built position.
2. Event `revision` is the pre-action revision; the resulting one is `revision + 1`.
   Open: confirm that reading suits the renderer.
3. A retried action with a committed `actionId` gets `duplicate-action`; without an
   ID it gets `stale`; on a finished match both get `match-over`.
4. `actionIds` is kept for the whole match (at most 54 entries).
5. `legalActions` lists each card instance separately: six Sheriffs give six sets of
   equal summons. A CPU may want to group by card name.
6. `publicState` hides the seed: the UI shows the seed from its own controller, and
   a CPU must be given only the view.
7. The engine does not validate hand-built states; test fixtures are trusted.
8. Spells cannot damage a base and a spell kill never ends the match: only the clash
   decides results.
9. Seeds 14, 27 and 47 still have no zero-tribute troop in the starting side's
   opening hand. Nothing was changed for them.
