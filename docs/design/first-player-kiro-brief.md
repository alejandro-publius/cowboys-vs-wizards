# First player: a three-minute playtest and one onboarding change

Fable 5.2, November 18, 2026, Pacific. Written against `f42e767` on `fable/first-player`. No production code, art, animation or card was touched.

**No person has played this.** Everything marked *simulated* below comes from one of two places: bot runs on a scratch copy of `src/game`, or me driving the built graybox page in headless Chrome on a fresh profile and reading what it shows. Neither is a first-time player. The playtest in this brief exists to replace those guesses with observations.

## Recommendation

Make a new player's first **Play** start the guided duel that already exists, and run the three-minute playtest below before treating that as an improvement.

Today the guided duel is two clicks away from where a newcomer goes. Play deals a random, unguided duel.

## The actual entry flow

1. The page opens on a title menu: Play, Wanted, How to Play, Build Deck, Achievements. Play has focus.
2. Play starts a standard duel: a random seed, the starter deck, the Normal Wizard, no hints.
3. The guided duel (seed 690, with one hint line a turn) starts only from How to Play → Start guided duel.

## Where a newcomer may stall first

*Simulated.* The first spot is the first match screen after Play.

| What the screen shows (fresh profile, headless Chrome) | After Play today | In the guided duel |
| --- | --- | --- |
| An instruction before any card is selected | none | "Choose a highlighted card, or end your phase. Put Sheriff across from the Skeleton to protect your Base, or choose an open lane to trade Base damage." |
| The goal of the game | not stated | not stated outright; the hint mentions protecting your Base |
| Labelled action buttons near the board | End turn only | End turn only |

- The idle prompt exists in the rules layer ("Choose a glowing card, or end your phase."), but the panel that shows it stays hidden until a card is selected, unless the guide is on.
- The goal sentence lives only on the How to Play page.
- End turn is the one obvious button. Pressed first on seed 690, it costs a Base orb and moves to round 2.

What the random deal adds, from bot runs:

| Simulated, default Play deals | Result |
| --- | --- |
| First hand with nothing to summon (only End turn works), 4,000 deals | 3.4% |
| Cowboy acts first on an empty board, same deals | 49.6% |
| Careless play (any legal move at random, never passing while a summon is possible), 500 deals, 8 runs each | wins 3.5%, draws 6.3% |
| The same careless play on seed 690, 2,000 runs | wins 44.4%, draws 23.8% |
| Normal bot playing the Cowboy, 2,000 deals | 35.5 clicks and 7.2 rounds a duel, wins 41.9% |
| Seed 690 | winnable in 12 clicks (round 3); the Normal bot's own line takes 25 clicks (round 5) |

A random first duel will rarely finish inside three minutes, and a careless newcomer almost always loses it. Seed 690 was chosen for the first-session brief because it forgives mistakes.

## The change

**When Play is pressed on a profile with no completed duel, and the page address has no ending, start the guided duel.** That is the existing duel: seed 690, starter deck, Normal Wizard, the hint line.

Add the goal to its first screen: show the existing How to Play sentence, "You lead the Cowboys. The computer commands the Wizards. Break the enemy Base before yours falls.", as the note line during round 1.

Everything else stays:

- From the second duel on, Play deals a random unguided duel as today.
- How to Play → Start guided duel remains.
- Any address ending (`?seed=`, `?mode=`, `?wizard=` and the rest) keeps today's behaviour, so every recorded link and browser check is unaffected.
- The guided duel already counts as the first duel, so its result screen already offers the Lantern Wraith notice.

**Cost.** A returning player on a new browser gets one hinted duel. A player who wanted a random first deal has to finish or restart one fixed duel first.

If scope must shrink, drop the goal sentence and keep the routing.

## The three-minute playtest

**Who.** Someone who plays strategy or card games and has never seen this game. At least three people per arm. Each person can only be a first-timer once, so the arms are different people.

**Setup.** Desktop browser, a fresh private window, the built graybox page. Record the commit, browser, screen and voice (with consent).

**Seed.** Both arms play **seed 690**, starter deck, Normal Wizard.

| Arm | Page address | What it is |
| --- | --- | --- |
| A, today | the page with `?seed=690` | Play deals seed 690 with no hints |
| B, the change | the page with no ending, on a build with the change | Play deals seed 690 with hints and the goal line |

