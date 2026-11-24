# Showdown referee: input, output and rulings

`proof/referee/referee.py` is an independent adjudicator for standard Showdown
single duels. It was written only from `rules/RULEBOOK.md` and
`rules/cards.csv`. It uses the Python standard library and no network.
No engine code, engine output or recorded state went into it.

The rulebook says that where it disagrees with `rules.js`, the code wins. The
referee follows the prose only, so any disagreement with the engine is a
finding to resolve. It is not a referee bug by definition.

Schema version: `1` (`REFEREE_SCHEMA_VERSION`).

## Commands

```
python3 proof/referee/referee.py --stream < duels.ndjson > results.ndjson
python3 proof/referee/referee.py --check-catalog            # compares with rules/cards.csv
python3 -m unittest discover -s proof/referee -p 'test_*.py' -v
```

`proof/referee/examples/duels.ndjson` holds five input duels with distinct
seeds and deals. It contains inputs only. No expected outputs are checked in.

## Input: one duel per NDJSON line

```json
{
  "seed": 9001,
  "first": "cowboy",
  "decks": {"cowboy": ["sheriff-1", "..."], "wizard": ["skeleton-1", "..."]},
  "cardNames": {"optional-id": "Printed Name"},
  "actions": [{"type": "end"}]
}
```

- `seed` is echoed back unchanged. It never affects adjudication (ruling R1).
- `first` must be `"cowboy"` or `"wizard"`.
- `decks` must have exactly the keys `cowboy` and `wizard`. Each list is
  instance IDs in draw order; index 0 is the top card.
- Instance IDs decode in this order: `cardNames[instanceId]`, then
  `cardNames[catalogId]`, then the catalog slug. An instance ID without a
  `cardNames` entry must be `<catalog-id>-<copy number>`, e.g. `bone-wall-2`.
  The catalog ID is the printed name lowercased, with apostrophes removed and
  every other run of non-alphanumerics replaced by `-`:
  `sheriffs-office`, `jack-o-lantern`, `six-shooter`. The alias
  `sheriff-s-office` is also accepted.
- An instance ID must be unique within its own deck. The same ID may appear in
  both decks if it names the same card.
- Blank lines are skipped. Every other line produces exactly one output line.

### Actions

| type | fields | notes |
| --- | --- | --- |
| `summon` | `cardId`, `tributes` | `tributes` is a list of the active side's zero-based troop slots. A missing field means `[]`. |
| `spell` | `cardId`, optional `target` | `target` is an enemy troop slot. `slot` is accepted as an alias. If both are given they must match. |
| `gear` | `cardId`, `slot` | `slot` is one of the active side's troop slots. |
| `location` | `cardId` | |
| `set` | `cardId` | Sets a trap face down. |
| `attack` | `slot`, `target` | `slot` is the attacker's slot. `target` is an enemy slot number or `"base"`. |
| `cover` | `slot` | |
| `end` | | |

Slots must be JSON integers. Booleans and numeric strings count as malformed.

## Output: one JSON object per duel

```json
{"seed": 9001, "initial": {...}, "steps": [{"accepted": true, "state": {...}, "error": null}], "unsupported": []}
```

- `initial` is the state after setup: both opening hands drawn, turn 1 started,
  and no draw for the first side.
- `steps[i]` corresponds to `actions[i]`. `state` is the full state after the
  action. On rejection, `state` equals the previous state exactly, because the
  action is applied to a copy that is thrown away.
- `error` is `null` when the action is accepted. Otherwise it is a code from
  the table below. It is informational; adapters may compare only `accepted`
  and `state`.
- `unsupported` lists what the referee could not adjudicate:
  - `"step N: unsupported-action-type:<type>"` for an action type outside the
    core set (the step is also rejected);
  - `"invalid-duel: <reason>"` when the duel itself is unusable. In that case
    `initial` is `null` and `steps` is `[]`.

### State

```json
{
  "turn": 1,
  "active": "cowboy",
  "first": "cowboy",
  "over": false,
  "winner": null,
  "reason": null,
  "location": null,
  "allowances": {"troop": true, "other": true, "trap": true, "cards": true},
  "players": {
    "cowboy": {
      "base": 5,
      "hand": ["sheriff-1"],
      "deck": ["sheriff-5"],
      "discard": [],
      "troops": [null, {"id": "sheriff-2", "card": "Sheriff", "type": "Lawman", "attack": 1,
                        "orbs": 3, "gear": [], "statuses": [], "rest": true, "acted": false}, null],
      "traps": [{"id": "bear-trap-1", "card": "Bear Trap", "setTurn": 1}, null]
    },
    "wizard": {"...": "same shape"}
  }
}
```

