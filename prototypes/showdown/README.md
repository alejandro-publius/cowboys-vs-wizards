# Showdown (prototype)

The fight Alex chose on November 18, 2026 to build the deeper rules on: you choose every attack, your troops shield your Base, and turns alternate. Its engine now lives in `src/game/showdown/`; `rules.js`, `cards.js` and `contract.js` here re-export it. The Trail, progress, save codes and this page's screens are still only here, and the main graybox opens Showdown's first duel.

```sh
node prototypes/showdown/build.mjs        # writes dist/showdown.html; open it in a browser
node --test prototypes/showdown/*.test.js
node prototypes/showdown/sim.mjs 1000     # the even match, each deal played from both seats
node prototypes/showdown/trail-sim.mjs    # how often three kinds of player win every duel on the ladder
node prototypes/showdown/export-cards.mjs # rewrites cards.csv after a card change
node prototypes/showdown/export-art.mjs   # rewrites ART-DIRECTION.md after a change to art.js
```
Six checks drive the built page in headless Chrome (fresh profile, no network) and exit 1 on any failure. Each needs `build.mjs` first; set `CHROME` if Chrome is not in `/Applications`.
```sh
node prototypes/showdown/access-browser-check.mjs     # keyboard and phone path through a first win and its card offer
node prototypes/showdown/onboarding-browser-check.mjs # a first session: Start here, the opening turn, cover, back to Camp
node prototypes/showdown/hotseat-browser-check.mjs    # two players: the curtain, focus and hidden hands at each handoff
node prototypes/showdown/savecode-browser-check.mjs   # save code: preview, Replace or Cancel, and blocked storage
node prototypes/showdown/bo3-browser-check.mjs        # best of three, solo with the side deck and two players
node prototypes/showdown/campaign-browser-check.mjs   # Trail, a rival, packs and a bounty, each move checked against rules.js
```

The full rules are in [RULEBOOK.md](RULEBOOK.md). Every card is in [cards.csv](cards.csv). The look of every card and place, written for an image generator, is in [ART-DIRECTION.md](ART-DIRECTION.md).

To test it on people, follow [PLAYTEST.md](PLAYTEST.md). To build it into the game, Kiro follows [the integration brief](../../docs/design/showdown-integration-kiro-brief.md); `contract.js` is what a screen may see and must show.

## What is in it

**Rules**

- Five card kinds: troops, spells, traps, gear and locations. 29 cards, 15 Cowboy and 14 Wizard. Eleven are new here.
- Eight keywords with one fixed meaning each: Guard, Quickdraw, Ride, Scout, Raise, Sweep, Last Stand, Ghostly. One status: Stunned.
- A type on every troop (Lawman, Outlaw, Rig, Beast, Undead, Mage, Fiend). Raise and both locations read it.
- Two stances: a troop attacks, or takes cover to keep damage off the Base at the price of not hitting back.
- The graveyard as a resource, card draw, a hand limit, and an empty deck that costs the Base an orb a turn.
- Rarity: Basic, Common, Uncommon, Rare, Legendary, each with a copy limit per deck.

**A player's first hours**

- **The Trail:** six duels that start as a sure win and get harder one step at a time. Each first win pays a new card.
- **A choice after every win:** two cards are offered and you keep one.
- **Rivals:** four, met in order, bridging to the even match. They pay packs and the first gear and location.
- **Bounties:** the Lantern Wraith and the Graveyard Dragon. Beat one five times and its Legendary card is yours. The Wraith stands on the board from the start; the Dragon lands on the Wizards' second turn.
- **Packs:** three cards, won and never bought.
- **A softer rematch:** a loss gives your Base one more orb next time, twice at most.

**Around the duel**

- A deck builder with a four-card side deck.
- Best of three, with side-deck swaps between games.
- Two players on one screen, single game or best of three.
- Progress saved in the browser, with a code to copy it elsewhere.

## The ladder, measured

How often a bot player wins each duel on the first try, 300 deals each, November 18 (`trail-sim.mjs`). "Careless" takes any legal action, "simple" takes the best single action, "careful" plans the whole turn. A person should land between simple and careful. The player's deck is the one the Trail builds, with no cards from offers or packs.

