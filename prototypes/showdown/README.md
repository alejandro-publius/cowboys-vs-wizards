# Showdown (prototype)

The fight Alex chose on November 18, 2026 to build the deeper rules on: you choose every attack, your troops shield your Base, and turns alternate. Everything here is separate from the main game in `src/`, which is untouched.

```sh
node prototypes/showdown/build.mjs        # writes dist/showdown.html; open it in a browser
node --test prototypes/showdown/*.test.js
node prototypes/showdown/sim.mjs 1000     # the even match, each deal played from both seats
node prototypes/showdown/trail-sim.mjs    # how often three kinds of player win every duel on the ladder
node prototypes/showdown/export-cards.mjs # rewrites cards.csv after a card change
node prototypes/showdown/export-art.mjs   # rewrites ART-DIRECTION.md after a change to art.js
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
- **Bounties:** the Lantern Wraith and the Graveyard Dragon. Beat one five times and its Legendary card is yours.
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
| Graveyard Dragon, hunts 1 to 5 | 28% to 4% | 58% to 9% | 86% to 49% |
| Open range (the even match) | 10% | 14% | 65% |

A test holds the shape: a sure win twice, a careful player winning most of every Trail duel and of the first three rivals, the last rival as the wall, and each bounty ending harder than it starts.

**The even match** over 2,000 bot games with the two starter decks: the first player won 57.5%, the Cowboys won 59.3%, and a game took 13.4 turns on average and 27 at most. That is tilted toward the Cowboys and toward the first seat; it has not been retuned since cover was added.

These are all bot numbers. No person has played these rules.

## Known gaps

- The simple player model falls off sharply at the first rival and the last one. Real players may find the same wall.
- Two players means one screen. There is no play over a network: that needs a server.
- The side deck is only used against the Wizards; two-player games use the starter decks.
- Which trap springs and which Undead returns are fixed by order, not chosen.
- The bot can see the top of its own deck when it plays a Scout.
- Card names, keyword wording, duel names and reward order are first drafts.
- Nothing here is in the main game yet. Its deck builder, bounties and rivals still run on the lane duel.
