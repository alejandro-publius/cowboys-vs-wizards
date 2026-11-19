# Depth arc: learn the fire, earn it, then meet the Bonewright

Fable 5.2, November 18, 2026, Pacific. Written against `468c009` on `fable/depth-arc`, where Captured Dragon has 2 orbs and 4 attack. No production code or art was touched.

Every board and line below was resolved in a scratch copy of `src/game` under `.artifacts/arc-lab/`, with Dragon Fire and the rival's habit added there. "Best result" claims come from an exhaustive search of the Cowboy's lines against that rival. No person has played it and nothing was clicked in a browser.

## The call

**Deepen Dragon Fire first.** Build one three-minute arc: a boss fight where the Graveyard Dragon uses fire on you, then two positions against a new rival, the Bonewright, on the same board.

**Build**

- Dragon Fire as a rule that exists only in this arc.
- One boss notice, "Ember Gulch".
- One rival habit with a visible mark: **Rebuild**.
- Two rival positions that share a board and differ only in who moves first.

**Cut**

- Any further Wraith Drift work for now. Kiro's two-destination page stays as it is. The drift resolves before the clash with no reply possible, so a rival cannot answer it without a new rule. Dragon Fire can be answered with cards the Wizard already has.
- Dragon Fire on the collectible card in standard duels. With 4 attack plus fire, the bots scored 7 to 11 points above a Billy under the Hard bot in my earlier run. It needs its own balance pass.
- New cards, a free-play duel against the Bonewright, and any menu placement beyond one link.

## Why this is the deeper one

The Bonewright answers fire by replacing the troop you softened. That makes the Deadeye setup Kiro built a liability at the wrong moment: you spend the shot and the Dragon, and the target is gone before the clash. The same three clicks win in one position and lose in the other.

## The rival's visible response: Rebuild

> **The Bonewright.** When it moves after you, it rebuilds its weakest troop into a fresh Wizard.

- **The mark.** On any round you move first, while the Bonewright holds a Wizard and has not acted, its troop with the fewest orbs left is marked "Rebuilds here after your turn". Only a troop below its printed orbs can be marked. Ties go to the lower lane. The mark follows the board, so a Deadeye can move it.
- **The response.** On its turn it tributes the marked troop and summons a Wizard into that lane.
- **Otherwise** it plays as the Normal bot, which never spends those Wizards on its own.
- It uses only existing rules. The mark is the game's own language: the Lantern Wraith already telegraphs a lane this way.

## The arc, start to finish

About 32 clicks with no retries.

### 1. Boss: Ember Gulch (learn it)

Hunt rules as today: the boss side only ends its turn. Dragon Fire is on.

| | Lane 1 | Lane 2 | Lane 3 |
| --- | --- | --- | --- |
| Wizard (Base 5) | empty | Graveyard Dragon, 3 orbs, 3 attack | empty |
| Cowboy (Base 2) | empty | Sheriff, 1 orb | empty |

Hand: Billy, Deadeye, Sheriff, Sheriff. You move first.

Notice text: "Ember Gulch. The Graveyard Dragon breathes fire: what its blocker cannot absorb burns through to your Base."

| Line | Clicks | Result |
| --- | --- | --- |
| Solution | Billy into lane 2, tributing the wounded Sheriff. Deadeye on the Dragon. End turn. | Billy takes the hit (4 → 1) and nothing burns through. The Dragon falls. **Captured**, round 1, Base 2. |
| Tempting mistake | Deadeye on the Dragon. End turn. | The Sheriff has 1 orb, the Dragon hits for 3, and 2 burn through: Base 2 → 0. **Escaped.** |
| Slower capture | Billy into lane 2. End turn. Then Deadeye on the Dragon. | Captured in round 2. |

Of the 16 distinct first turns, 14 lose at once and one captures.

**What it teaches:** a wounded blocker does not stop fire, and a shot before the strike finishes the job.

### 2. Earn it

