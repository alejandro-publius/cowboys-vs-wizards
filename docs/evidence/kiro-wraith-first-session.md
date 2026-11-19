# First-session Wraith route

Fable 5.2 designed the opening, hunt order and Wraith Posse replay.
Kiro CLI wired the result actions, Wanted order and unsaved follow-up duel
in a worktree based on Frontier `bccaff3`. Codex shared the Wraith Posse
preset with Build Deck, pinned the follow-up opponent to Normal and ran
the verification.

## Replay in the graybox

1. On a fresh profile, choose How to Play and Start guided duel. On seed
   690, summon Sheriff in lanes 2, 3 and 1 over the first three rounds.
   End each round. Victory offers **Take the notice**.
2. Clear the notices below. Choose **Next notice** after each capture.
3. Choose **Duel with the Wraith Posse**. The draft on seed 2328 opens with
   three Sheriffs and Captured Wraith. Summon Wraith in lane 2, Sheriff in
   lane 3 and Sheriff in lane 2. End each round. Victory in round 3 points
   to the Graveyard Dragon.

| Notice | Seed | First turn before ending the phase | Cowboy Base after capture |
| --- | ---: | --- | ---: |
| Gallows Lantern | 4201 | Ride from lane 2 to lane 1 | 2 |
| Ferry Crossing | 4203 | Pass | 1 |
| Blacksmith Forge | 4204 | Deadeye on Wizard lane 3 | 2 |
| Lamplighter Row | 4205 | Tribute the troop in lane 1 for Billy in lane 1 | 1 |
| Chapel Bell Tower | 4202 | Sheriff in lane 3 | 1 |

## Verification

- Chrome completed all five captures in round 1 and earned Lantern Snuffer.
  It followed the Wraith Posse route to a round-3 victory, then used
  **Replay this deal** to open with Sheriff and reach a round-6 draw.
- The page was loaded with `cpu=hard&rideOut=1`. The follow-up used the
  authored Normal opponent and ordinary duel rules. Its opening offered
  no Ride action. The saved deck and counted duel statistics stayed intact.
- Chrome checked the first-result offer on a win and a non-win, its
  absence after the second duel or a prior hunt clear, and a Next notice
  action that skipped two already-cleared notices.
- All 40 focused deck preset, profile, Wraith, card model and guide tests
  passed. Human completion time for the full route remains unmeasured.
