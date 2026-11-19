# First 10 minutes: implementation brief for Kiro

Fable 5.2, November 18, 2026, Pacific. Gameplay decisions for the graybox at `e779c6f`. The Cover Swap prototype is `6389eca` on `fable/graybox-cover-swap`.

Every seed, board and outcome below comes from driving the `e779c6f` engine directly in a scratch export. Nothing here was clicked in a browser. Kiro owns the wiring, the regression checks, the browser pass and the recording. If a line below does not reproduce at your head, stop and send it back to Fable. Do not retune it.

## The arc

| Step | Content | Rules | Decision the player meets |
| --- | --- | --- | --- |
| 1. Opening duel | Guided duel, starter deck, seed 690, Normal Wizard | Standard duel | Block the Skeleton or race it. Both win. |
| 2. First bounty | Lantern Wraith, five notices in the order below | Hunt rules (Ride Out, as today) | Read the Wraith's mark, then act or hold. |
| 3. Follow-up duel | Wraith Posse, seed 2328, Normal Wizard | Standard duel | Lead with the Sheriff or the Captured Wraith, and where. Only one answer wins. |

No card, stat or rule changes. The reward still takes all five hunts. The Graveyard Dragon is the next goal after step 3 and is outside this brief.

My time estimate is 7 to 9 minutes for a new player. It is unmeasured. The shortest winning route through all three steps is 42 clicks: 12 for the race line, 18 for the five notices and 12 for the follow-up win. Report the real times from your recording.

## 1. Opening duel: seed 690 replaces seed 60

**Decision.** How to Play → Start guided duel deals seed 690. Seed 60 stays reachable by address.

**Why.** Seed 60 is too long and too easy to lose for a first duel. Played by the Normal bot the Cowboy wins it in round 9 with one Base orb left. Played by the Hard bot the Cowboy loses in round 4. Careless play (any legal move at random, never passing while a summon is possible) won 0.7% of 2,000 runs on seed 60 and 44.4% on seed 690, with 23.8% draws. Seed 690 is the most forgiving of the three seeds in 0–3999 that open on one Skeleton, hold Sheriff, Sheriff, Billy and Deadeye, and are won within seven rounds by the Normal, Hard and Easy bots alike.

**Starting board** at the player's first input: round 1, the Wizard has acted. Wizard Base 5, Skeleton (3 orbs) in lane 1. Cowboy Base 5, no troops. Hand in order: Sheriff, Sheriff, Deadeye, Billy.

**Text.** The existing opener tip applies unchanged: "Put Sheriff across from the Skeleton to protect your Base, or choose an open lane to trade Base damage." Keep the rest of the guide as it is.

**Expected outcomes.** Both lines are fixed click scripts against the Normal Wizard.

| Line | Cowboy plays | Result |
| --- | --- | --- |
| Block | R1 Sheriff lane 1. R2 Sheriff lane 2, Deadeye on Wizard lane 1. R3 Sheriff lane 1. R4 Billy lane 3, tribute lane 1. R5 Billy lane 1, tribute lane 2. | Victory, round 5. Cowboy Base 4, Wizard Base 0. |
| Race | R1 Sheriff lane 2. R2 Sheriff lane 3. R3 Sheriff lane 1. | Victory, round 3. Cowboy Base 2, Wizard Base 0. |

The block line uses a free summon, a spell and two tributes. The race line shows the cost of leaving the Skeleton alone: three Base orbs.

## 2. First bounty: the Lantern Wraith

**Decision.** The first bounty to surface is the Lantern Wraith, starting with Gallows Lantern. The Dragon comes second.

**Why the Wraith first.**

- All five Wraith notices have a one-clash solution. Two of the five Dragon notices need two clashes.
- The listed solutions take 18 clicks in total. By my count the Dragon's five take 42.
- Captured Wraith is free to summon, so it changes the first turn of the next duel. Captured Dragon needs a tribute, so its first decision depends on what the player did in earlier rounds and cannot open on a fixed board.

**Cost.** The Wraith's mark is one more thing to read than "monsters hold their lanes". The graybox already labels the marked lane and puts the drift first in the clash preview.

**Surfacing.**

