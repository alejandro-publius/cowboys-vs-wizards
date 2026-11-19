# Cowboys vs. Wizards card library

This covers the local Frontier graybox. Each row is a distinct card type. It has **12 collectible Cowboy types**, **4 Wizard deck types used by the CPU**, and **1 additional Wizard boss**. The [generated catalog](../src/game/card-specs.generated.js) supplies the stats. The [deck builder](../src/game/deck-builder.js) defines collection access and copy limits.

## Cowboy collection

| Card | Stars | Attack / orbs | Tribute | Access and deck role |
| --- | ---: | ---: | ---: | --- |
| Sheriff | 2 | 1 / 3 | 0 | Starter. Cheap blocker that can pressure an open lane. Every Cowboy deck needs at least one. |
| Billy | 5 | 2 / 4 | 1 | Starter. Turns one friendly troop into a sturdier lane threat. |
| Mounted Billy | 7 | 3 / 5 | 2 | Starter. Concentrates the value of two troops into one lane. Has Ride. |
| Deadeye | Spell | — | — | Starter. Removes one orb from an enemy troop. A useful way to finish a wounded blocker. |
| Captured Dragon | 5 | 4 / 2 | 1 | Clear all five distinct Graveyard Dragon hunts. Hits hard and can fall quickly. Limit one. |
| Captured Wraith | 3 | 2 / 2 | 0 | Clear all five distinct Lantern Wraith hunts. Starts pressure faster than Sheriff, with fewer orbs. Limit one. |
| Lasso | Spell | — | — | 2 counted duel wins. Remove one orb, then optionally pull the survivor into an adjacent empty lane. Limit two. |
| Covered Wagon | 4 | 1 / 4 | 0 | 3 counted duel wins. Survives a Dragon attack on one orb. Limit two. |
| Outrider | 3 | 1 / 3 | 0 | 4 counted duel wins. Free troop with Ride. Limit two. |
| Dynamiter | 3 | 3 / 1 | 0 | 5 counted duel wins. Can take three Base orbs through an open lane. Limit two. |
| Ranger | 5 | 2 / 4 | 1 | 6 counted duel wins. Holds a lane and can Ride into an empty neighbor. Limit two. |
| Gatling Crew | 7 | 4 / 4 | 2 | 7 counted duel wins. Can defeat a full-orb Wizard in one clash. Limit one. |

Ride moves an eligible troop into an adjacent empty friendly lane and spends the turn’s summon. It comes before a spell. In hunts and opt-in Ride Out, every troop can move under the original rules.

## Wizard opponents

| Card | Stars | Attack / orbs | Tribute | Role |
| --- | ---: | ---: | ---: | --- |
| Skeleton | 1 | 1 / 3 | 0 | Cheap blocker and opening threat. |
| Wizard | 5 | 2 / 4 | 1 | Sturdier single-lane combatant. |
| Dragon | 8 | 3 / 5 | 2 | Heavy finisher. Also appears as the Graveyard Dragon bounty target. |
| Singularity | Spell | — | — | Removes one orb from an enemy troop and can move a survivor to a legal empty lane. |
| Lantern Wraith | 6 | 2 / 4 | 1 | Boss encounter only. The hunt telegraphs a first-clash drift, which a blocked destination prevents. |

## Existing 12-card Cowboy decks

| Deck | Exact counts | Availability |
| --- | --- | --- |
| Starter | 6 Sheriff, 3 Billy, 1 Mounted Billy, 2 Deadeye | Starting deck |
| Deadeye Control | 6 Sheriff, 3 Billy, 3 Deadeye | Load in Build Deck |
| Billy Posse | 6 Sheriff, 4 Billy, 2 Deadeye | Load in Build Deck |
| Dragon Posse | 6 Sheriff, 2 Billy, 3 Deadeye, 1 Captured Dragon | After the Dragon unlock |
| Wraith Posse | 5 Sheriff, 3 Billy, 1 Mounted Billy, 1 Captured Wraith, 2 Deadeye | After the Wraith unlock |
| Wagon Train | 3 Sheriff, 2 Covered Wagon, 2 Billy, 1 Gatling Crew, 2 Deadeye, 2 Lasso | 7 counted duel wins |
| Night Riders | 3 Sheriff, 2 Outrider, 2 Dynamiter, 2 Ranger, 2 Deadeye, 1 Lasso | 6 counted duel wins |