| field | meaning |
| --- | --- |
| `turn` | Global turn counter. Turn 1 is the first side's first turn, turn 2 the other side's first turn, and so on. |
| `active` | Side whose turn it is. After the game ends, the side that was active. |
| `over` | `true` once `reason` is set. |
| `winner` | `"cowboy"`, `"wizard"` or `null`. `null` with `over: true` means a turn-limit draw. |
| `reason` | `null`, `"base-destroyed"` (a Base reached 0 orbs from any source, including drawing from an empty deck), `"turn-limit"` or `"turn-limit-draw"`. |
| `location` | `null` or `{id, card, owner}`. `owner` is the side that played it. |
| `allowances` | For the active side this turn. `troop`, `other` (spell, gear or location) and `trap` are true while that play is still available. `cards` becomes false once any troop attacks or takes cover. |
| `base` | Base orbs, clamped at 0. |
| `hand` | Instance IDs in the order drawn. |
| `deck` | Remaining instance IDs. Index 0 is the next draw. |
| `discard` | The graveyard, oldest first. |
| `troops` | Always 3 entries, `null` for an empty slot. Troops never move between slots. |
| troop `attack` | Effective attack: printed attack plus gear plus the location bonus. |
| troop `orbs` | Current orbs. Bone Armor can lift this above the printed value. |
| troop `gear` | Gear instance IDs in the order attached. |
| troop `statuses` | Sorted subset of `["cover", "stunned"]`. |
| troop `rest` | `true` if the troop arrived this turn and may not attack (free summon or Raise, without Quickdraw). It can still take cover. |
| troop `acted` | `true` once it has attacked or taken cover this turn. |
| `traps` | Always 2 entries, `null` for an empty slot. `setTurn` is the global turn the trap was set. The lowest `setTurn` is the oldest trap. |

The referee's state is omniscient. Face-down traps and both hands and decks are
shown in full.

### Error codes

`malformed-action`, `unsupported-action-type:<type>`, `game-over`,
`card-not-in-hand`, `wrong-card-kind`, `cards-locked`, `troop-already-played`,
`other-card-already-played`, `trap-already-set`, `slot-out-of-range`,
`duplicate-tribute`, `tribute-slot-empty`, `wrong-tribute-count`, `board-full`,
`target-required`, `target-slot-empty`, `target-ghostly`, `already-stunned`,
`spell-takes-no-target`, `gear-slot-empty`, `same-location-in-play`,
`trap-slots-full`, `troop-slot-empty`, `no-attacks-on-turn-1`,
`troop-already-acted`, `troop-resting`, `troop-stunned`, `zero-attack`,
`base-protected`, `guard-blocks-ride`, `must-attack-guard`.

When several checks fail, the code reports the first one in code order. Only
the fact of rejection is a rules claim.

## How each action resolves

- **Setup.** Each side draws 4 from the top. The second side draws a 5th. Bases start at 5.
- **end.** The active side's troops lose `stunned`. If `turn` is 80 or more,
  the game is decided by Base orbs (R3). Otherwise `turn` increases by 1 and
  the other side becomes active. That side stands up (its troops lose `acted`,
  `rest` and `cover`), allowances reset, and it draws. A draw from an empty
  deck costs 1 Base orb. A draw with 6 cards in hand goes to the discard.
- **summon.** The card must be a Troop in hand, cards must not be locked, and
  the troop allowance must be unused. The tribute count must equal the CSV
  "Tributes to summon" value (which matches the stars rule for every card).
  Tributes go to the discard in the listed order, each followed by its gear.
  The troop takes the lowest empty slot. It rests if it cost no tribute and
  lacks Quickdraw. Scout then draws: nothing from an empty deck, and to the
  discard when the hand holds 6. Raise then returns the most recently
  discarded Undead troop card from the summoner's discard into the lowest
  empty slot with 1 orb, no gear and `rest` true unless it has Quickdraw.
  Raise does nothing if the board is full or no Undead troop is in the discard.
- **spell.** Uses the `other` allowance. Deadeye and Singularity take 1 orb
  from a chosen enemy troop. Lasso stuns a chosen enemy troop. A chosen target
  must be an occupied enemy slot, must not be Ghostly, and for Lasso must not
  already be stunned. Hellfire takes 1 orb from every enemy troop, Ghostly
  ones included, and accepts no target. Spell damage never reaches a Base. The
  spell goes to the caster's discard after it resolves.
- **gear.** Uses the `other` allowance and goes on an occupied own slot.
  Six-Shooter adds +1 attack. Bone Armor adds 2 orbs at once.
- **location.** Uses the `other` allowance. It is rejected if a location with
  the same name is in play, whoever owns it. The old location goes to its
  owner's discard. Sheriff's Office gives +1 attack to every Lawman and
  Boneyard gives +1 attack to every Undead, on both sides.
- **set.** Uses the `trap` allowance and needs a free trap slot. The trap takes
  the lowest empty slot and records `setTurn`.
- **cover.** Any own troop that has not acted can take cover, even if it is
  resting, stunned or has zero attack, and even on turn 1. It sets `acted`
  and `cover` and locks cards.
