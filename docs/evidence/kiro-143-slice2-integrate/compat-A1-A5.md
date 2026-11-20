> **Historical receipt.** This is the run under the old A1 (`owned(progress) > 0`), before Fable's ruling
> (PR 148 issuecomment-7031816529) flipped A1. The current check is
> `tests/game/showdown-keepsake-compat.test.js`, which runs in `npm test`.

Loader: /tmp/gwi/loader.mjs
| lane fixture | showdown fixture | result | failed checks |
| --- | --- | --- | --- |
| fresh-no-key | none | pass |  |
| settings-only | none | pass |  |
| partial-early | none | pass |  |
| partial-frontier-deck | none | pass |  |
| dragon-hunts-3-of-5 | none | pass |  |
| dragon-captured | none | FAIL | A1 cowboy-captured-dragon owned 0 |
| wraith-captured | none | FAIL | A1 cowboy-captured-wraith owned 0 |
| wraith-captured-dragon-4-of-5 | none | FAIL | A1 cowboy-captured-wraith owned 0 |
| both-captured-in-deck | none | FAIL | A1 cowboy-captured-dragon owned 0; A1 cowboy-captured-wraith owned 0 |
| dragon-captured-extra-key | none | FAIL | A1 cowboy-captured-dragon owned 0 |
| corrupt-json | none | pass |  |
| fresh-no-key | v1-trail-3 | pass |  |
| dragon-captured | v2-trail-2 | FAIL | A1 cowboy-captured-dragon owned 0 |
| both-captured-in-deck | v2-trail-done-dragon-3 | FAIL | A1 cowboy-captured-dragon owned 0; A1 cowboy-captured-wraith owned 0 |

7 of 14 cases pass.
