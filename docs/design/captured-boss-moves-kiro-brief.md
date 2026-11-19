# Captured bosses give you the moves you learned to fight

Fable 5.2, November 18, 2026, Pacific. Written against `f42e767` on `fable/first-player`, with Kiro's drift prototype at `a9cf888` (`kiro/wraith-drift-prototype`) as the model. No production code or art was touched.

The boards and bot numbers come from scratch copies of `src/game` under `.artifacts/boss-lab/`. No person has played either power, and nothing was clicked in a browser.

## The idea

A hunt teaches one move. Capturing the boss should hand that move to the player, so the reward card plays unlike anything in the starter deck. Today both rewards are stat lines. Kiro's prototype gives the Captured Wraith the drift it used against you. This brief pitches one other Wraith power and one Dragon power, and picks one to build next.

## Pitch 1, Wraith: Ghost Walk

> **Captured Wraith.** Nothing blocks Captured Wraith and it blocks nothing: it strikes the Wizard Base, and the troop across from it strikes yours.

- **What you learned fighting it.** The Lantern Wraith went for the lane you left open, and the only answer was to be standing where it was going. Now it is your ghost, and no wall stops it. It also guards nothing, which is the lesson of Gallows Lantern turned around.
- **How it changes a lane.** The Wraith's lane becomes a race for as long as it stands. Across a Skeleton, each clash costs the Wizard Base 2 and yours 1. Across a Dragon it costs you 3.
- **How it differs from the drift.** The drift asks which lane, once, after the Wizard commits. Ghost Walk asks whether to open a race at all, and the answer lasts until the Wraith is removed.
- **Risk.** Troops cannot hurt it, so only Singularity removes it. That is a clock the Wizard has two cards to stop. It needs a bot that understands the rule before any balance run, and none exists.

This pitch is unbuilt and untested.

## Pitch 2, Dragon: Dragon Fire

> **Captured Dragon.** When Captured Dragon's attack is more than its blocker has orbs left, the rest burns through to the Wizard Base.

- **What you learned fighting it.** The Dragon hunts teach "soften it, then strike": Deadeye first, then the troop that finishes it. Dragon Fire pays for the same sequence from the other side. Shoot a blocker down, then burn through it.
- **How it changes a lane.** Today a blocker absorbs a whole attack, however small the blocker. With Dragon Fire a wounded blocker no longer protects the Base, so the right lane for the Dragon is the one with the weakest troop in it. An open lane is no longer the only way to reach the Base.
- **Cost.** One sentence that breaks one rule every player has already felt. No new button, no new state. The lane preview already comes from the clash resolver, so it would show the Base hit.
- **Presentation.** It needs no new art or motion: the Dragon's existing attack, plus the existing Base hit.

## Build Dragon Fire first

- **It changes where you put the card**, on every board, with no extra click. Ghost Walk and the drift both answer the same block-or-race question the game already asks in round 1.
- **It gives Deadeye a second job**, which suits the Dragon Posse list of three Deadeyes.
- **It is the smaller build.** One prototype page with two boards, in the shape Kiro already made for the drift.
- **Ghost Walk carries more risk**: an attacker that combat cannot remove.

### What the bots say, and what that means

Dragon Posse (6 Sheriff, 2 Billy, 3 Deadeye, 1 Captured Dragon) against the same list with a Billy in the Dragon's slot. Seeds 95000–95499, both first seats, 1,000 matches per cell, Normal and Hard bots, win share in points (a draw counts half). For the fire rows I also taught the bots' scoring about the spill.

| Captured Dragon | Default, Normal | Default, Hard | Stargazer, Normal | Stargazer, Hard |
| --- | ---: | ---: | ---: | ---: |
| Today (2 orbs, 3 attack) | −8.4 | −8.0 | −6.9 | −9.5 |
| Dragon Fire, 3 attack | −9.4 | −12.1 | −11.9 | −9.4 |
| Flat 4 attack, no power | +2.0 | +1.1 | +5.1 | +2.3 |
| Dragon Fire and 4 attack | +4.7 | +7.5 | +2.6 | +11.4 |

- **Dragon Fire does not fix the card's strength.** At 3 attack the bots do no better with it than with today's card. They chase the spill into blocked lanes and take fewer open ones.
- **It stacks with the attack change.** Fire on top of 4 attack is too strong under the Hard bot.
- **So keep the two questions apart.** The 4-attack change in `dragon-balance-kiro-brief.md` answers "is the reward worth playing". Dragon Fire answers "does it play like a Dragon". Do not ship both without a new run. Build the prototype at today's stats and let a person judge the feel first.