Result line: "You took the fire. Captured Dragon now burns through: damage beyond its blocker's last orb hits the Wizard Base." One button: "Face the Bonewright".

### 3. The Bonewright, same board twice

Round 7 of 9. Rival note on screen: the card text above.

| | Lane 1 | Lane 2 | Lane 3 |
| --- | --- | --- | --- |
| Bonewright (Base 3) | Wizard, 4 orbs | Skeleton, 2 orbs | Skeleton, 3 orbs |
| Cowboy (Base 2) | Sheriff, 2 orbs | Sheriff, 3 orbs | empty |

- Your hand: Captured Dragon, Deadeye, Sheriff. Your deck, top first: Sheriff, Billy, Sheriff.
- Bonewright's hand: Wizard, Skeleton. Its deck: Skeleton, Skeleton.

**Position A, "It has moved".** The Bonewright moved first this round and passed. No mark. End turn resolves the clash.

| Line | Clicks | What happens | Result |
| --- | --- | --- | --- |
| Fire now | Captured Dragon into lane 2, tributing the Sheriff there. Deadeye on the lane 2 Skeleton (2 → 1). End turn. | The Dragon hits for 4, the Skeleton has 1, and 3 burn through: Bonewright Base 3 → 0. | **Victory**, round 7, Base 1 |
| Hold | Sheriff into lane 3, then anything | Next round you move first, the mark appears, and lane 2 is rebuilt. | Best possible: draw, round 9 |

Only this first play wins. Every other one draws or loses.

**Position B, "You move first".** The same board. The lane 2 Skeleton carries the Rebuild mark.

| Line | Round 7 | Round 8 | Round 9 | Result |
| --- | --- | --- | --- | --- |
| Hold, then fire | Sheriff into lane 3. End turn. The Bonewright rebuilds lane 2 into a Wizard. Its reserve is spent. | It moves first and passes. Sheriff into lane 1, Deadeye on the lane 2 Wizard (3 → 2). End turn. | No mark. Captured Dragon into lane 2, tributing the lane 3 Sheriff. End turn. The Wizard has 1 orb and 3 burn through: Base 3 → 0. | **Victory**, round 9, Base 1 |
| Fire into the mark | Captured Dragon into lane 2, Deadeye on lane 2, End turn. The Bonewright rebuilds lane 2. The Dragon defeats the fresh Wizard exactly, nothing burns through, and the Wizard defeats the Dragon. | It adds a Skeleton. You have one summon against three attackers. | | **Defeat**, round 8 |

Sheriff into lane 3 is the only first play that can still win. Every Dragon play in round 7 loses.

Boards after each clash on the hold line, for checking:

- After clash 7: Cowboy Base 2, [empty, Sheriff 1, Sheriff 2]. Bonewright Base 3, [Wizard 3, Wizard 3, Skeleton 2].
- After clash 8: Cowboy Base 2, [Sheriff 1, empty, Sheriff 1]. Bonewright Base 3, [Wizard 2, Wizard 1, Skeleton 1].

### What the player should understand at the end

1. Dragon Fire sends whatever the blocker cannot absorb to the Base.
2. A Deadeye first makes it lethal.
3. The Bonewright replaces the marked troop when it moves after you. Fire when it has already moved, or make it spend the rebuild and fire later.

Closing line after position B: "Fire burns through what is already hurt. Strike after the Bonewright has moved, or let it spend its rebuild first."

## Three jobs for Kiro

The jobs share no files. They meet at three agreed names:

- `createMatch(seed, { dragonFire: true })` sets `state.dragonFire = { enabled: true }`, and the public view carries it.
- A burn-through is one extra `damage` event: same lane and attacker, target the Base, `fire: true`.
- The arc hands the UI one object, `model.fireArc = { stage, note, mark }`, where `mark` is a Wizard lane or null.

### Job 1: rules

**Owns:** `src/game/clash.js`, `src/game/state.js`, `src/game/view.js`, `src/game/cpu.js`, new `tests/game/dragon-fire.test.js`. Also `prototypes/dragon-fire/main.js` on `kiro/dragon-fire-combo`.

