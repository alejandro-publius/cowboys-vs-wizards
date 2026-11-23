# CARD-WIZARD-DRAGON design

## One card, two entrances

| | Dragon from a deck | Graveyard Dragon boss |
| --- | --- | --- |
| Card id | `wizard-dragon-1` | `wizard-dragon-0` |
| How it arrives | Summon action, 2 tributes | `arrivals` entry, start of Wizard turn 4 or the first later Wizard turn with a free slot |
| Orbs on arrival | 5 | Hunt orbs: 2, 3, 3, 4, 4 |
| Attacks the turn it arrives | Yes (`ready: paid`) | No (`arrive` without `paid`) |
| Uses the turn's summon | Yes | No |
| Where it appears | Even match, Dragon's Roost, Graveyard Coven | Graveyard Dragon hunts only |

After arrival both are the same troop: 3 attack, Beast, Sweep.

## Attack resolution (`rules.js` `attack`)

1. Mark the Dragon as having acted.
2. If the Cowboys have a trap, the oldest springs. A Bear Trap removes 2 orbs. If that leaves 0, the Dragon is defeated and the function returns: no damage, no Sweep (requirement 15).
3. Compute `attackOutcome` and apply target damage and hit-back.
4. Last Stand for the fight pair only.
5. Defeat the target if it has 0 orbs.
6. Sweep: every occupied enemy slot other than `action.target` loses 1 orb. A troop reaching 0 is defeated. Emit `sweep` if any slot was hit.
7. Defeat the Dragon if the hit-back left it at 0 (requirement 14).
8. Apply overflow from step 3 to the enemy Base. Sweep adds none (requirement 10).

A Base attack skips steps 3 to 7 (requirement 11). Step 6 never checks cover or Ghostly (requirement 12). Last Stand is evaluated only in step 4 (requirement 13).

## Boss landing (`applyAction` end-of-turn branch)

`createShowdown` stores `{side: "wizard", type: "wizard-dragon", turn: 4, health}` in `state.arrivals`. When a turn begins, the engine resets the per-turn flags first. Then, for each arrival due to the side whose turn starts, it lands the boss in `board.indexOf(null)` or breaks if the board is full. The draw follows. Because the per-turn flags are reset before landing and landing never sets them, the Wizards keep their summon, other-card and trap plays (requirement 28).

## Interactions with other card types

| Other card | Result |
| --- | --- |
| Covered Wagon (Cowboy Guard) | The Dragon must attack it first. Sweep still hits the rest. |
| Cowboy troop in cover | Takes the Sweep orb. As the target, it keeps overflow off the Cowboy Base and does not hit back. |
| Dynamiter (Last Stand) | As the fight target, its Last Stand takes an orb from the Dragon. Hit by Sweep, it fires nothing. |
| Captured Wraith (Ghostly) | Takes the Sweep orb, because Sweep is not a spell. |
| Bear Trap | Springs first. It defeats a 1- or 2-orb boss before it strikes. A 5-orb Dragon survives on 3 and attacks with Sweep. |
| Deadeye, Lasso | Can target the Dragon; it is not Ghostly. |
| Wizard (Raise) | Never returns a Dragon: it is a Beast. |
| Boneyard | Gives no attack: the Dragon is not Undead. |
| Bone Armor | Adds 2 orbs to the carrier, the landed boss included. |

## Visible results

- Log: "The Wizards' Dragon attacked <target> and ...", then "Sweep: Dragon also hit <n> other troop(s) for 1." The landing logs "The Wizards' Dragon arrived."
- Beats: `attackKind` returns `breath` for any type ending in `-dragon`, for the attack and for its hit-back. `sweep` builds one beat over the other occupied slots and draws them at the after-state orbs. The Dragon GLB's exported attack clips are existing assets; this spec adds no animation.

## Distinct from Hellfire and Singularity

| | Graveyard Dragon / Dragon | Hellfire | Singularity |
| --- | --- | --- | --- |
| Kind | Troop (attack + Sweep) | Spell, no target | Spell, one target |
| Who is hit | Target for 3, others for 1 | Every enemy troop for 1 | One non-Ghostly enemy troop for 1 |
| Ghostly troops | Hit by Sweep | Hit | Cannot be chosen |
| Springs traps | Yes | No | No |
| Hit-back | Yes, from the target | None | None |
| Turn slot used | Troop action | The turn's one other card | The turn's one other card |

## Design notes for Fable (not requirements)

- `progress.js` reports that putting a Bone Wall in front of the boss made the hunt close to unwinnable, so the escort has no Guard troop.
- The landed boss can legally be paid as a tribute for an escort Wizard (requirement 30). Paying it would throw away the boss. Nothing measured shows whether the bot ever does this. A seeded hunt sample that counts `tribute` events on `wizard-dragon-0` would answer it before deciding whether a rule is needed.
