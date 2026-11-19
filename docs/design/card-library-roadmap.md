# Card library: every playable card, and the route to about 34

Fable 5.2, November 18, 2026, Pacific. Built from the graybox at `e779c6f`.

Three kinds of entry, kept apart on purpose:

- **In the game today:** 11 cards, stats read from the shipped catalog.
- **Pack 1, specified and bot-tested:** 6 Cowboy cards. Exact stats and acceptance cases are in `content-pack-1-kiro-brief.md`.
- **Concepts:** 17 names that fill the roster to 34. Each has a source, a job and the rule it would need. None has final stats and none has been tested.

## How big, and why

The target is 34 cards, 17 a side. The size comes from one observation about Clash Royale's first release: it opened with 42 cards, each a troop, a spell or a building, with eight to a deck and four in hand. That is a set small enough to learn. Nothing else is borrowed from it. No card here copies one of its cards or roles.

Every card is taken from Western or wizard material, and its job comes from this game: three lanes, a clash both sides resolve at once, tributes that cost board presence, and one to five orbs per troop.

## What a card can be today

- **Troop:** stars, orbs and attack. Stars set the cost: 1 to 4 free, 5 or 6 one tribute, 7 or more two tributes.
- **Spell:** removes one orb from an enemy troop. One flag lets it move the survivor one lane.
- **Bounty card:** a one-copy reward or boss.
- **Built but not in standard duels:** Ride Out (hunts), traps (the trap prototype), cover swap (an experiment).

**Rules for every pack.**

1. At most one new effect per pack.
2. A new troop takes a stat line that measured close to the card it competes with, or it gets a copy limit.
3. Nothing outclasses a bounty reward.
4. The first-session seeds, the starter deck and its card order never move.

**Where the fair stat lines are.** One copy swapped into the starter, seeds 70000–70399, Normal and Hard bots, change in Cowboy win share:

| Tier | About even | Clearly weak | Clearly strong |
| --- | --- | --- | --- |
| Free (replacing a Sheriff, 3 orbs / 1 attack) | 2 / 2, 4 / 1 (+4, +1) | 1 / 2 (−17, −19), 2 / 1 (−4, −6), 1 / 3 (−5, −7) | 5 / 1 (+12, +3), 3 / 2 (+17, +15), 2 / 3 (+23, +20) |
| One tribute (replacing a Billy, 4 / 2) | none besides Billy's own line | 3 / 2 (−5, −4), 5 / 1 (−7, −5), 2 / 3 (−7, −4) | 5 / 2 (+10, +11), 2 / 4 (+8, +7), 3 / 3 (+15, +13) |
| Two tributes (replacing Mounted Billy, 5 / 3) | most lines with 3 or more orbs | 2 / 4 (−11, −6) | 5 / 4 (+8, +4), 5 / 5 (+14, +6) |

Orbs matter far more than attack on free troops. Two-tribute cards barely move the result because the bots seldom get to play them.

## In the game today (11)

| Side | Card | Kind | Cost | Orbs | Attack | Copies | Job |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cowboy | Sheriff | troop | free | 3 | 1 | up to 6, starter 6 | Holds a lane or pressures an open one |
| Cowboy | Billy | troop | one tribute | 4 | 2 | up to 6, starter 3 | Turns one troop into a sturdier one |
| Cowboy | Mounted Billy | troop | two tributes | 5 | 3 | up to 6, starter 1 | Finisher. Pack 1 adds Ride |
| Cowboy | Deadeye | spell | | | | up to 6, starter 2 | Removes one orb from an enemy troop |
| Cowboy | Captured Dragon | troop, bounty | one tribute | 2 | 3 | 1 | Glass cannon. Five Dragon hunts |
| Cowboy | Captured Wraith | troop, bounty | free | 2 | 2 | 1 | Free pressure. Five Wraith hunts |
| Wizard | Skeleton | troop | free | 3 | 1 | starter 6 | The Wizard's Sheriff |
| Wizard | Wizard | troop | one tribute | 4 | 2 | starter 3 | The Wizard's Billy |
| Wizard | Dragon | troop | two tributes | 5 | 3 | starter 1 | Finisher, and the first Wanted boss |
| Wizard | Singularity | spell | | | | starter 2 | Removes one orb and may move the survivor |
| Wizard | Lantern Wraith | troop, boss | | 4 | 2 | hunts only | Drifts one lane before the first clash |

## Pack 1, "Frontier" (6 Cowboy cards)

| Card | Cost | Orbs | Attack | Limit | Effect | From | Job |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Covered Wagon | free | 4 | 1 | 2 | | Wagon trains, and wagons drawn up as cover | Wall. Survives a Dragon's hit |
| Outrider | free | 3 | 1 | 2 | Ride | The mounted scout ahead of the posse | A Sheriff that changes lanes |
| Dynamiter | free | 1 | 3 | 2 | | Blasting crews of the mines and railroads | Burst through an open lane |
| Ranger | one tribute | 4 | 2 | 2 | Ride | The mounted lawman | A Billy that changes lanes |
| Gatling Crew | two tributes | 4 | 4 | 1 | | The crank gun and its crew | Clears any blocker but the Dragon |
| Lasso | spell | | | 2 | relocates | The cowboy's rope | Removes one orb and may drag the survivor |