- **attack.** Rejected on turn 1, or if the attacker has acted, is resting, is
  stunned or has attack 0 or less. A slot target must be occupied, and must
  have Guard if any enemy has Guard. `"base"` is allowed when the enemy has
  no troops, for full attack. It is also allowed for a Ride troop when no
  enemy has Guard: a ride-past for exactly 1 orb. Once legal, the attacker is
  marked `acted` and cards lock. Then:
  1. The defender's oldest trap springs and goes to its owner's discard. Hex
     ends the attack. Bear Trap takes 2 orbs from the attacker; if that
     defeats it, the attacker and its gear go to the discard and the attack
     ends. Otherwise the attack continues.
  2. A direct or ride-past attack removes Base orbs, and that is all.
  3. In a fight, the target loses orbs equal to the attack. If defeated, the
     target goes to the discard and the excess hits its owner's Base unless
     the target was in cover. A surviving target not in cover hits back with
     its effective attack.
  4. Last Stand: if exactly one troop fell from fight damage and it has Last
     Stand, the other troop loses 1 orb.
  5. Sweep: if the attacker has Sweep, every enemy troop other than the target
     slot loses 1 orb.

## Rulings on points the rulebook leaves open

- **R1 Shuffle and seed.** The input decks are already in draw order and the
  referee does not shuffle them. `seed` is echoed only.
- **R2 "Turn 1".** Read as the global first turn, so only the first side's
  opening turn bars attacks and skips the draw. The second side may attack on
  its first turn (global turn 2).
- **R3 Turn limit.** "Still going after turn 80" is checked on the `end` of
  global turn 80, after stun recovery. More Base orbs wins (`turn-limit`).
  Equal Bases give no winner (`turn-limit-draw`); the rulebook does not cover
  a tie. With 16-card decks, drawing from an empty deck costs a Base orb each
  turn, so this limit is very unlikely to be reached in practice.
- **R4 Setup from a short deck.** Opening draws from an empty deck draw
  nothing and cost no orbs. The empty-deck penalty is applied only to the
  turn's draw step (rule 4.2).
- **R5 Slots.** A new troop, raised troop or trap takes the lowest empty slot.
  Nothing moves when a slot empties.
- **R6 Discard order.** Tributes go in the listed order. A defeated troop goes
  first, then its gear in attach order. A spell is discarded after it
  resolves.
- **R7 What reaches a Base.** Only the attacking troop's excess damage on the
  target (rule 5, "Damage") and direct or ride-past attacks do. Hit-back
  excess, Last Stand, spells, traps and Sweep never do. Rule 5 states excess
  only for the target; hit-back excess is not mentioned.
- **R8 Last Stand chains.** Given rule 5 (a defeated target does not hit
  back), both troops can never fall from fight damage, so the sentence "If
  both troops fall, it does nothing" never applies there. The referee fires
  Last Stand only when the other troop is still on the board. The orb that
  Last Stand removes does not trigger the other troop's Last Stand, because
  it is not fight damage.
- **R9 Sweep timing.** Sweep resolves after hit-back and Last Stand. It fires
  even if the attacker itself fell from hit-back, because the attack happened.
  It does not fire when a trap cancels the attack or defeats the attacker.
- **R10 Hellfire with a target.** Rejected (`spell-takes-no-target`), because
  the rulebook says Hellfire "chooses none". Hellfire with no enemy troops is
  accepted and does nothing.
- **R11 Stun lifetime.** Lasso sets `stunned`. The troop's owner cannot attack
  with it during their next turn, and it recovers at the end of that turn.
  The "already stunned" check is implemented. With this card pool it cannot
  trigger, because only one spell can be cast per turn and the stun ends
  before the caster's next turn.
- **R12 Cover duration.** Cover ends at the owner's next stand-up. A troop in
  cover still loses orbs to spells, Sweep and attacks. Excess damage on it
  stays off the Base and it does not hit back. It still makes its Last Stand.
- **R13 Spell targets** are enemy troops only, per the card text. **Gear**
  goes only on the player's own troops (rule 8).
- **R14 Base floor.** Base orbs are clamped at 0. The first Base to reach 0
  ends the game. Later effects in the same action still resolve, but the
  winner does not change.
- **R15 Deck construction.** Deck size (16) and rarity limits are not enforced.
  Cards of either faction may be in either deck, since no rule forbids it.
  This lets fixtures use short decks to reach deck-out.
- **R16 Raised troops' own arrival keywords.** No Undead troop has Scout or
  Raise, so this question does not come up with the current cards.
- **R17 After game over** every action, `end` included, is rejected with
  `game-over`.

## Not supported (out of scope)

Best of three, side decks, two-player hand-off, the Trail, rivals, bounties
and boss modifiers (the starting Lantern Wraith, Graveyard Dragon landing,
extra boss orbs), rematch Base bonuses, packs and card rewards. The referee
also does not hide information.

## Integration points for the engine adapter

- The adapter translates engine state into this schema. The schema does not
  change to fit the engine after freeze.
- Slot positions matter. If the engine compacts troops or traps, the adapter
  must map them back to fixed slots, or record the difference as a finding.
- Trap age: the adapter must supply `setTurn` (global turn), or the trap order
  must be derived from it.
- `rest` means arrival rest only, and `acted` means used this turn. An engine
  that merges these needs a mapping.
- `attack` is the effective value. An engine that stores printed attack plus
  modifiers must compute it.
- The `turn` numbering in R2 must match the engine, or be translated.
- `error` codes are referee-only. Compare `accepted` and `state`.
