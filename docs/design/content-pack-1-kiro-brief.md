# Content pack 1, "Frontier": design brief for Kiro

Fable 5.2, November 18, 2026, Pacific. Designed against the graybox at `e779c6f`. This is the design brief. No repository code was edited.

Every number below comes from a scratch copy of the `e779c6f` rules with the six cards added, driven directly with the existing Normal and Hard bots against the stock Wizard deck. Nothing was clicked in a browser and no person has played these cards. If an acceptance case does not reproduce at your head, stop and send it back to Fable.

The companion file [card-library-roadmap.md](card-library-roadmap.md) lists every playable card and the route to about 34.

## Decisions

1. Six new Cowboy cards: Lasso, Covered Wagon, Outrider, Dynamiter, Ranger, Gatling Crew.
2. One new card effect: **Ride**. It is the existing Ride Out move, bound to a card. Outrider and Ranger have it.
3. Mounted Billy also gains Ride. This is the only change to an existing card. It is separable: drop it and nothing else in the pack moves.
4. Two new 12-card decks: **Wagon Train** and **Night Riders**.
5. Cards unlock one per counted duel win. Bounty rewards, their unlocks and the first-session seeds are untouched.
6. No Wizard cards in this pack. The Wizard CPU and its deck do not change.

## The cards

All six have zero starter copies. `order` continues the Cowboy catalog after Captured Wraith (6), so every existing deck keeps its card order and its shuffle.

| Card | Type | Order | Tribute | Stars | Orbs | Attack | Copy limit | Effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Covered Wagon | `cowboy-covered-wagon` | 7 | none | 4 | 4 | 1 | 2 | |
| Outrider | `cowboy-outrider` | 8 | none | 3 | 3 | 1 | 2 | Ride |
| Dynamiter | `cowboy-dynamiter` | 9 | none | 3 | 1 | 3 | 2 | |
| Ranger | `cowboy-ranger` | 10 | one | 5 | 4 | 2 | 2 | Ride |
| Gatling Crew | `cowboy-gatling-crew` | 11 | two | 7 | 4 | 4 | 1 | |
| Lasso | `cowboy-lasso` | 12 | spell | | | | 2 | removes one orb, may relocate |

Lasso is the Cowboy's Singularity: `"kind": "spell", "relocates": true`. It needs no new rule.

**Player-facing text.**

- Lasso: "Remove one orb from an enemy troop. If it survives, you may drag it one lane into an empty lane."
- Outrider and Ranger: "Ride: instead of summoning, move this troop one lane into an empty lane of yours."
- Covered Wagon: "Four orbs. Takes a Dragon's hit and stands."
- Dynamiter: "Hits for three. One orb."
- Gatling Crew: "Clears any blocker but the Dragon in one clash."

### What each card is for, and how to beat it

| Card | Job | Counterplay | One copy swapped into the starter (Normal / Hard, points of Cowboy win share) |
| --- | --- | --- | --- |
| Covered Wagon | Holds a lane. Survives one Dragon hit (4 → 1) where a Sheriff falls. | It hits for 1. Attack the other lanes, or chip it with a spell. | For a Sheriff: +3.6 / +0.9 |
| Outrider | A Sheriff that can change lanes. | Riding spends the turn's summon and leaves its old lane open. It can only enter an empty lane. | For a Sheriff: −1.1 / −0.9 |
| Dynamiter | Burst. Unblocked, it takes three Base orbs. It trades with a fresh Skeleton. | Anything that hits it kills it. Block it, or shoot it. | For a Sheriff: −6.0 / −6.3. For a Billy: −2.2 / +1.0 |
| Ranger | A Billy that can change lanes. | As Outrider, and it costs a tribute. | For a Billy: −0.8 / +0.6 |
| Gatling Crew | Finisher. Defeats a full Wizard in one clash (4 → 0, Crew 4 → 2). | Two tributes. A Dragon survives it on 1 orb and leaves the Crew on 1. A fresh Skeleton each round stalls it. | For Mounted Billy: +3.9 / −1.1 |
| Lasso | Opens a lane for your attacker, or drags an attacker in front of your wall. | Keep neighbouring lanes filled. A 1-orb troop cannot be dragged. It uses the turn's one spell. | For a Deadeye: +0.8 / +0.8 |

Seeds 72000–72999, each side first once per seed, 2,000 matches per row. Intervals are about ±2.4 points, ±0.7 for Lasso. The starter scored 50.2% and 49.9% on these seeds.

**Why these stat lines.** I measured every troop stat line in each tribute tier as a one-copy swap (seeds 70000–70399). The fair cells are few. A free troop with 1 orb and 2 attack costs 17 to 18 points per copy. A free troop with 3 attack and 2 or more orbs gains about 20 or more. A one-tribute troop with 3 orbs and 3 attack gains 13 to 15 and would outclass Captured Dragon. The pack stays inside the cells that measured within a few points of the card they replace, and uses copy limits where a card is a small upgrade (Covered Wagon, and the two riders).