After pack 1 the Cowboys have 12 cards and the Wizards 5.

## Concepts to reach 34 (17, untested)

No final stats. "Cell" names the measured stat line a concept would start from.

**Wizards (12).** The first six need no new rule and would give the Wizard CPU its first new decks.

| Card | From | Job | Needs |
| --- | --- | --- | --- |
| Familiar | The wizard's animal companion | Free pressure | Stats only: free 2 / 2 cell |
| Gargoyle | The stone guardian on the tower | Wall | Stats only: free 4 / 1 cell |
| Imp | The summoned minor devil | Burst, mirror of Dynamiter | Stats only: free 1 / 3 cell |
| Hex | Jinxes and hexes | Plain removal, mirror of Deadeye | Existing spell without the move |
| Bone Golem | Animating the inanimate | Lane-clearing finisher | Stats only: two-tribute 4 / 4 cell |
| Cursed Gunman | The zombie gunfighter of weird Westerns | Glass cannon | Stats only: one-tribute 2 / 3 cell |
| Broom Witch | The witch's broomstick | A rider for the Wizards | Ride, already in pack 1 |
| Headless Horseman | The ghost rider | Mounted finisher, mirror of Mounted Billy | Ride |
| Necromancer | Raising the dead | Keeps the Skeleton line coming back | New effect: raise |
| Polymorph | Shape-changing magic | Shrinks a big troop | New effect: transform |
| Banshee | The wailing spirit | Wounds the troop across from it on arrival | New effect: on-summon damage |
| Lich | The undead archmage | Third Wanted boss | Boss rule of its own, like the Wraith's drift |

**Cowboys (5).**

| Card | From | Job | Needs |
| --- | --- | --- | --- |
| Sawbones | The frontier doctor | Restores one orb to a friendly troop | New effect: heal, the mirror of Deadeye |
| Undertaker | The town undertaker | Softens the cost of a tribute | New effect: tributed troop returns to hand |
| Quick-Draw Kid | The high-noon duel | Wins a lane it would otherwise trade | New effect: strikes first |
| Bear Trap | The trapper's steel trap | Cancels the biggest attacker for a clash | The trap prototype's rules |
| Captured Lich | Third bounty | Reward for the third boss | Decided with that boss |

**Suggested order.** Each pack still adds at most one effect.

| Pack | Cards | New effect | Running total |
| --- | --- | --- | --- |
| Today | 11 | | 11 |
| 1, Frontier | 6 Cowboy | Ride | 17 |
| 2, The Tower | Familiar, Gargoyle, Imp, Hex, Bone Golem, Cursed Gunman | none | 23 |
| 3, Night Ride | Broom Witch, Headless Horseman, Sawbones, Bear Trap | heal, and traps in standard duels | 27 |
| 4, The Graveyard | Necromancer, Lich, Captured Lich, Undertaker | raise, tribute return, a boss rule | 31 |
| 5, High Noon | Quick-Draw Kid, Banshee, Polymorph | strikes first, on-summon damage, transform | 34 |

Packs 3 to 5 as listed each carry more than one new rule. Each would have to be cut to one, or split, before it gets a brief. The order of concepts is a sketch, and only packs 1 and 2 fit the one-effect rule as written.

## Where the names come from

- **Western.** Wikipedia's Western article lists the stock figures: cowboys, drifters, gunslingers, sheriffs and marshals, outlaws and rustlers, bounty hunters, gamblers, bartenders, and "soldiers, especially mounted cavalry". It also names wagon trains and covered wagons used for cover, saloons, railways and the quick-draw duel. No Film School's list of Western tropes adds the posse chase, the high-noon standoff, bounty hunters, stagecoaches, the hanging tree and the railroad.
- **Weird West.** Wikipedia's Weird West article supplies the haunted side: undead and zombie gunfighters, vampires, werewolves in a mining town, magic revolvers and curses.
- **Wizards.** Wikipedia's article on magicians in fantasy lists the tools (staff, wand, familiar, grimoire, crystal ball, tower) and the kinds of magic (summoning, animating objects, transformation, illusion, charm, divination, jinxes and hexes).
- **Not in the pages I read.** The lasso, dynamite, the Gatling gun, the frontier doctor, the undertaker, the bear trap, gargoyles, imps, golems, liches, banshees and the Headless Horseman are common in the two genres, but I did not check them against a source. Treat those attributions as mine.

Sources:

- [Clash Royale, Wikipedia](https://en.wikipedia.org/wiki/Clash_Royale)
- [Western (genre), Wikipedia](https://en.wikipedia.org/wiki/Western_(genre))
- [15 Western Movie Tropes, No Film School](https://nofilmschool.com/western-movie-tropes-defined)
- [Weird West, Wikipedia](https://en.wikipedia.org/wiki/Weird_West)
- [Magician (fantasy), Wikipedia](https://en.wikipedia.org/wiki/Magician_(fantasy))