- When the first duel of a profile ends, with any result and no hunt cleared, the result screen adds one line and one button.
  - Line: "A notice is up on the Wanted board: the Lantern Wraith."
  - Button: "Take the notice". It starts Gallows Lantern.
- On the Wanted page, show the Lantern Wraith poster above the Graveyard Dragon. `dragonRewardEarned` reads `BOSSES[0]`, so do not get there by reordering `BOSSES` alone.
- After a capture, the primary button is "Next notice: <name>" for the next uncleared Wraith hunt in the order below. "Replay" stays.
- Add one sentence to the Lantern Wraith poster brief: "On a hunt your troops can Ride Out. In a duel they hold their lanes."

**Order and expected outcomes.** Names, descriptions, seeds and boards are the existing data, unchanged. Only the order changes. Each solution captures in round 1.

| # | Notice (seed) | Solution | Cowboy Base after | Tempting mistake | First turns that capture / all |
| --- | --- | --- | --- | --- | --- |
| 1 | Gallows Lantern (4201) | Ride Out lane 2 → 1, End turn | 2 | End turn: escaped, Base 0 | 1 / 8 |
| 2 | Ferry Crossing (4203) | End turn | 1 | Ride Out lane 3 → 2: escaped, Base 0 | 3 / 7 |
| 3 | Blacksmith Forge (4204) | Deadeye on Wizard lane 3, End turn | 2 | End turn: escaped, Base 0 | 4 / 15 |
| 4 | Lamplighter Row (4205) | Billy into lane 1, tribute lane 1, End turn | 1 | Billy into lane 3, tribute lane 3: the hunt goes on | 1 / 8 |
| 5 | Chapel Bell Tower (4202) | Sheriff into lane 3, End turn | 1 | Deadeye on Wizard lane 3: escaped, Base 0 | 4 / 28 |

The order teaches one answer per notice: move to meet it, hold still, clear its path with a spell, tribute into its path, then cover a lane while it is blocked. Chapel Bell Tower is last because 22 of its 28 first turns lose outright.

**After the fifth capture.** Keep "Lantern Snuffer" and the 5 / 5 line. Add:

- Line: "Captured Wraith joins your collection: free to summon, 2 attack, 2 orbs."
- Button: "Duel with the Wraith Posse". It starts the duel in step 3.

## 3. Follow-up duel: Wraith Posse on seed 2328

**Decision.** The button starts a standard duel, Normal Wizard, seed 2328, with Wraith Posse as an unsaved draft: 5 Sheriff, 3 Billy, 1 Mounted Billy, 2 Deadeye, 1 Captured Wraith. Do not overwrite the player's saved deck. No Ride Out.

**Starting board** at the player's first input: round 1, the Wizard has acted. Wizard Base 5, Skeleton (3 orbs) in lane 1. Cowboy Base 5, no troops. Hand in order: Sheriff, Sheriff, Sheriff, Captured Wraith.

This is the opening duel's first screen again, with one new card. There, a Sheriff in an open lane won in round 3. Here it only draws.

**Expected outcomes.** First play, then the Normal bot plays the Cowboy. The Hard bot as the Cowboy gives the same result in every row except the last, which it loses in round 6.

| First play | Result | After the first clash |
| --- | --- | --- |
| Captured Wraith in lane 2 or 3 | Victory, round 3. Cowboy Base 2. | Wizard Base 5 → 3, Cowboy Base 5 → 4 |
| Sheriff in lane 2 or 3 | Draw, round 6. Both Bases fall. | Wizard Base 5 → 4, Cowboy Base 5 → 4 |
| Sheriff in lane 1 | Defeat, round 7. | Bases stay at 5 |
| Captured Wraith in lane 1 | Draw, round 8. | Bases stay at 5, Wraith on 1 orb |

Fixed click scripts against the Normal Wizard:

- Win: R1 Captured Wraith lane 2. R2 Sheriff lane 3. R3 Sheriff lane 2. Victory in round 3, Cowboy Base 2, Wizard Base 0.
- Draw: R1 Sheriff lane 2. R2 Captured Wraith lane 3. R3 Sheriff lane 1. R4 Sheriff lane 3. R5 Sheriff lane 1. R6 Billy lane 1, tribute lane 1, then Deadeye on Wizard lane 2. Both Bases fall in round 6.

