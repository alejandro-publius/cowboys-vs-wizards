# Mounted Billy: keep, simplify or cut

November 18, 2026, Pacific. Claude Code (Fable 5.2) ran this on `claude/graybox-mounted-billy`, branched from `2575ea0`. It follows the deck-swap result in [the card experiments note](codex-card-rd.md). No card, rule or shipped file changed. The alternative exists only in a patched copy that `scripts/mounted-billy-lab.mjs` writes under `.artifacts/`.

## Recommendation

Keep Mounted Billy and keep his two-tribute cost. Do not cut him, and do not make him cheaper. Take one change to a human playtest before deciding anything else: attack 3 → 4.

- **Cutting him is not what made Deadeye Control strong.** The third Deadeye did that. With Mounted Billy simply never summoned, the starter deck's result moves by 1.6 points against the Normal bot and 2.7 the other way against Hard.
- **Cutting him removes no rule.** The Dragon still needs two tributes.
- **Today the commit is mostly a trap.** Against the Hard bot, committing at the first chance is the worse choice twice as often as the better one.
- **Attack 4 gives him one job a player can say out loud:** he removes any blocker except the Dragon in a single clash. At attack 3 he does that only to a Skeleton, and the Wizard answers by upgrading the blocker.

## Bot results

Seeds 32000–33023, each side acting first once per seed, 2,048 matches per row, stock Wizard deck. The share counts a win as 1 and a draw as 0.5. Changes are paired by seed against the starter row, with 95% intervals.

| Cowboy deck | Normal share | Change | Hard share | Change |
| --- | --- | --- | --- | --- |
| Starter (6 Sheriff, 3 Billy, 1 Mounted Billy, 2 Deadeye) | 49.39% | | 48.80% | |
| Starter, Mounted Billy never summoned | 51.00% | +1.61 (+0.85 to +2.37) | 46.14% | −2.66 (−4.02 to −1.30) |
| Starter with a fourth Billy in his place | 53.86% | +4.47 (+3.46 to +5.48) | 48.05% | −0.76 (−2.13 to +0.62) |
| Deadeye Control (third Deadeye in his place) | 61.84% | +12.45 (+10.94 to +13.96) | 61.18% | +12.38 (+10.75 to +14.01) |
| Starter, Mounted Billy at attack 4 | 57.52% | +8.13 (+6.66 to +9.60) | 52.15% | +3.34 (+2.20 to +4.49) |

The starter is close to even against the stock Wizard deck on these seeds. Deadeye Control puts the Cowboy near 62% under both bots, so it is a stronger deck, and that is a separate balance question about Deadeye.

The bots summoned Mounted Billy in 429 Normal matches and 557 Hard matches out of 2,048. At attack 4 they summoned him in 1,167 and 712.

## The choice between two defenders and the finisher

Each match was split at the first turn where Mounted Billy could be summoned. One branch committed in each legal lane. The other made the bot's best play without him that turn, and could still summon him later. The same bot finished every branch.

| First chance to summon him | Normal, attack 3 | Normal, attack 4 | Hard, attack 3 | Hard, attack 4 |
| --- | --- | --- | --- | --- |
| Boards | 1,468 | 1,468 | 1,349 | 1,349 |
| Same result either way | 969 | 974 | 718 | 732 |
| Committing in the best lane was better | 270 | 366 | 209 | 272 |
| Keeping the defenders was better | 229 | 128 | 422 | 345 |
| Cowboy share when keeping | 54.50% | 58.55% | 48.18% | 49.11% |
| Cowboy share when committing, best lane | 57.25% | 71.05% | 37.29% | 46.29% |
| Cowboy share when committing, average lane | 43.72% | 58.90% | 29.17% | 35.40% |
| Boards where the bot itself committed | 107 | 931 | 437 | 578 |

The best lane is picked with hindsight, so that row flatters committing. The average-lane row is the pessimistic reading.

At attack 3 the choice changes the result on about a third of Normal boards and half of Hard boards. Against Hard it leans hard toward keeping. At attack 4 the Hard split is closer to even (272 to 345). Against Normal it tips the other way (366 to 128), so there the finisher is usually right and the choice is thinner. That is the main cost to watch, along with the Cowboy gaining 8 points against Normal.

## Why attack 4, and what was rejected

Wizard blockers have 3 orbs (Skeleton), 4 (Wizard) and 5 (Dragon). Attack 4 clears the first two in one clash and leaves an unblocked full Base on its last orb. It changes one number on one card and adds no rule. A 7-star Mounted Billy would then hit harder than the 8-star Dragon, which stays at attack 3.