| Duel | Careless | Simple | Careful |
| --- | --- | --- | --- |
| Trail 1. Boot Hill | 99% | 100% | 100% |
| Trail 2. Raven Roost | 100% | 99% | 100% |
| Trail 3. The Bone Fence | 69% | 88% | 100% |
| Trail 4. Imp Hollow | 41% | 85% | 89% |
| Trail 5. The Hexed Mile | 20% | 60% | 95% |
| Trail 6. Dragon's Roost | 19% | 41% | 78% |
| Rival 1. The Stargazer | 22% | 33% | 90% |
| Rival 2. The Imp | 30% | 56% | 88% |
| Rival 3. The Bonewright | 11% | 37% | 91% |
| Rival 4. The Graveyard Coven | 8% | 12% | 56% |
| Lantern Wraith, hunts 1 to 5 | 89% to 15% | 91% to 38% | 97% to 62% |
| Graveyard Dragon, hunts 1 to 5 | 51% to 6% | 60% to 20% | 95% to 55% |
| Open range (the even match) | 10% | 14% | 65% |

A test holds the shape: a sure win twice, a careful player winning most of every Trail duel and of the first three rivals, the last rival as the wall, and each bounty ending harder than it starts.

**The even match** over 2,000 bot games with the two starter decks: the first player won 57.5%, the Cowboys won 59.3%, and a game took 13.4 turns on average and 27 at most. That is tilted toward the Cowboys and toward the first seat; it has not been retuned since cover was added.

**November 20 changes** (Fable's even-fight brief, `docs/design/showdown-even-fight-kiro-brief.md` at commit `f079fdc`). The even match (Open range, best of three, two players) now deals these decks; the side going second starts with 7 Base orbs and keeps its extra card. Trail, rival and bounty duels keep their own decks and Base orbs. A troop in cover cannot be hit by spells (RULEBOOK sections 6 and 10). The two tables above were measured before these changes; the trail-sim run after them is in [the worker's evidence note](../../docs/evidence/kiro-even-rules.md).

| Even-match deck | Cards |
| --- | --- |
| Cowboy | 4 Sheriff, 2 Outrider, 2 Covered Wagon, 2 Billy, 1 Ranger, 1 Dynamiter, 1 Mounted Billy, 1 Deadeye, 1 Lasso, 1 Bear Trap |
| Wizard | 3 Skeleton, 1 Jack-o'-Lantern, 1 Raven Familiar, 2 Imp, 2 Bone Wall, 2 Wizard, 1 Headless Horseman, 1 Dragon, 1 Singularity, 1 Hellfire, 1 Hex |

These are all bot numbers. No person has played these rules.

## Reviewed by two fresh agents, November 18

Neither had seen the code being written. One checked the rules against the rulebook and fuzzed 2,590 games; it found the fight engine clean and eleven defects around it, all fixed and tested since. Among them: a card offer could be lost by starting another duel, gear and locations could arrive before the rival that teaches them, the view meant to hide cards carried the deal's seed, a finished two-player game showed the other hand, and the Dragon almost never appeared in its own bounty. The other played three duels knowing only what the screen showed; its notes led to the plain-words cost lines, the reasons on greyed cards and the reward confirmation.

## Known gaps

- The simple player model falls off sharply at the first rival and the last one. Real players may find the same wall.
- Two players means one screen. There is no play over a network: that needs a server.
- The side deck is only used against the Wizards; two-player games use the starter decks.
- Which trap springs and which Undead returns are fixed by order, not chosen.
- A save code is checked for agreement between its parts, not for how it was earned. It is a local save, not a ledger.
- "Restart this duel" replays the same deal, so a player can look at the Wizards' plays and start again.
- The bot can take most of a second to plan a turn on a full board; the page pauses for that long.
- The bot can see the top of its own deck when it plays a Scout.
- Alex approved the eleven new card names on November 18. Keyword wording, duel names, reward order and the frame looks are still first drafts.
- Nothing here is in the main game yet. Its deck builder, bounties and rivals still run on the lane duel.
