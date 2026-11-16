# Restore the approved visuals to the combined match

Codex restored these visuals from the separate cowboys-vs-wizards-playtest
checkout into codex/playable-duel. The earlier integration had retained Kiro's
temporary interface while omitting the playtest's illustrated cards and terrain.
This was an integration regression, not missing or deleted artwork.

| Approved source | Combined build |
| --- | --- |
| playtest/billy-card.webp, wizard-card.webp (6efced0) | Exact bytes in assets/cards/ |
| playtest/card-view.js, physical card styling (8478041) | src/ui/card-art.js, match.css: faces, seven edge layers, tilt and flip |
| playtest/perimeter.js, Tripo corners (e245fd7) | src/render/perimeter.js, two optimized GLBs and dirt material |
| Lower playtest camera (4653ea6) | src/render/match-camera.js |
| Arena controls (7b49d1c) and the user's Master Duel screenshots | Contextual controls, corner decks, orb badges, seed/restart in the menu |

Kiro's controller, selection, accepted-summon flight and draw flight remain
connected to Fable's engine. Fable's character motion and the exchange demo
remain in the combined build. The lane buttons now project onto actual tiles;
there is no separate lane-button grid. No game values changed.

## Observed checks

- Chrome full match: 8/8 steps, zero console errors; actual tile picks,
  summons, CPU/clash, result, restart during playback, exchange and return.
- Final source: 51 match tests passed. The stage test now verifies visible
  lanes at two aspect ratios instead of requiring the old demo camera.
- Final Chrome visual review: all 11 checks passed; original artwork,
  card viewer/flip, menu, Escape preserving selection, 2048x1000 fit and
  reduced-motion styling. Screenshots were inspected.
- The browser run's build hash and scope are recorded separately from the
  final visual-review hash. No mobile or Safari appearance claim.

[Restored table](visual-restoration/table.png) ·
[Wizard illustration](visual-restoration/wizard-card.png)

## Remaining art

Only Billy and Wizard have finished illustrated fronts. Sheriff, Mounted
Billy, Skeleton, Dragon, Deadeye and Singularity still have draft faces.
Mounted Billy, Skeleton and Dragon still use temporary board tokens. Do not
replace the two approved fronts while completing these assets. Preserve the
playable controller and restored visual layer together in future integration.
