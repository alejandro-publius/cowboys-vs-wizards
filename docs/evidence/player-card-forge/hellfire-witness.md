# Hellfire at the Card Forge

Codex CLI, November 27, 2026. The Forge lets a player test whether their own Skeleton is safe when they cast Hellfire. The card gallery already demonstrates Hellfire hitting three Cowboys. This deal adds the missing comparison with a friendly troop.

| Wording chosen before casting | Predicted Sheriff / Skeleton | Observed Sheriff / Skeleton |
| --- | --- | --- |
| “Remove 1 orb from every troop.” | 2 / 2 | 2 / 3 · fails |
| “Remove 1 orb from every enemy troop.” | 2 / 3 | 2 / 3 · passes |

Both start at 3 orbs. One enemy supplies a legal cast and one ally distinguishes the predictions. On seed 0 with standard 16-card decks and Cowboys first, summon Sheriff, end the turn, summon Skeleton, then cast Hellfire. The released engine emits one spell event targeting Sheriff. The frozen Python referee accepted the same four actions with both decks in the same draw order. It returned the same troop orbs and both Bases at 5. [Card wording](../../../prototypes/showdown/cards.csv) · [Clauses CARD-WIZARD-HELLFIRE-07 and -11](../../../.kiro/specs/card-wizard-hellfire/requirements.md#resolution) · [Independent referee](../../../proof/referee/referee.py)

The matrix’s Score Bridge cell G2 calls for dealing the smallest hand that breaks a rule sentence. Deadline Séance’s reported counterexample motivated keeping the failing wording alongside the passing one. The branching-comic exercise in the supplied Felix Rieseberg notes suggested letting the player choose a reading and turn back to the same board.

## Verification

- `node --test tests/match/forge-hellfire.test.js tests/match/forge-shelf.test.js tests/match/camp-side-games.test.js` passed all 17 checks. The witness checks pin the cast, both verdicts, the restored board and focus on the alternate wording.
- `python3 -B proof/referee/referee.py --stream` accepted the four-action input. In engine IDs the summons are `cowboy-sheriff-3` and `wizard-skeleton-4`, and the spell is `wizard-hellfire-1`. The input used the seed-0 opening hands followed by their remaining decks, with printed card names for the referee.
- `node scripts/stage-pages.mjs` produced the illustrated entry in `dist/web/index.html`. This worker could not bind loopback (`EPERM`) or start Chromium (macOS denied Mach port registration).

## Parent Chrome check

1. From this checkout, serve the staged game with `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist/web`. Open `http://127.0.0.1:4173/` in Chrome.
2. Choose **Night Shift Saloon → Forge shelf → Who gets burned by Hellfire?** Activate **Remove 1 orb from every troop.** The verdict should receive focus and the board should show Sheriff 3 → 2 and Skeleton 3 → 3.
3. Tab to **Replay the same board** and press Enter. Both troops should show 3 orbs and focus should land on **Remove 1 orb from every enemy troop.** Press Enter. The same cast should now match the wording.
4. At a 360-pixel viewport, retry with taps. Escape or **Back to map** should return to Camp. Compare the `cvw-showdown-save-v2` value before opening the shelf and after returning.
