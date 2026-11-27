# Devpost image gallery

Upload the first three PNGs in order to follow one boss from the Wanted board into a player's deck. Use the fourth to show the Saloon's separate poker game. Each image is 1200 × 800.

| Upload | Caption | Alt text |
| --- | --- | --- |
| [01-scout-the-graveyard-dragon.png](../media/devpost/01-scout-the-graveyard-dragon.png) | Your Bear Trap is set. Should the Ranger attack the resting Dragon or the Jack-o’-Lantern? Try the turn from the Wanted board before starting the six-stop Trail. | The Ranger aims at the Dragon. The forecast says the Dragon would survive on two life and hit back, leaving the Ranger on one. |
| [02-capture-after-five-hunts.png](../media/devpost/02-capture-after-five-hunts.png) | Win five Dragon hunts and the boss joins your collection. Lasso and Ranger are a separate bonus choice. | Captured Dragon appears under “Earned on hunt five” with a deck-building button. Lasso and Ranger appear under “Choose one bonus card.” |
| [03-captured-dragon-in-deck.png](../media/devpost/03-captured-dragon-in-deck.png) | A boss you fought now fights for you. One Captured Dragon takes a slot in the player's saved 16-card deck. | The deck builder shows one Captured Dragon between Deadeye and Covered Wagon. The footer reads “Deck 16 of 16.” |
| [04-boot-hill-poker.png](../media/devpost/04-boot-hill-poker.png) (optional) | At the Saloon's back table, play five-card draw against the Wizard. Choose which cards to toss or replay the same deal. | An amber terminal shows a ten-high Cowboy hand, five hidden Wizard cards and controls to hold, draw or replay seed 17. |

## How the images were captured

The first three are browser captures of the illustrated Showdown build at [`79c1d0d`](https://github.com/alejandro-publius/cowboys-vs-wizards/commit/79c1d0d40d7575967059fecf9b7ef3551a563e4d). For the first image the runner opened Table A from Wanted, took control on turn five of seed 3, selected the Ranger and hovered the Dragon. This rehearsal grants no career reward.

For the paid hunt, the capture run started with a save code produced by engine wins through the six Trail stops and the first four Dragon hunts. The runner imported it through Camp, played the fifth hunt through the board controls on seed 6 and checked the resulting save. It added the captured card, removed another card, saved the deck, reloaded the page and reopened the builder. The published browser check can also play all five hunts from a Trail-complete save. [Browser journey](../../scripts/browser-showdown-bounty-journey.mjs)

The optional Poker PNG is the original seed-17 browser capture from PR #235. [Original file and capture manifest](https://github.com/alejandro-publius/cowboys-vs-wizards/tree/8a641d18532fdb2b5cf7a0adec068d75128aee1b/docs/evidence/devpost-gallery)
