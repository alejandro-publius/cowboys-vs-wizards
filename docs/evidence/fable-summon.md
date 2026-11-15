# Job A: seeded decks and atomic tribute summons

Work by Claude Fable 5.2 (Claude Code worker), 2026-11-15, on branch
`fable/summon-rules`. Not Kiro or Codex work. Scope: setup and summons only. No
combat, spells, CPU, turn progression or rendering.

Update from job C (`fable/match-engine`, see `docs/evidence/fable-match-engine.md`),
which extended this code. What changed in the text below: the top-level
`summonUsed` flag is now `allowances[side].summonUsed`; the state gained `seed`,
`round`, `startingSide`, `allowances`, `actionIds` and `result`; spell cards
gained `relocates`; an accepted `applyAction` also returns `events`; there are
more rejection reasons, and `summon-after-spell` now sits right after
`summon-used`. The test and mutation results below are job A's and were not
rerun for this note. Open questions 2, 3 and 8 are answered by job C.

## API

`src/game/cards.js`

- `SIDES`: `["cowboy", "wizard"]`.
- `CARDS`: frozen map of all 24 card instances by unique ID, for example
  `cowboy-mounted-billy-1`. Troop: `{ id, side, name, kind: "troop", stars,
  health, attack }`. Spell: `{ id, side, name, kind: "spell" }`. Data is the
  deck lists in `docs/kiro-task-01.md`.
- `DECKS`: unshuffled 12 IDs per side.
- `tributeCost(stars)`: 0 for 1–4 stars, 1 for 5–6, 2 for 7+.

`src/game/state.js`

- `createMatch(seed)`: `seed` must be an integer (throws `TypeError` otherwise).
  Returns the state below. Same seed, same state.
- `SLOT_COUNT` 3, `BASE_ORBS` 5, `OPENING_HAND` 4.

`src/game/actions.js`

- `applyAction(state, action)`: never mutates `state`.
  Accepted: `{ ok: true, state: newState }`.
  Rejected: `{ ok: false, reason, state }`, where `state` is the input object.

State (plain JSON-safe data; card data stays in `CARDS`):

```js
{
  revision: 0,          // +1 per accepted action
  rng: 123456789,       // mulberry32 state, one uint32
  activeSide: "cowboy", // seeded at setup
  summonUsed: false,    // the active side's one summon this action phase
  sides: {
    cowboy: {
      baseOrbs: 5,
      deck: [ids],      // index 0 is the top
      hand: [ids],
      board: [null, { cardId, health }, null], // three slots
      discard: [ids],
    },
    wizard: { /* same shape */ },
  },
}
```

Setup draws from the RNG in a fixed order: cowboy shuffle, wizard shuffle,
starting side. A summon draws nothing, so `rng` is the same before and after.

Summon action:

```js
{ type: "summon", side, revision, cardId, slot, tributes }
```

`revision` is the state revision the caller saw. `slot` is 0–2 on the acting
side. `tributes` is an array of that side's own slot indexes to sacrifice, `[]`
for none. On success the tributes go to discard, the card leaves the hand for
`slot` with its printed health, `summonUsed` becomes true and `revision` rises
by one, all in one step on a copy.

Rejection reasons, checked in this order:

| Reason | Meaning |
| --- | --- |
| `invalid-action` | Not an object with `type: "summon"` |
| `stale` | `revision` differs from the state (duplicate or retried submission) |
| `wrong-side` | `side` is not the active side |
| `summon-used` | The phase's one summon is already spent |
| `card-not-in-hand` | Card is not in the acting side's hand |
| `not-a-troop` | Card is a spell |
| `invalid-tribute` | `tributes` is not an array of distinct occupied own slots |
| `unpaid` | Fewer tributes than the card costs |
| `overpaid` | More tributes than the card costs |
| `invalid-slot` | `slot` is not 0, 1 or 2 |
| `slot-occupied` | `slot` holds a troop that is not being sacrificed |

## Test run

Command, from the worktree root, Node v26.0.0:

```
node --test tests/game/summon.test.js
```

Final result on the committed code: 7 tests, 7 pass, 0 fail.

The first run was 6 pass, 1 fail. The cause was in the test, not the rules: a
helper picked a spell as a "free" summon because spells have no stars. The
helper now picks troops only; the rules files did not change.

The tests cover seed replay, full-board sacrifice into a vacated slot (one and
two tributes), stale and retried actions, a second summon in the phase, 21
invalid selections each compared against a deep snapshot of the input state,
and card conservation over seeds 0–49. Seeds 14, 27 and 47 have no zero-tribute
troop in the active side's opening hand, so those three check setup only.

## Mutation checks

Each guard was changed in place, the same command was run, and the file was
restored and compared byte for byte with its backup. Results as observed:

| Mutation | Result | Failing test |
| --- | --- | --- |
| Once-per-phase check removed | 6 pass, 1 fail | stale or retried action |
| Unpaid tribute-count check removed | 6 pass, 1 fail | invalid selections |
| Stale-revision check removed | 5 pass, 2 fail | invalid selections; stale or retried action |
| Apply mutates the input instead of a copy | 6 pass, 1 fail | full-board sacrifice |
| Occupied-slot check removed | 5 pass, 2 fail | full-board sacrifice; invalid selections |
| Duplicate-tribute check removed | 6 pass, 1 fail | invalid selections |
| Wrong-side check removed | 6 pass, 1 fail | invalid selections |
| Seed ignored at setup (`state.js`) | 6 pass, 1 fail | seed replay |

All failures were assertion errors except the duplicate-tribute one, where the
mutated code threw a `TypeError` on the second sacrifice of the same slot. The
run before the mutations and the run after the last restore were both 7 pass,
0 fail. The `overpaid` check was not mutated.

## Open questions

1. Overpaying. The spec gives the cost per star band but not whether extra
   sacrifices are allowed. Smallest reading taken: the count must be exact.
2. Stale detection. The spec allows action IDs or an expected revision. Only the
   revision is implemented.
3. Phase state. `activeSide` and `summonUsed` exist so wrong-side and
   once-per-phase can be enforced. Nothing here switches the side or resets the
   flag; job C must, and may prefer one flag per side.
4. Seed. The caller must supply an integer. Kiro requirement 1.3 (generate a
   seed when none is given) is not implemented.
5. Slots. Each side has slots 0–2, with slot i facing slot i. The Kiro glossary
   numbers tiles 0–5 across the board; mapping to that is left to the caller.
6. Troop health on the board is stored as the card's printed health. Nothing
   reads it yet.
7. The shuffle algorithm (mulberry32, Fisher–Yates) and the setup draw order
   are my choices. Changing either changes what every seed produces.
8. Not built, because they are outside job A: legal-action listing, public
   state and events, terminal-match rejection, draws, spells.
9. Kiro requirement 1.1 (a card at every star value 1–8) contradicts the deck
   lists. `docs/kiro-task-01.md` says to remove it, so the deck lists were
   followed. The Kiro spec was not edited.
