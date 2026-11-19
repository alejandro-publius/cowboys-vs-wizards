# Card types you can tell apart, and bounties as a pipeline

Fable 5.2, November 18, 2026, Pacific. Direction from Alex that evening. This page is a rule and a proposal. No art was made, and no code under `src/` changed.

## The rule: the frame says the type

A player must be able to tell what kind of card they are looking at before reading it, whatever the art shows. The same is true of Yu-Gi-Oh's monster, spell and trap frames.

1. **The frame carries the category.** Troop, Spell, Trap and Boss each have their own border.
2. **The body carries the faction.** Cowboy and Wizard are a colour inside the frame, never the frame itself.
3. **Never colour alone.** Each category also has a border style, a corner mark and a type line in words, so it reads in grayscale and for colour-blind players.
4. **Same place on every card.** The corner mark sits top left and the type line sits under the name.
5. **Art stays inside the frame.** No illustration or model may cover the border, the mark or the type line.
6. **The frame follows the card.** A troop on the board keeps its border and mark.

The categories and their frames are in [card-types.csv](../card-types.csv). Every card's category is a column in [cards.csv](../cards.csv).

**Bosses are their own category.** A boss has two states with one frame family: **Wanted** while you hunt it, and **Captured** once its card is yours. A Captured boss plays as a troop but keeps the boss frame, so a deck shows at a glance which cards were earned.

The colours and exact shapes are a proposal. They are Alex's to approve before anything is drawn.

## In the graybox

Built on November 18: hand cards, board tiles and the deck builder show the type line, the corner mark and the border style, and each Wanted poster carries the boss type line. A hunt's target shows the Wanted frame. The frame data is `src/ui/card-frames.js`, and both spreadsheets are generated from it.

Still to do:

- The illustrated 3D build is unchanged.
- No person has checked that the categories read at a glance.

## Bounties as a pipeline

**The idea.** Bosses are unique cards called bounties. You face a bounty five times. Clearing all five earns that boss's own card for your deck. Kiro and Tripo produce new bounties as a repeatable system: the encounters, the reward card and the 3D asset.

**What already exists.**

- The loop itself: two bosses, five hunts each, and a Captured card for each.
- Kiro's `bounty-designer` agent, which drafts a boss package under `tasks/bounties/`: the boss, five hunts, the reward and briefs for a portrait and a model.
- A hunt solver in the tests that proves each hunt can be won and finds its winning lines.
- Tripo's tool connection in the Kiro workspace settings.

**What is missing to call it a pipeline.**

| Step | Missing piece |
| --- | --- |
| Idea to package | One command that takes a one-line boss idea and writes the package |
| Package to playable | A checker that loads the package, runs the solver on all five hunts, and rejects a boss with an unwinnable hunt or two hunts that share a solution |
| Reward balance | The paired-seed run for the reward card against the card it replaces, as the Captured Dragon had |
| 3D asset | A Tripo job from the approved model brief, with its source recorded |
| Into the game | The presentation slot, so the model is a data change |

**Done when:** a new bounty goes from one sentence to a playable graybox boss with five solvable hunts and a measured reward, with no hand-written code, and its model is requested only after Alex has played the hunts and approved the brief.

**Gates that stay.** `AGENTS.md` says new art and motion are planned with Alex first. So the pipeline stops before the Tripo job and waits. Tripo jobs also cost credits.

**Depends on the fight.** Hunts are positions in the current lane duel. If the Showdown fight replaces it, the hunts and the solver are rewritten first. The loop, the category and the pipeline shape do not change.

## Other ideas of the same kind

Parked until the fight is chosen. One line each so they are not lost.

- **Rival gunslingers.** Named opponents with one visible habit each, like the Bonewright, earned as a ladder.
- **A posse trait.** Cards that share a name family give a small bonus when they stand together, the way archetypes work.
- **Trap cards as the third type.** The trap prototype already exists; it becomes the game's third frame.
