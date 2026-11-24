# CARD-WIZARD-SINGULARITY requirements

In a Showdown match, Singularity is a targeted Wizard spell: remove 1 orb from one enemy troop that is not Ghostly. It uses the same `shot` effect as the Cowboys' Deadeye. The Card gallery also holds two approved "area Singularity" replays that hit every enemy troop. Those replays are driven by a Hellfire action and do not describe the playable card. Requirements 19 to 22 cover them separately so they cannot be mistaken for the rule.

## Sources

- Card spec: `.kiro/specs/duel-card-pipeline/cards/wizard-singularity.json`
- Generator: `scripts/sync-card-specs.mjs` (`FIELDS.spell`, `showdownRecord`); output `src/game/card-specs.generated.js`
- Tables: `src/game/showdown/cards.js` (`EFFECTS.shot`, `DECKS`)
- Engine: `src/game/showdown/rules.js` (`legalActions` spell branch, `applyAction` spell branch, `defeat`)
- Opponent decks: `src/game/showdown/trail.js`, `src/game/showdown/progress.js`
- Rulebook: `prototypes/showdown/RULEBOOK.md` sections 2 (Spell), 4.3, 9 (Ghostly), 10 ("Ghostly", "Last Stand")
- Log text: `src/game/showdown/presenter.js` (`spell`)
- Replay beats: `src/ui/showdown-3d/event-positions.js` (`spell` case); gallery `src/ui/showdown-3d/attack-preview.js` (`attackPreviews`, `singularityExample`)
- Prior spec: `.kiro/specs/singularity-preview-verification/requirements.md` (SV1–SV4)
- Existing tests: `tests/match/showdown-3d-presentation.test.js` ("ordinary Singularity still shows one targeted vortex"; the three area Singularity tests); `prototypes/showdown/rules.test.js` ("Ghostly troops cannot be targeted by spells, ..." uses Deadeye, which shares `shot`); `tests/game/card-specs.test.js` (extra Singularity registry entry)

## Card data

- **CARD-WIZARD-SINGULARITY-01.** THE catalog SHALL define `wizard-singularity` as a Wizard spell named "Singularity" with rarity `common` and effect `shot`.
- **CARD-WIZARD-SINGULARITY-02.** THE sync script SHALL keep the spec's lane fields `copies: 2` and `relocates: true` in the lane catalog and omit both from the Showdown record.
- **CARD-WIZARD-SINGULARITY-03.** THE Wizard opponent decks SHALL hold Singularity in these counts: even match 1, The Bone Fence 2, Imp Hollow 2, The Hexed Mile 1, Dragon's Roost 1, The Stargazer 3, The Imp 2, The Graveyard Coven 1, Lantern Wraith escort 2, Graveyard Dragon escort 1, and none in Boot Hill, Raven Roost or The Bonewright.

## Casting

- **CARD-WIZARD-SINGULARITY-04.** WHILE the Wizards hold a Singularity, have not used the turn's other-card play, and no Wizard troop has acted this turn, THE engine SHALL offer one Singularity action for each Cowboy troop that is not Ghostly.
- **CARD-WIZARD-SINGULARITY-05.** WHILE every Cowboy troop is Ghostly or the Cowboy board is empty, THE engine SHALL offer no Singularity action.
- **CARD-WIZARD-SINGULARITY-06.** WHILE a Cowboy troop with Guard is on the board, THE engine SHALL still offer every non-Ghostly Cowboy troop as a Singularity target.
- **CARD-WIZARD-SINGULARITY-07.** WHEN a Singularity resolves, THE engine SHALL mark the turn's other-card play as used, so no further spell, gear or location can be played that turn.
- **CARD-WIZARD-SINGULARITY-08.** WHEN a Singularity resolves, THE engine SHALL leave the turn's troop summon and trap set available.

## Resolution

- **CARD-WIZARD-SINGULARITY-09.** WHEN a Singularity resolves, THE engine SHALL move the Singularity from the Wizard hand to the Wizard graveyard and remove exactly 1 orb from the chosen troop.
- **CARD-WIZARD-SINGULARITY-10.** WHEN a Singularity takes the target's last orb, THE engine SHALL move that troop and its gear to the Cowboy graveyard.
- **CARD-WIZARD-SINGULARITY-11.** WHEN a Singularity resolves, THE engine SHALL move no troop between slots, because `relocates` is a lane-only field.
- **CARD-WIZARD-SINGULARITY-12.** WHEN a Singularity resolves, THE engine SHALL change neither Base.
- **CARD-WIZARD-SINGULARITY-13.** WHEN a Singularity resolves, THE engine SHALL spring no Cowboy trap, because traps spring only on attacks.
- **CARD-WIZARD-SINGULARITY-14.** WHEN a Singularity defeats a troop with Last Stand, THE engine SHALL not fire that Last Stand.
- **CARD-WIZARD-SINGULARITY-15.** WHEN a Singularity targets a troop in cover, THE engine SHALL still remove the orb.

## Visible results

- **CARD-WIZARD-SINGULARITY-16.** WHEN a Singularity resolves, THE log SHALL read "The Wizards' Singularity hit <name>: <n> orb(s) left." with "orb" for 1 and "orbs" otherwise, or "The Wizards' Singularity hit <name>: defeated." at 0.
- **CARD-WIZARD-SINGULARITY-17.** WHEN the illustrated replay builds an ordinary Singularity cast, THE replay SHALL produce a `play` beat, then one `vortex` beat targeting only the chosen slot, then one `burial` beat for each card that goes to a graveyard.
- **CARD-WIZARD-SINGULARITY-18.** WHILE a Wizard troop (`wizard-wizard`) is on the caster's board, THE replay SHALL start the `vortex` beat from that troop's slot.

## Card gallery replays (not the playable rule)

- **CARD-WIZARD-SINGULARITY-19.** WHEN the Card gallery lists previews for Singularity, THE gallery SHALL offer "Against three Sheriffs" and "Against Skeleton and Dragon".
- **CARD-WIZARD-SINGULARITY-20.** WHEN either Singularity gallery replay is built, THE gallery SHALL apply a legal Hellfire action and relabel its events as `wizard-singularity-71` with `areaVortex: true`, so every occupied enemy slot loses 1 orb in one `area-vortex` beat.
- **CARD-WIZARD-SINGULARITY-21.** WHEN the "Against three Sheriffs" replay ends, THE gallery SHALL show three Cowboy Sheriffs on 2 orbs each and the summary "Each Sheriff loses one orb."
- **CARD-WIZARD-SINGULARITY-22.** WHEN the "Against Skeleton and Dragon" replay ends, THE gallery SHALL show the 1-orb Wizard Skeleton in the Wizard graveyard, the Dragon on 4 orbs, and the summary "Skeleton is defeated. The Graveyard Dragon loses one orb and holds its ground."

## Not numbered (known gaps)

- The gallery replays in 19 to 22 show an area effect that the playable Singularity does not have. In the "Against Skeleton and Dragon" replay the caster is a Wizard troop seated on the Cowboy side and the spell hits Wizard troops. `singularity-preview-verification` records the replay as approved. Whether the gallery should keep showing a proposed area version, or the card should change, is a Fable decision. No requirement here settles it.
- `docs/cards.csv` and `docs/card-library.md` describe a lane-era Singularity that can move a survivor one lane. Showdown has no lanes and does not do this.