## References for Fable’s expansion

Use the historical and folklore material to find fresh tactical roles for the game's original haunted Western setting. The gameplay hooks below are questions for Fable to test.

| Reference | Design question |
| --- | --- |
| Trail bosses, wranglers, cooks, and vaquero ranch traditions. [NPS trail drives](https://home.nps.gov/grko/learn/historyculture/traildrives.htm) · [NPS cowboy history](https://www.nps.gov/tapr/learn/historyculture/cowboys.htm) | Can a support troop make it worthwhile to keep a weak ally on the board instead of paying it as tribute? |
| Pony Express riders exchanged mounts at relay stations. [NPS stations](https://www.nps.gov/articles/000/pony-express-stations.htm) | Can a cheap rider buy tempo in an open lane while exposing a weakness when blocked? |
| Santa Fe Trail caravans depended on traders, travelers, and crews from different communities. [NPS trail history](https://www.nps.gov/articles/000/beyond-new-mexico-and-missouri.htm) | What slower deck protects a vulnerable lane long enough to turn defense into pressure? |
| Frontier deputies worked out of Fort Smith, including Bass Reeves. [NPS Bass Reeves](https://home.nps.gov/fosm/learn/historyculture/bass_reeves.htm) | Can an original deputy or tracker make catching a wounded enemy worth a deck slot alongside Deadeye? |
| The transcontinental railroad and telegraph connected distant points through coordinated work. [Library of Congress Golden Spike guide](https://guides.loc.gov/chronicling-america-golden-spike) | Could a visible signal make two lanes matter without asking players to learn a separate resource? |
| Mining ghost towns and exaggerated frontier tales supply distinct settings and tones. [NPS Bodie](https://www.nps.gov/places/bodie-historic-district.htm) · [Library of Congress tall tales](https://guides.loc.gov/folktales-oral-storytelling/tall-tales-jokes) | What clear board condition earns a payoff big enough for a tall tale? |
| Prophecies attributed to Merlin and written ceremonial magic give spells a record and a visible warning. [British Library prophecies](https://searcharchives.bl.uk/catalog/032-002031947) · [British Library Sloane MS 3191](https://searcharchives.bl.uk/catalog/040-002115575) | What upcoming effect would make the player change lanes after seeing its tell? |
| Alchemy traditions offer a visual language of transformation. [Getty Art of Alchemy](https://www.getty.edu/projects/art-alchemy/) | What familiar resource could be exchanged in a way that creates a tough choice? |
| Goethe's apprentice animates a broom and loses control of the work it performs. [The Pupil in Magic](https://www.gutenberg.org/cache/epub/1287/pg1287.html) | What cheap magical helper has a drawback the opposing player can exploit? |
| In a tale collected by Arthur Ransome, Vasilissa survives Baba Yaga through the aid of a magic doll. [Old Peter's Russian Tales](https://www.gutenberg.org/files/16981/16981-h/16981-h.htm) | What visible familiar gives a fragile unit a chance to survive one clash? |

Clash Royale’s January 2016 soft-launch pool was **42 types**. Use **about 34 deck-eligible types across both factions** as a long-term working target. The first pack can introduce up to six collectible Cowboy types and two legal 12-card presets with distinct plans and counterplay. Borrow the breadth of tactical jobs from the benchmark. Keep the seeded three-lane game, tribute decisions, and bounty progression as the tests of whether each idea belongs. [Supercell anniversary](https://supercell.com/en/games/clashroyale/blog/news/clash-royales-2nd-birthday/) · [Launch card timeline](https://clashroyale.fandom.com/wiki/Cards) · [Existing launch-deck research](evidence/clash-royale-launch-decks.md)