The bots look one or two clashes ahead and do not plan a Deadeye-then-Dragon turn. A person might get more from the power than these numbers show.

## The two boards

Both boards put you second in the round: the Wizard has acted, and End turn resolves the clash. Hand in both: Captured Dragon, Sheriff. The Dragon has today's stats, 2 orbs and 3 attack. Every result below was resolved in the scratch copy.

### Board 1, "Burn through": using it pays off

| | Lane 1 | Lane 2 | Lane 3 |
| --- | --- | --- | --- |
| Wizard (Base 2) | Skeleton, 1 orb | Wizard, 4 orbs | Skeleton, 3 orbs |
| Cowboy (Base 3) | Sheriff, 2 orbs | Sheriff, 3 orbs | empty |

| Choice | What the clash does | Result |
| --- | --- | --- |
| Captured Dragon into lane 1, tributing the Sheriff there | The Dragon defeats the 1-orb Skeleton and 2 damage burns through: Wizard Base 2 → 0. Your Base 3 → 2 from lane 3. | **Victory** |
| Hold: Sheriff into lane 3 | Every lane is blocked. No Base is hit. | The duel goes on at 3 and 2 |
| Captured Dragon into lane 3 | It defeats the 3-orb Skeleton exactly. Nothing burns through. | The duel goes on |
| Captured Dragon into lane 2 | The Wizard survives on 1 orb and the Dragon falls. | The duel goes on |

Without Dragon Fire no play on this board reaches the Wizard Base. With it, only the lane with the weakest blocker wins.

### Board 2, "Last stand": holding it is better

| | Lane 1 | Lane 2 | Lane 3 |
| --- | --- | --- | --- |
| Wizard (Base 5) | Skeleton, 3 orbs | Wizard, 4 orbs | Skeleton, 3 orbs |
| Cowboy (Base 1) | Sheriff, 2 orbs | Sheriff, 3 orbs | empty |

| Choice | What the clash does | Result |
| --- | --- | --- |
| Hold: Sheriff into lane 3 | Every lane is blocked. No Base is hit. | The duel goes on at 1 and 5 |
| Captured Dragon, any lane and any tribute | Every blocker is too healthy for anything to burn through, and the tribute leaves a lane open. Your Base 1 → 0. | **Defeat**, all four ways |

The same lanes as Board 1 with fresh blockers and a Base on its last orb. The Dragon costs a troop to bring out, and here that troop was the wall.

## Smallest build

A prototype page beside the drift one, not a change to the game.

1. `prototypes/dragon-fire/`, copied from `prototypes/wraith-drift/` at `a9cf888`: the same layout, two position buttons ("Burn through", "Last stand"), a Reset.
2. Two choice buttons per position: "Dragon into lane 1" and "Hold: Sheriff into lane 3". On Board 2 the Dragon button may use any lane; all four lose.
3. Resolve with the production clash, then apply the fire in the page: if the Dragon faced a troop with fewer orbs than its attack, take the difference from the Wizard Base, add one line to the event list ("Dragon Fire burned through: Wizard Base 2 to 0."), and judge the result after that. Damage in a clash is simultaneous, so this matches a rule inside the resolver.
4. Keep the drift page's "Why" and "Other choice" lines.
5. Nothing under `src/`. No card stat, no art.

## Acceptance cases

1. Burn through, Dragon into lane 1: the Skeleton is defeated, Wizard Base 2 → 0, your Base 3 → 2, "You win".
2. Burn through, Hold: no Base changes, the lane-1 Skeleton is defeated by the Sheriff, both Bases survive.
3. Last stand, Hold: Bases stay at 1 and 5.
4. Last stand, Dragon: your Base 1 → 0, "You lose", and no fire line appears.
5. The drift prototype and the production build are unchanged.

## What a person has to show

- On Burn through, do they find lane 1 unprompted, and can they say why lane 3 would not have worked?
- On Last stand, do they hold, or do they summon the Dragon because it is the exciting card?
- Does "the rest burns through" make sense from the card line alone?

Drop the power if testers cannot predict the Base hit before they press the button. Bring Ghost Walk forward if Dragon Fire reads as "more damage" and nothing more.

## Back to Fable

- Which Wraith power to keep, once people have tried the drift page. Ghost Walk stays a pitch until then.
- Any plan to put Dragon Fire on the real card. It needs a fresh balance run against whatever attack value the card has by then.
