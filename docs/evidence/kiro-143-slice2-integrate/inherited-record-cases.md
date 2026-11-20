Persisted inherited-ownership record over the compat harness fixtures (one-off script, not committed; lane key removed before the second load).

| lane fixture | showdown fixture | result | listed |
| --- | --- | --- | --- |
| fresh-no-key | none | pass | - |
| settings-only | none | pass | - |
| partial-early | none | pass | - |
| partial-frontier-deck | none | pass | - |
| dragon-hunts-3-of-5 | none | pass | - |
| dragon-captured | none | pass | cowboy-captured-dragonx1 |
| wraith-captured | none | pass | cowboy-captured-wraithx1 |
| wraith-captured-dragon-4-of-5 | none | pass | cowboy-captured-wraithx1 |
| both-captured-in-deck | none | pass | cowboy-captured-dragonx1 cowboy-captured-wraithx1 |
| dragon-captured-extra-key | none | pass | cowboy-captured-dragonx1 |
| corrupt-json | none | pass | - |
| fresh-no-key | v1-trail-3 | pass | - |
| dragon-captured | v2-trail-2 | pass | cowboy-captured-dragonx1 |
| both-captured-in-deck | v2-trail-done-dragon-3 | pass | cowboy-captured-dragonx1 cowboy-captured-wraithx1 |
14 of 14 cases: persisted inherited record = lane captures, each listed once after the lane key is removed
