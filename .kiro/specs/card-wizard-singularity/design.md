# CARD-WIZARD-SINGULARITY design

## Where the card lives

`wizard-singularity.json` is a lane spell. The sync script requires `relocates` and `copies` for the lane catalog. `showdownRecord` copies only `type`, `side`, `name`, `kind` and the `showdown` block (`rarity`, `effect: "shot"`). In Showdown the card is therefore Deadeye's effect under a Wizard name. Only the replay code reads the id `wizard-singularity` directly.

## Rules path

| Step | Code |
| --- | --- |
| Offer | `legalActions` spell branch: `EFFECTS.shot.target` is true, so one action per enemy slot whose troop exists and lacks `ghostly`. Guard is not read. Requires `!state.castUsed` and `!state.attacking`. |
| Resolve | `applyAction` spell branch: remove from hand, push to own discard, set `castUsed`, `hit = [action.target]`, `troop.health -= 1`, emit `spell`, `defeat()` at 0. |
| Not touched | `summonUsed`, `setUsed`, both Bases, traps, Last Stand, board positions. |

## Interactions with other card types

| Other card | Result |
| --- | --- |
| Captured Wraith (Cowboy, Ghostly) | Cannot be chosen. |
| Covered Wagon (Cowboy, Guard) | Does not redirect the spell. |
| Dynamiter (Last Stand) | A 1-orb Dynamiter is defeated with no Last Stand. |
| Bear Trap | Does not spring. |
| Cowboy troop in cover | Still loses the orb. |
| Six-Shooter on the target | Goes to the Cowboy graveyard if the target is defeated. |
| Lasso (Cowboy) | Separate effect `tie`; Singularity never stuns. |
| Hellfire (Wizard) | Shares the turn's one other-card play. The Wizards cannot cast both in one turn. |
| Bone Armor, Boneyard (Wizard) | Also use the other-card play. |
| Hex (Wizard) | A trap; can still be set the same turn. |

## Visible results

- Log: one `spell` line, for example "The Wizards' Singularity hit Sheriff: 2 orbs left."
- Replay: `event-positions.js` maps a `spell` event whose type is `wizard-singularity` to the `vortex` beat. If a Wizard troop stands on the caster's board, the vortex starts there; otherwise from the row.

## Gallery replays

`singularityExample` (attack-preview.js) seats a Wizard troop, puts `wizard-hellfire-71` in hand, applies the legal Hellfire action, then rewrites hand, discard and every event to `wizard-singularity-71` with `areaVortex: true`. `event-positions.js` groups those events into one `area-vortex` beat. The tests in `showdown-3d-presentation.test.js` check that grouping against 240 generated layouts with seed 172890 and against the two authored replays.

The gallery replays are not the playable rule. Requirements 19 to 22 describe them so they can be tested, and requirement 4 together with requirement 9 states the rule that matches run. Requirement SV4 in `singularity-preview-verification` keeps the ordinary single-target cast.

## Distinct from Hellfire and the Graveyard Dragon

| | Singularity | Hellfire | Graveyard Dragon (Sweep) |
| --- | --- | --- | --- |
| Effect id | `shot` | `hellfire` | keyword `sweep` |
| Choice | One target | None | The attack target; Sweep hits the rest |
| Ghostly | Excluded | Hit | Hit |
| Legal with no enemy troops | No | No | Dragon may attack the Base, no Sweep |
| Replay beat | `vortex` | `hellfire` | `breath` + `sweep` |

## Design notes for Fable (not requirements)

- Showdown has two names for one effect: Deadeye and Singularity are both `shot`. That is cheap to learn. But the gallery shows Singularity as an area spell, which matches Hellfire's effect rather than the card. A player who watches the gallery may expect an area cast in a match. Options are to keep the area replay labelled as a proposal, to replace it with the ordinary `vortex` cast, or to change the card. Each needs a Fable decision and, for clarity claims, a human playtest.