- On a `dragonFire` match, when the Wizard's Dragon or Captured Dragon hits a blocker that has fewer orbs than the attack, the difference comes off that side's Base in the same clash.
- The bots' clash projection in `cpu.js` counts the burn-through for both sides on such a match.
- Without the option, every match is unchanged.

**Tests:** Dragon (3 attack) against a 1-orb Sheriff takes 2 from the Cowboy Base. Captured Dragon (4) against a 1-orb Skeleton takes 3 from the Wizard Base. Against a 4-orb Wizard it takes none. An open lane behaves as today. Default seeds 690, 2328 and 468 and all ten hunts are unchanged.

**Playable finish line:** Kiro's existing Dragon Fire prototype page plays its three positions through the engine rule, with its page-side fire removed, and shows the same results as before.

### Job 2: encounter and rival behavior

**Owns:** new `src/game/fire-arc.js`, new `tests/game/fire-arc.test.js`, and the entry wiring in `src/graybox.js`.

- Ember Gulch as a built state. It is not on the Wanted board and does not count toward the five captures.
- The two Bonewright positions, with the hands and decks above.
- `rebuildMark(state)` and `rivalAction(state)` as described under Rebuild.
- `?mode=fire-arc` runs the stages in order: Ember Gulch, earn line, position A, position B. Restart replays the current stage. It is a draft: no counted win, no reward, no profile change.
- It fills `model.fireArc` with the stage name, the note text and the mark.

Until job 1 lands, set `state.dragonFire` directly on the built states.

**Tests:** the three Ember Gulch lines, the two position A lines and the two position B lines end as in the tables, with the boards listed after clashes 7 and 8. The mark is lane 2 in position B and absent in position A.

**Playable finish line:** `?mode=fire-arc` can be played from Ember Gulch to the end of position B in the graybox with today's screen, and each scripted line ends as the tables say.

### Job 3: player controls and feedback

**Owns:** `src/ui/cards.js`, `src/ui/card-model.js`, `src/ui/graybox.css`, `src/match/clash-forecast.js`, `src/match/summon-forecast.js`, `src/match/spell-forecast.js`, `src/match/clash-log.js`, and their tests under `tests/match/`.

Dragon Fire adds no control. The work is making it readable before the player commits.

- **Lane preview:** when a summon or shot would cause a burn-through, the preview says so, for example "Skeleton 1 → 0 · Dragon Fire: enemy Base 3 → 0". It warns on your side too: "Dragon Fire: your Base 2 → 0".
- **Rebuild mark:** the marked Wizard lane gets the dashed outline the Wraith's mark uses, with the label "Rebuilds here after your turn". The preview for a play into that lane adds "The Bonewright still acts."
- **Clash log:** "Dragon Fire burned through: Wizard Base 3 → 0."
- **Notes:** show `model.fireArc.note` in the existing note line.
- **After a loss:** one sentence naming the cause, for example "The Bonewright rebuilt lane 2 before the clash, so nothing burned through."

Until job 2 lands, test against hand-built states in `tests/match/`, as the Wraith mark tests do.

**Playable finish line:** with jobs 1 and 2 merged, a person who is told nothing can say which lane will burn through, and which lane will be rebuilt, before pressing End turn in each position.

## What would change my mind

- Testers fire into the mark in position B, lose, and cannot say why. Then the mark is not reading, and feedback comes before any more depth.
- Testers find position A's win by reflex and hold in position B by reflex. Then the pair teaches "look at who moved" and nothing about fire, and the rival needs a second position where firing away from the mark is right.
- The Bonewright's pass in position A reads as the game being stuck. Then give it a visible move there, such as summoning the lane 3 Skeleton that turn.

## Back to Fable

- Any line that does not reproduce.
- Putting Dragon Fire on the real card, or the Bonewright into free play. Both need a balance run first.
- The Wraith. Once this arc has been played, its rival is the next brief.
