# CARD-WIZARD-JACK-O-LANTERN requirements

The Jack-o'-Lantern is a free 1/1 Fiend with Last Stand: when it is defeated in a fight, the troop that fought it loses 1 orb.

## Sources

- Card spec: `.kiro/specs/duel-card-pipeline/cards/wizard-jack-o-lantern.json`
- Generated catalog: `src/game/card-specs.generated.js`
- Tables: `src/game/showdown/cards.js` (`KEYWORDS.laststand`, `DECKS`)
- Engine: `src/game/showdown/rules.js` (`attack` lines 213–222, `applyAction` spell and summon branches)
- Opponent decks: `src/game/showdown/trail.js` (Raven Roost, Imp Hollow), `src/game/showdown/progress.js`
- Rulebook: `prototypes/showdown/RULEBOOK.md` sections 9 (Last Stand), 10 ("Last Stand", "Cover and Last Stand"), 13 ("A fight")
- Log text: `src/game/showdown/presenter.js` (`laststand`)
- Replay beats: `src/ui/showdown-3d/event-positions.js` (`laststand` case); gallery `src/ui/showdown-3d/attack-preview.js`
- Existing tests: `prototypes/showdown/rules.test.js` ("Last Stand: the defeated troop takes an orb off the troop that fought it, attacking or defending"); `tests/match/showdown-3d-presentation.test.js` ("covered Last Stand, Ride, and lethal Sweep retain distinct contact outcomes")

## Card data

- **CARD-WIZARD-JACK-O-LANTERN-01.** THE catalog SHALL define `wizard-jack-o-lantern` as a Showdown-only Wizard troop named "Jack-o'-Lantern" with 1 star, 1 attack, 1 orb, rarity `common`, type tag `Fiend` and the single keyword `laststand`.
- **CARD-WIZARD-JACK-O-LANTERN-02.** THE Wizard opponent decks SHALL hold Jack-o'-Lanterns in these counts: even match 1, Raven Roost 3, Imp Hollow 3, Dragon's Roost 1, The Imp 3, The Graveyard Coven 1, Lantern Wraith escort 3, Graveyard Dragon escort 2, and none in any other deck.

## Last Stand

- **CARD-WIZARD-JACK-O-LANTERN-03.** WHEN a Cowboy troop attacks a Jack-o'-Lantern and defeats it while the attacker keeps at least 1 orb, THE engine SHALL remove 1 orb from the attacker.
- **CARD-WIZARD-JACK-O-LANTERN-04.** WHEN a Jack-o'-Lantern attacks a Cowboy troop that survives and the hit-back defeats the Jack-o'-Lantern, THE engine SHALL remove 1 orb from that Cowboy troop.
- **CARD-WIZARD-JACK-O-LANTERN-05.** WHEN Last Stand takes the other troop's last orb, THE engine SHALL defeat that troop in the same attack.
- **CARD-WIZARD-JACK-O-LANTERN-06.** WHEN a Jack-o'-Lantern in cover is defeated by an attack, THE engine SHALL still fire its Last Stand.
- **CARD-WIZARD-JACK-O-LANTERN-07.** WHEN a Last Stand in a fight leaves both troops on 0 orbs, THE engine SHALL fire no second Last Stand, so Last Stand never chains.
- **CARD-WIZARD-JACK-O-LANTERN-08.** WHEN a Jack-o'-Lantern is defeated by a tribute, a spell, a trap or Sweep, THE engine SHALL fire no Last Stand.
- **CARD-WIZARD-JACK-O-LANTERN-09.** WHEN a Jack-o'-Lantern attacks the Cowboy Base, THE engine SHALL fire no Last Stand, because a Base attack is not a fight.

## Visible results

- **CARD-WIZARD-JACK-O-LANTERN-10.** WHEN Last Stand fires, THE engine SHALL emit a `laststand` event naming the Jack-o'-Lantern, the troop that lost the orb, and its orbs left.
- **CARD-WIZARD-JACK-O-LANTERN-11.** WHEN the log presents that event, THE log SHALL read "Last Stand: Jack-o'-Lantern took an orb off <name>." or, at 0 orbs left, "Last Stand: Jack-o'-Lantern took an orb off <name>, defeating it."
- **CARD-WIZARD-JACK-O-LANTERN-12.** WHEN the Card gallery lists previews for Jack-o'-Lantern, THE gallery SHALL offer "Watch attack" and "Watch Last Stand".
- **CARD-WIZARD-JACK-O-LANTERN-13.** WHEN the "Watch Last Stand" preview runs, THE gallery SHALL apply a real Cowboy Sheriff attack on the Jack-o'-Lantern and show a `laststand` beat from the Jack-o'-Lantern that leaves the Sheriff on 2 orbs.

## Not numbered

- Raise never returns a Jack-o'-Lantern: it is a Fiend.
- The rulebook says "If both troops fall, it does nothing." In `rules.js` a fight's exchange cannot leave both troops on 0: a defeated target does not hit back. Both fall only when one Last Stand finishes the other troop, and requirement 07 covers that. The rulebook sentence is accurate but describes a case the exchange alone never produces.
- A Jack-o'-Lantern carrying Bone Armor has 3 orbs and survives 1- and 2-attack hits, so its Last Stand fires later or not at all.