A smaller screening run on seeds 30000–30511 (1,024 matches per row, an uncommitted harness) tried three other one-number changes. The starter scored 46.9% Normal and 45.9% Hard on those seeds.

| Change to Mounted Billy | Normal share | Hard share | Why not |
| --- | --- | --- | --- |
| One tribute (6 stars) | 71.7% | 71.8% | Too strong, and committing was better on 201 boards against 12, so no choice is left |
| Health 7 | 49.7% | 51.0% | Makes a wall. A finisher's job is to end the game |
| Attack 4 with health 4 | 50.9% | 46.1% | No gain against Hard |

## One board to play: seed 823

Build the two pages, then open each with the same address ending. The Wizard is the Normal bot and the Cowboy acts first in round 1.

```sh
node scripts/mounted-billy-lab.mjs --build
python3 -m http.server 8790 --bind 127.0.0.1 --directory dist/mounted-billy
```

- Current card: `http://127.0.0.1:8790/current.html?mode=match&deck=starter&seed=823`
- Attack 4: `http://127.0.0.1:8790/attack-4.html?mode=match&deck=starter&seed=823`

The browser tab title names the version. The steps are the same on both pages.

1. Round 1: summon a Sheriff in lane 1. End turn.
2. Round 2: summon a Sheriff in lane 2. End turn.
3. Round 3 is the board. You have a Sheriff on 1 orb in lane 1 and a Sheriff on 2 orbs in lane 2. The Wizard has a Skeleton on 1 orb in lane 1 and a Skeleton on 2 orbs in lane 2. Both Bases have 5 orbs. Your hand is Sheriff, Billy, Mounted Billy and Deadeye.

**Commit.** Select Mounted Billy, pick both Sheriffs as tributes, place him in lane 2 and confirm. Cast Deadeye on the Skeleton in lane 1. End turn. The lane preview promises a dead Skeleton, and the Wizard then replaces that Skeleton with a 4-orb Wizard.

- Current card: the Wizard survives the clash on 1 orb. In round 4, summon a Sheriff in lane 1 and end the turn. Singularity and the Wizard's hit finish Mounted Billy in that clash. You are back to one Sheriff against one Skeleton with both Bases at 5. Played on by the bots, the Wizard side wins 3 orbs to 2 at the round limit.
- Attack 4: the Wizard dies in the round 3 clash. Round 4: summon a Sheriff in lane 1, end turn. Round 5: summon a Sheriff in lane 3, end turn. The Wizard Base falls in round 5.

**Keep.** Summon the Sheriff in lane 3, cast Deadeye on the Skeleton in lane 1, end turn. Both older Sheriffs die in that clash anyway, one to Singularity and one to the new Wizard. With Mounted Billy left in hand for the rest of the match, the bots reach a 2–2 draw at the round limit on both pages.

| Seed 823, round 3 | Keep | Commit |
| --- | --- | --- |
| Current card | Draw, round 9 | Wizard wins, round 9 |
| Attack 4 | Draw, round 9 | Cowboy wins, round 5 |

I clicked the commit route to its end and the keep route through round 3 on both built pages in headless Chrome. The pages showed the same clashes as the script, including "Victory. A Base fell in round 5." on the attack-4 page. The rounds after that on the keep route and on the current card's commit route come from the script alone.

Seed 850 with `&cpu=hard` gives the same four results against the Hard bot. That one is from the script and was not clicked through.

## What a human playtest should answer

At the round 3 board, before any result is shown: does the player see a real choice between holding two wounded Sheriffs and riding in with Mounted Billy, and can they say what he is for?

Record the choice and the reason on each page. The bots cannot tell whether attack 4 makes the commit feel earned or simply obvious, and their Normal results suggest it could be the second.

## Limits

- Every number here is a bot playing a bot, against one Wizard deck.
- The board is one seed chosen from the first 1,500 seeds because committing wins there only at attack 4. It illustrates the difference and does not measure how often it happens.
- Deadeye Control was compared in the bot table. It was not played on the seed 823 board, because a different deck deals different hands. To play it, open `current.html` with no address ending, choose Build Deck, Load Deadeye Control, then Save deck.

## Reproduce

```sh
node scripts/mounted-billy-lab.mjs                           # both tables, about 80 seconds
node scripts/mounted-billy-lab.mjs --board 823               # the four seed 823 endings, move by move
node scripts/mounted-billy-lab.mjs --board 850 --cpu hard
node scripts/mounted-billy-lab.mjs --build                   # dist/mounted-billy/current.html and attack-4.html
```

The script stops if its patched copy still loads the shipped card, or if the two rule sets do not reach the same board.