**Dynamiter is the risky card.** The bots rate it below a Sheriff and level with a Billy. It is in the pack because it is the only card that makes an open lane frightening, and Night Riders scores well with two. A person who times it on rounds where they act second may do much better than the bots. Watch it first in playtests.

## The one new effect: Ride

**Rule.** A troop with Ride may, once in its owner's turn, move one lane left or right into an empty lane on its own side. It keeps its orbs. The move spends the turn's summon. It cannot follow a summon or a spell. A spell may follow it. This is today's Ride Out, word for word, limited to troops whose card says Ride.

**Where it applies.**

- Standard duels: only troops with Ride can move. Today that is Outrider, Ranger and Mounted Billy.
- Hunts, the Ride Out lesson and `?rideOut=1` duels: unchanged. Every troop can ride there, as now.

**Engine seam.** One optional boolean on a troop spec, `"rides": true`. `legalActions` lists a ride-out for a troop when the match has `rideOut.enabled` or the troop's card rides. `applyAction` accepts it on the same condition. Nothing else in the move changes: same action, same event, same Presenter path, same previews, same CPU scoring.

**UI.** Show the Ride Out button in a standard duel only while at least one of the player's troops can ride. Reuse the existing note, adjusted: "Summon or Ride this turn. You can cast a spell afterward." On a rider's card face add the word "Ride".

**Mounted Billy.** He gains `"rides": true` and nothing else. Two new riders next to a "Mounted" Billy who cannot ride would read as a mistake. With the bots it changes nothing measurable: the starter with and without his Ride differed by −1.1 ±1.7 (Normal) and +0.6 ±1.9 (Hard), and the bots rode 0.02 to 0.04 times per match.

**The bots barely ride.** This is the main unknown in the pack. Five riders with the same bodies as the starter's cards moved the result by −3.5 ±3.5 (Normal) and +0.7 ±3.4 (Hard). The riders are priced as if Ride were worth nothing, with a copy limit of two each. If people show Ride is worth an orb, take an orb off each rider.

**First-session text.** The earlier first-ten-minutes brief has the Wraith poster say "On a hunt your troops can Ride Out. In a duel they hold their lanes." With this pack, change the second sentence to "In a duel only riders can."

## New spec field: copy limit

Add an optional integer `limit` (1 to 6) to Cowboy specs. Deck validation and the Build Deck steppers cap that card at `limit`. Cards without it keep today's limits: 6, or 1 for a bounty card. This is data and validation, not a card effect.

Draft specs, one file each under the card pipeline:

```json
{ "type": "cowboy-covered-wagon", "side": "cowboy", "order": 7, "name": "Covered Wagon", "kind": "troop", "stars": 4, "health": 4, "attack": 1, "copies": 0, "limit": 2 }
{ "type": "cowboy-outrider", "side": "cowboy", "order": 8, "name": "Outrider", "kind": "troop", "stars": 3, "health": 3, "attack": 1, "copies": 0, "limit": 2, "rides": true }
{ "type": "cowboy-dynamiter", "side": "cowboy", "order": 9, "name": "Dynamiter", "kind": "troop", "stars": 3, "health": 1, "attack": 3, "copies": 0, "limit": 2 }
{ "type": "cowboy-ranger", "side": "cowboy", "order": 10, "name": "Ranger", "kind": "troop", "stars": 5, "health": 4, "attack": 2, "copies": 0, "limit": 2, "rides": true }
{ "type": "cowboy-gatling-crew", "side": "cowboy", "order": 11, "name": "Gatling Crew", "kind": "troop", "stars": 7, "health": 4, "attack": 4, "copies": 0, "limit": 1 }
{ "type": "cowboy-lasso", "side": "cowboy", "order": 12, "name": "Lasso", "kind": "spell", "relocates": true, "copies": 0, "limit": 2 }
```

The pipeline today rejects `copies: 0` on a non-bounty card and unknown fields. Allowing zero starter copies for a collectible, `limit` and `rides` is yours to wire.

## The decks

| | Wagon Train | Night Riders |
| --- | --- | --- |
| Plan | Hold lanes behind wagons, clear with spells, cash two troops for the Gatling Crew. | Seven free troops, burst from Dynamiters, riders that change lanes. No two-tribute card. |
| List | 3 Sheriff, 2 Covered Wagon, 2 Billy, 1 Gatling Crew, 2 Deadeye, 2 Lasso | 3 Sheriff, 2 Outrider, 2 Dynamiter, 2 Ranger, 2 Deadeye, 1 Lasso |
| Cowboy share, Normal | 52.5% (starter 50.2%) | 53.6% |
| Cowboy share, Hard | 53.9% (starter 49.9%) | 57.1% |
| Mean rounds, Normal / Hard | 5.99 / 5.43 | 5.43 / 5.19 (starter 7.30 / 5.81) |
| Opening hand with no free troop | 7.1% | 1.0% (starter 3.0%) |

