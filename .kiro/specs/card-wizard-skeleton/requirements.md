# CARD-WIZARD-SKELETON requirements

The Skeleton is the Wizards' free basic troop. It has no keyword. It matters to other cards because it is Undead: Raise returns it and the Boneyard strengthens it.

## Sources

- Card spec: `.kiro/specs/duel-card-pipeline/cards/wizard-skeleton.json`
- Generator: `scripts/sync-card-specs.mjs`; output `src/game/card-specs.generated.js`
- Tables: `src/game/showdown/cards.js` (`RARITY.basic`, `tributes`, `DECKS`)
- Engine: `src/game/showdown/rules.js` (`arrive`, `canAttack`, `attackOf`, `attackOutcome`, `applyAction` summon branch)
- Opponent decks: `src/game/showdown/trail.js`, `src/game/showdown/progress.js`
- Rulebook: `prototypes/showdown/RULEBOOK.md` sections 2, 5, 10 ("Raise and tributes")
- Gallery: `src/ui/showdown-3d/attack-preview.js`; beat timing `src/ui/showdown-3d/event-positions.js` (`attackTimings["wizard-skeleton"]`)
- Existing tests: `prototypes/showdown/rules.test.js` ("Raise returns ...", "locations: ...", "a Base can be struck directly only when its side has no troops", "damage beyond the target's last orb hits its Base, ..."), `tests/match/showdown-3d-presentation.test.js`

## Card data

- **CARD-WIZARD-SKELETON-01.** THE catalog SHALL define `wizard-skeleton` as a Wizard troop named "Skeleton" with 1 star, 1 attack, 3 orbs, rarity `basic`, type tag `Undead` and no keywords.
- **CARD-WIZARD-SKELETON-02.** THE sync script SHALL keep the spec's `copies: 6` in the lane catalog and omit it from the Showdown record.
- **CARD-WIZARD-SKELETON-03.** THE Wizard opponent decks SHALL hold Skeletons in these counts: even match 4, Boot Hill 16, Raven Roost 9, The Bone Fence 8, Imp Hollow 6, The Hexed Mile 6, Dragon's Roost 4, The Stargazer 4, The Imp 4, The Bonewright 5, The Graveyard Coven 3, Lantern Wraith escort 6, Graveyard Dragon escort 9.

## Play

- **CARD-WIZARD-SKELETON-04.** WHEN the Wizards summon a Skeleton, THE engine SHALL require no tribute.
- **CARD-WIZARD-SKELETON-05.** WHEN a Skeleton arrives from the hand, THE engine SHALL leave it unable to attack that turn.
- **CARD-WIZARD-SKELETON-06.** WHEN a Cowboy troop attacks a full Skeleton out of cover and the Skeleton survives, THE engine SHALL hit the attacker back for 1.
- **CARD-WIZARD-SKELETON-07.** WHILE the Boneyard is the table's location, THE engine SHALL compute a Skeleton's attack as 2.
- **CARD-WIZARD-SKELETON-08.** WHEN a Skeleton is paid as a tribute for a Wizard troop with Raise, THE engine SHALL return that Skeleton with 1 orb, unless the board is full.
- **CARD-WIZARD-SKELETON-09.** WHEN a Skeleton returns through Raise, THE engine SHALL leave it unable to attack that turn.

## Card gallery

- **CARD-WIZARD-SKELETON-10.** WHEN the Card gallery lists previews for Skeleton, THE gallery SHALL offer one preview, "Watch attack", which applies a real Skeleton attack on a Cowboy Sheriff.

## Not numbered

- The Skeleton is used as the default enemy in many gallery previews of Cowboy cards. Those previews belong to the Cowboy cards' specs.