The one extra orb of Base damage in the first clash decides it. After the right first play, careless play still took a 52.6% share of results in 1,000 runs. After a Sheriff in an open lane it took 36.1%.

**Text.**

- Opening note, shown through round 1: "Wraith Posse: Captured Wraith rides in place of one Sheriff. It is free to summon, hits for 2 and has 2 orbs. In a duel your troops hold their lanes."
- Give no lane hint. The existing lane previews already show "Enemy Base 5 → 3" against "5 → 4".
- On Victory, add: "Next on the Wanted board: the Graveyard Dragon." On Defeat or Draw, keep "Replay this deal" as the primary button.

## Cover Swap: an experiment

**Decision.** Cover Swap stays an experiment behind its two links. Do not put it in standard duels, in the ten existing hunts, or anywhere in this arc. Do not merge `6389eca` for this work.

**Evidence.**

- **The seed-162 board.** For one clash the swap is the best move: nothing of yours falls and no Base orb is lost, where holding loses the Sheriff and current Ride Out loses the Sheriff and a Base orb. Over the whole match it is not. With the bots finishing, summoning a Sheriff into lane 3 wins in round 7 with the Base on 4, holding wins in round 8, and the swap wins in round 9. The swap spends the summon, and on its own showcase board the summon is worth more. It does beat current Ride Out there, which draws under Normal and loses under Hard.
- **Standard duels.** In 2,000 paired CPU matches per level (seeds 64000–64999, both first seats, current Ride Out against Ride Out plus the swap), a swap was legal in 29% of Normal phases and 32% of Hard phases, and chosen in 83 and 66 matches. It changed the winner in 13 Normal and 20 Hard matches. At a match's first swap the swapping side ended better 7 times and worse 6 under Normal, and better 5 times and worse 15 under Hard. Seat and faction shares moved by less than half a point.
- **Existing hunts.** Switching the swap on in all ten hunts adds no one-clash solution to any of them. It adds two-clash lines to three. No existing hunt is about it.

So in duels it is a rarely useful second move type that costs a rule and a click. A lesson for it would teach a move the player can use nowhere else.

**What would change this.**

- **To selected encounters:** a Wanted hunt authored around it, with a constrained hand so that moving troops is the point, and a solver result showing the swap is its only one-clash capture. Also a playtest of the two seed-162 links where players on the current link try to trade the two troops unprompted, and players on the swap link find and confirm the swap without help.
- **To standard duels:** a paired run with a policy that models the opponent's reply in which the swapping side ends better clearly more often than worse, and recorded human duels in which a swap is the best move in most matches. Today's numbers say neither.
- **To drop it:** playtesters who do not find the swap on the swap link, or who misread the two-step choice of troop and lane.

The patch applies to `e779c6f` without conflicts in a scratch copy, and the swap, Ride Out, Wraith, CPU, presenter and selection suites passed there (109 tests). A later promotion is cheap. That is a scratch result only.

## Acceptance cases

1. Guided duel: seed 690, the starting board above, and the opener tip text.
2. The block and race scripts end as listed.
3. First-duel result screen shows the Wraith line and button once per profile, after any result, and never once a hunt is cleared.
4. The Wraith poster is first on the Wanted page, and the Dragon's progress and reward still work.
5. Wraith notices list in the order above, and each solution captures in round 1 with the Base shown.
6. "Next notice" walks the order and skips cleared hunts.
7. The fifth capture offers the Wraith Posse duel: seed 2328, the starting board above, draft deck, no Ride Out button, saved deck untouched.
8. The win script ends in Victory in round 3 with Cowboy Base 2. The draw script ends with both Bases falling in round 6.
9. Default duels, the Dragon hunts and the Ride Out lesson behave as before.

## Back to Fable

- Any line above that does not reproduce.
- Measured time to the reward above five minutes, or more than half of first-time players failing Gallows Lantern twice. Either would reopen the choice of first boss.
- Any wish to change a card, the five-hunt goal, or where Ride Out is allowed.