Arm A can be run now, before anything is built. It is kinder than the real flow, which deals a random seed; the simulated table above covers that difference.

**Moderator script, word for word.** "This is a card game. Play it for three minutes. I can't answer questions while you play. Please say what you're thinking out loud."

Give no task, no goal and no prompt. Start the clock when the page is visible. Stop at 3:00 whatever is on screen.

**What to record.**

| # | Observation | How to see it |
| --- | --- | --- |
| 1 | Time to pressing Play, and anything opened first | screen |
| 2 | Time to the first troop on the board, and wasted clicks before it | screen |
| 3 | Time to the first End turn, and whether it came before any summon | screen |
| 4 | Their words at the first clash | voice |
| 5 | The longest pause without input, when it began and what was on screen | screen |
| 6 | Whether How to Play was opened, and when | screen |
| 7 | Round reached, or the result, at 3:00 | screen |
| 8 | In arm B: whether they read or used the hint line | voice |

**After the clock stops, ask two questions and write the answers down word for word.**

1. "What are you trying to do in this game?"
2. "What happened in the last clash you saw, and why?"

**A session counts as a success when all of these hold.** The time limits are my proposals, not measurements.

- A troop is on the board within 60 seconds.
- The first End turn comes after a summon, within 90 seconds.
- Round 3 or a result is reached by 3:00.
- Answer 1 mentions breaking or destroying the enemy Base.
- Answer 2 matches the clash log on screen.

## What a real tester must show before this counts as a win

Report counts, never percentages, as the existing protocol requires.

1. **The stall is real.** In arm A, at least two of three testers either pause for ten seconds or more on the first match screen, press End turn before summoning, or cannot state the goal afterwards. If arm A testers sail through, the premise is wrong: keep today's flow and do not ship the change.
2. **The change removes it.** In arm B, every tester has a troop on the board within 60 seconds and ends a turn after summoning, without opening How to Play.
3. **They know what they are doing.** More arm B testers than arm A testers state the goal correctly, and at least two of three in arm B do.
4. **The hint is used.** At least one arm B tester reads the hint aloud or repeats its block-or-trade idea in their own words. If nobody notices it, the routing may still help through the fixed seed, but the hint line has not earned its place.
5. **Nothing got slower.** Arm B's middle time to the first troop is no longer than arm A's.

Cut the change if arm B is no better on points 2 and 3, or if arm B testers say the hint told them what to do and left them nothing to decide.

One thing three minutes cannot show: whether players are lost when their second duel arrives with no hints. Watch for it in the longer protocol in `docs/submission/judge-demo-script.md`.

## Smallest implementation scope

1. In the Play handler: start the guided duel when the profile has no completed duel and the address has no ending.
2. Show the goal sentence as the guided duel's round-1 note.
3. Nothing else. No rule, card, balance, art or animation change. The illustrated build is out of scope.

The pending Captured Dragon change in `dragon-balance-kiro-brief.md` does not touch this: the starter deck holds no Captured Dragon and the three minutes end long before any reward.

## Acceptance cases

1. Fresh profile, no address ending, Play: seed 690, round 1, a Skeleton in Wizard lane 1, hand Sheriff, Sheriff, Deadeye, Billy. The hint line and the goal sentence are visible before any card is selected.
2. On that duel, Sheriff into lane 2, then lane 3, then lane 1, ending the turn after each: Victory in round 3 with Cowboy Base 2. The result screen shows the Wraith notice and "Take the notice".
3. After one completed duel, Play deals an unpinned random seed with no hint line.
4. Fresh profile with `?seed=690`, Play: the same deal with no hint line and no goal sentence. This is arm A.
5. `?mode=match&deck=starter&seed=0` and the other recorded links behave as at `f42e767`.
6. How to Play → Start guided duel still starts the guided duel. Restart inside the first duel returns to seed 690 with hints.
7. Hunts, the Stargazer and Imp duels, practice and both posse duels are unchanged.

Cases 2 and 4 were checked on the current build in headless Chrome, through the How to Play route for case 2. Cases 1, 3 and 6 describe the change and are unbuilt.

## Back to Fable

- The arm A results, as soon as three sessions exist. They decide whether this ships.
- Any tester whose first stall is somewhere else. That spot becomes the next brief.
