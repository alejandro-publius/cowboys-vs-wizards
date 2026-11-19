# Fire arc readability review

Fable designed Ember Gulch and the Bonewright. Three Kiro CLI workers implemented Dragon Fire card text, marked-lane forecasts, and links to individual practice boards. The coordinator connected the view to public forecasts and checked the result. This branch is available for post-pilot release review.

Build with `npm run build` and open `dist/cowboys-vs-wizards-board-duel.html?mode=fire-arc&stage=position-a`. Tribute the Sheriff in lane 2 for the Captured Dragon, then select Deadeye. The target preview shows the lane 2 Skeleton dropping from two to one and Dragon Fire taking the Wizard Base from three to zero. Repeat on `?mode=fire-arc&stage=position-b`. The lane is marked and the same forecast explicitly depends on the Bonewright leaving it alone. The pre-clash forecast warns that a fresh Wizard can replace the target.

Chrome also opened Ember Gulch using an unknown stage and checked the visible Dragon rule, the Captured Dragon's hand text and accessible name, the absence of Fire text and the Rebuild marker in a standard duel, and the unchanged saved profile. The card model and forecast checks passed 25/25. The current release candidate has the existing Fire draft and stays on the branch selected in Fable's release handoff.
