# Wanted board and field guide

Eight Codex CLI sessions worked on this change. Each reported `gpt-6.2-astra` and `ultra` reasoning in its startup record. Antigravity’s earlier duel-hand design came from [PR 242](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/242).

| Assignment | Evidence |
| --- | --- |
| Wanted posters | Both posters use the existing boss paintings. Each native button changes action with the campaign and displays five saved hunt tallies. [Wanted bills](../../src/ui/wanted-bills.js) |
| Capture and deck building | The earned portrait opens its Cowboy entry. The separate bonus remains claimable. [Capture screen](../../src/ui/showdown-screen.js) |
| Illustrated duel hand | All 29 cards have short cues backed by their rules. The test covers both spell-cover rulesets. [Hand-face check](../../tests/match/showdown-hand-faces.test.js) |
| Browser journeys | Chrome opens every book entry. It plays each boss’s fifth win after four setup wins, then saves a legal deck and reloads it. [Book](../../scripts/check-character-book.mjs) · [Both bosses](../../scripts/check-wanted-collection.mjs) |
| Judge environment | A Linux container ran the catalog referee and checked the balance result against 100,000 recorded duels. [Container run](https://github.com/alejandro-publius/cowboys-vs-wizards/actions/runs/45963132065) |
| Independent review | The reviewer traced builder cancellation, a collection reset in another tab, rules visibility during Ride or Fight, and whether the replay test could pass with a missing renderer. |
| Builder return and campaign refresh | Browser coverage exercises cancellation from the verdict and from the Wanted wall, plus a second browsing context replacing the save while the book is open. [Wanted journey](../../scripts/check-wanted-collection.mjs) |
| Hand rules and privacy | The staged browser opens the full hand rules during Ride or Fight and checks that no previous hand survives the pass-screen curtain. [Staged-browser checks](../../scripts/check-pages-tree.mjs) |

The coordinator also played all five consecutive Dragon hunts in Chrome at seed 6 using a completed-Trail save, saved the captured card in a 16-card deck, and reopened the lightweight scouting route. The shorter two-boss check uses seed 8. [Five-hunt run script](../../scripts/browser-showdown-bounty-journey.mjs)
