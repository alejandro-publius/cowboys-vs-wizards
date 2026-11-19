# Edit a deck after trying it

Kiro implemented the result action and passed the tried recipe back to Build Deck. Codex simplified the menu handoff, checked the restored recipe against current unlocks, and verified the flow.

Before, the editor reopened with the saved deck after a trial. Now **Edit this draft** reopens the exact recipe played in the trial. **Revert changes** restores the saved recipe. **Save deck** applies the edited recipe to future counted duels.

To record the change after unlocking Night Riders, load that deck in Build Deck, replace one Outrider with a Sheriff, and choose **Try Draft**. Finish the duel and choose **Edit this draft**. The editor opens with four Sheriffs and one Outrider. Revert, or save and start a counted duel with the edited recipe.

Headless Chrome exercised this route on seed 4 with a profile seeded at seven wins and Billy Posse saved. It passed a trial to the result, replayed it, reopened the edited recipe with keyboard focus on Back, and checked that the saved deck and stats were intact. It also checked Revert, explicit Save after a second trial, and an ordinary duel that counted toward matches and had no draft action. Both builds and 25 focused deck, profile, and card-model tests passed.
