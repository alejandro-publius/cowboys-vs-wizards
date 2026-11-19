# Showdown rules (prototype)

The fight Alex chose on November 18, 2026 to build the deeper rules on: you choose every attack, your troops shield your Base, and turns alternate. It replaces the lane clash in this prototype only. The main game in `src/` is untouched.

```sh
node prototypes/showdown/build.mjs        # writes dist/showdown.html; open it in a browser
node --test prototypes/showdown/rules.test.js
node prototypes/showdown/sim.mjs 1000     # bot games, each deal played from both seats
node prototypes/showdown/trail-sim.mjs    # how often three kinds of player win each Trail duel
node prototypes/showdown/export-cards.mjs # rewrites cards.csv after a card change
```

## Rules

1. Draw a card. Then play: up to one troop, one spell and one trap a turn. Then attack once with each troop. Once you attack, you cannot play more cards that turn.
2. Troops cost tributes as in the main game: 1 to 4 stars are free, 5 and 6 cost one of your troops, 7 and up cost two.
3. An attack hits the enemy troop you choose. Damage beyond its last orb hits its owner's Base. A troop that survives hits back.
4. A Base can be struck directly only when its side has no troops.
5. A free troop rests on the turn it arrives. A troop paid for with a tribute can attack at once. Nobody attacks on the opening turn.
6. A trap is set face down and springs on the next enemy attack, one trap per attack. Each side holds two at most.
7. Whoever goes second starts with one more card.
8. An empty deck costs your Base an orb each turn you would draw. A seventh card in hand is discarded.
9. A Base with no orbs loses.

## What is in it

- **Eight keywords**, each with one fixed meaning: Guard, Quickdraw, Ride, Scout, Raise, Sweep, Last Stand and Ghostly.
- **Type tags** on every troop: Lawman, Outlaw, Rig, Beast, Undead, Mage and Fiend. Raise is the first rule that reads a tag.
- **Three card kinds:** troops, spells and traps. One status, Stunned.
- **The graveyard as a resource:** the Wizard brings an Undead troop back.
- **25 cards**, 13 Cowboy and 12 Wizard, in [cards.csv](cards.csv). Seven are new here: Bear Trap, Bone Wall, Raven Familiar, Headless Horseman, Jack-o'-Lantern, Hellfire and Hex.

## The Trail: a new player's first six duels

A first hour is not an even match. The Trail opens with two duels a player cannot really lose, then gets harder one step at a time, and every first win pays a new card that goes straight into the deck. The even match waits until the Trail is done.

- You start with three card names and no keywords: Sheriff, Billy and Deadeye.
- Each duel shows one new thing on the Wizard side, in one sentence above the board.
- A win pays one or two new cards and shows what they do. Six wins earn eight new cards and every Cowboy keyword.
- A loss gives the rematch one more Base orb, twice at most.
- Only the keywords in the current duel are listed on screen.

How often a bot player wins each duel on the first try, 400 deals each on November 18 (`node prototypes/showdown/trail-sim.mjs`). "Careless" takes any legal action, "simple" takes the best single action, "careful" plans the whole turn. A person should land between simple and careful.

| Duel | Shows | Pays | Careless | Simple | Careful |
| --- | --- | --- | --- | --- | --- |
| 1. Boot Hill | Attacking | Covered Wagon ×2 (Guard) | 100% | 100% | 100% |
| 2. Raven Roost | Enemy keywords | Outrider ×2 (Ride) | 100% | 100% | 100% |
| 3. The Bone Fence | Guard, Raise | Ranger (Scout), Lasso | 68% | 86% | 100% |
| 4. Imp Hollow | Quickdraw | Dynamiter (Last Stand), Bear Trap | 43% | 85% | 89% |
| 5. The Hexed Mile | Traps | Mounted Billy (Ride) | 31% | 65% | 97% |
| 6. Dragon's Roost | The whole coven | Gatling Crew (Sweep) | 19% | 34% | 75% |
| Open range | The even match | | 10% | 9% | 60% |

The step from Dragon's Roost to the even match is still steep for a simple player. More duels belong between them.

## Bot results for the even match

2,000 games on November 18 (1,000 deals, each played from both seats, two 16-card starter decks): the first player won 55.7%, the Cowboys won 54.7%, and a game took 12.6 turns on average and 25 at most. Without the extra card for the second player, the first player won 62.5%.

These are bot numbers. No person has played these rules yet.

## Not built

- Gear and Location cards, and any effect a player aims at their own troops.
- A choice of which trap springs, or of which Undead returns.
- Deck building, bounties and rivals: those live in the lane duel and have not been moved over. Trail progress is saved in the browser only.
- A choice of reward, rarity, packs, or anything earned after the Trail.
- The bot can see the top of its own deck when it plays a Scout.
