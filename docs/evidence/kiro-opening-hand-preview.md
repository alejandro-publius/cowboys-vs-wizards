# Opening hands in the deck builder

Kiro CLI added a seeded opening-hand preview to the existing deck builder. Codex checked it in Chrome. The old draft showed an opening drought percentage. The preview deals the actual cards behind that statistic for the current 12-card draft.

Build with `npm run build`. Open the local graybox, choose Build Deck, and open “Preview opening hand.” The starter's seed 0 deals Mounted Billy, Deadeye, Sheriff and Billy. “Deal another opening” advances to seed 1 and deals Sheriff, Deadeye, Sheriff and Billy. Loading Billy Posse retained the seed. Removing a Sheriff disabled the preview until the deck is legal again.
