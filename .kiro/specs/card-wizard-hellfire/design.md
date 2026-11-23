# CARD-WIZARD-HELLFIRE design

## Where the card lives

`wizard-hellfire.json` is Showdown-only, so it has no lane fields. `cards.js` maps effect `hellfire` to `{target: false, text: "Remove 1 orb from every enemy troop."}`. The engine reads `target: false` in `legalActions` and the effect id `"hellfire"` in `applyAction`.

## Rules path

| Step | Code |
| --- | --- |
| Offer | `legalActions` spell branch: with `!EFFECTS.hellfire.target`, push one `{type: "spell", cardId}` if `enemy.board.some(Boolean)`. Requires `!castUsed` and `!attacking`. |
| Resolve | `applyAction` spell branch: remove from hand, push to own discard, set `castUsed`. `hit` is every occupied enemy slot, computed once. For each slot: `health -= 1`, emit `spell`, `defeat()` at 0. |
| Not read | Ghostly, Guard, cover, traps, Last Stand, Bases. |

Because `hit` is computed before any defeat, a troop defeated by Hellfire does not shift another troop's slot.

## Interactions with other card types

| Other card | Result |
| --- | --- |
| Captured Wraith (Ghostly) | Loses 1 orb. |
| Covered Wagon (Guard) | Loses 1 orb, like every other troop. |
| Troops in cover | Lose 1 orb. |
| Dynamiter (Last Stand) | A 1-orb Dynamiter is defeated with no Last Stand. |
| Bear Trap | Does not spring. |
| Six-Shooter | Goes to the graveyard with a defeated carrier. |
| Sheriff's Office | Changes attack only; no effect on Hellfire. |
| Singularity, Bone Armor, Boneyard (Wizard) | Share the turn's one other-card play with Hellfire. |
| Hex (Wizard) | Can still be set the same turn. |

## Visible results

- Log: one line per troop hit, in slot order.
- Replay: `event-positions.js` gives the effect `hellfire` the `hellfire` beat kind and folds consecutive `spell` events with the same card id into one beat. Defeated troops get `burial` beats, and so does the spell.
- Gallery: `hellfireExample` seats a Wizard troop and three Cowboy troops, then applies the real action.

## Distinct from Singularity and the Graveyard Dragon

| | Hellfire | Singularity | Graveyard Dragon (Sweep) |
| --- | --- | --- | --- |
| Effect | Every enemy troop −1 | One non-Ghostly enemy troop −1 | Target −3 in a fight, then each other enemy troop −1 |
| Choice | None | One target | The attack target |
| Ghostly | Hit | Excluded | Hit |
| Traps | None spring | None spring | The oldest Cowboy trap springs first |
| Hit-back | None | None | From a surviving target |
| Uses | Other-card play | Other-card play | The Dragon's action |

## Design notes for Fable (not requirements)

- Hellfire is the only Wizard spell that can reach the Cowboys' Ghostly Captured Wraith. Wizard attacks and the Dragon's Sweep also reach it. If Hellfire is cut or retuned, check the Wraith matchup.