Same seeds as the card table. Both decks sit between the starter and Deadeye Control (61.8% and 62.2% there). Both are legal under today's rules: 12 cards, at least one Sheriff, every count inside its limit.

Three spells in place of Mounted Billy is the strongest known shell, so keep an eye on lists that cut every tribute card for spells. A Wagon Train variant with four Sheriffs and one Lasso scored 64% on other seeds, which is why the list above runs three Sheriffs and two Lassos.

## Unlocks

One card per counted duel win, starting at the second win: Lasso, Covered Wagon, Outrider, Dynamiter, Ranger, Gatling Crew at 2, 3, 4, 5, 6 and 7 wins. Use `stats.wins`, which already skips hunts, drafts and lessons. The first session contains at most one counted win, so no pack card appears during it. Offer a "Load Wagon Train" button once every card in it is owned (7 wins), and "Load Night Riders" at 6 wins.

## Acceptance cases

**Nothing existing moves.**

1. With the six specs added, `DECKS` is unchanged, and `createMatch(690)` equals its state at `e779c6f`.
2. `createMatch(2328)` with Wraith Posse equals its state at `e779c6f`. Opening hand: Sheriff, Sheriff, Sheriff, Captured Wraith.
3. All ten hunts start from the same state as at `e779c6f`.
4. Wraith and Dragon rewards unlock at five hunts each, as now.

**Single cards.** Set the boards directly, as the rules tests do, and resolve one clash.

5. Covered Wagon (4) and Sheriff (3) each face a Dragon (5): the Wagon is on 1, the Sheriff has fallen, both Dragons are on 4.
6. Gatling Crew (4) faces a Wizard (4): the Wizard falls, the Crew is on 2. Against a Dragon (5): the Dragon is on 1, the Crew is on 1.
7. Dynamiter in an open lane: Wizard Base 5 → 2. Dynamiter facing a fresh Skeleton: both fall.
8. Lasso with a 3-orb Skeleton in Wizard lane 1, lane 2 empty and a 1-orb Skeleton in lane 3: the legal casts are lane 1, lane 1 with a drag to lane 2, and lane 3. After the drag the Skeleton stands in lane 2 on 2 orbs.
9. Ride in a standard duel with an Outrider in lane 1, lane 2 empty and a Sheriff in lane 3: the only ride-out listed is lane 1 → 2. After it the Outrider is in lane 2 on 3 orbs, a summon is refused with `summon-used`, and a spell is still legal. A ride-out for the Sheriff is refused as `invalid-action`.
10. In a hunt, every troop still rides.

**Limits.** 11. A deck with three Lassos, three Covered Wagons or two Gatling Crews is rejected. Both lists above are accepted.

**Deck deals.** Deck IDs in catalog order, standard duel, Normal Wizard, the seed's own first seat. Cowboy clicks only; the Wizard's replies follow from them.

12. **Wagon Train, seed 6.** Opening hand: Sheriff, Covered Wagon, Deadeye, Billy.
    - R1 Covered Wagon lane 1. R2 Covered Wagon lane 2, Deadeye on Wizard lane 1.
    - R3 Gatling Crew lane 1, tribute lanes 1 and 2.
    - R4 Sheriff lane 2, Lasso on Wizard lane 2. R5 Billy lane 2, tribute lane 2.
    - Victory in round 5, Cowboy Base 4.
13. **Night Riders, seed 244.** Opening hand: Sheriff, Deadeye, Deadeye, Lasso.
    - R1 Sheriff lane 1. R2 Sheriff lane 2, Deadeye on Wizard lane 1. R3 Ranger lane 1, tribute lane 2.
    - Round 4 board: Cowboy Base 4, a Ranger on 2 orbs in lane 2. Wizard Base 5, a 1-orb Skeleton in lane 1 and a Wizard (4) in lane 2. Hand: Deadeye, Lasso, Outrider.
    - With the ride: R4 Ride lane 2 → 1, Deadeye on Wizard lane 1. R5 Outrider lane 2. R6 Sheriff lane 3, Lasso on Wizard lane 1. Victory in round 6, Cowboy Base 2.
    - Without it: R4 Outrider lane 1, Deadeye on Wizard lane 1. R5 Dynamiter lane 3. R6 Sheriff lane 2. R7 Dynamiter lane 3. R8 Outrider lane 2, Lasso on Wizard lane 2. R9 Ranger lane 1, tribute lane 1. Draw in round 9, both Bases at 0.

**Bot check.** 14. Re-run both decks against the starter on seeds 72000–72999. Each should land within about three points of the shares above.

## Not known, and back to Fable

- How much Ride is worth to a person. If riders look strong, they lose an orb.
- Whether Dynamiter is fun or just swingy in human hands.
- Whether two decks at 52 to 57% feel like a fair reward next to a starter at 50%.
- Any wish to change a stat, a limit, the unlock order, or to give the Wizard new cards. That is pack 2.
