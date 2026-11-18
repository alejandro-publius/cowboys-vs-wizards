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

```sh
node scripts/mounted-billy-lab.mjs --build
```

Open `dist/mounted-billy/attack-3.html` and `dist/mounted-billy/attack-4.html` in a browser. They need no server and no address ending. The tab title and the line under the heading name the version, and Mounted Billy's attack is the only difference between the two files.

Each page deals seed 823 with the starter deck, lets the Normal bots play rounds 1 and 2 (a Sheriff into lane 1, then one into lane 2) and hands over at round 3. The Wizard is the Normal bot. **Replay this deal** on the result screen, or Restart in the ☰ menu, returns to the same board.

You have a Sheriff on 1 orb in lane 1 and a Sheriff on 2 orbs in lane 2. The Wizard has a Skeleton on 1 orb in lane 1 and a Skeleton on 2 orbs in lane 2. Both Bases have 5 orbs. Your hand is Sheriff, Billy, Mounted Billy and Deadeye.

**Commit.** Select Mounted Billy, pick both Sheriffs as tributes, place him in lane 2 and confirm. Cast Deadeye on the Skeleton in lane 1. End turn. The lane preview promises a dead Skeleton, and the Wizard then replaces that Skeleton with a 4-orb Wizard.

- Attack 3: the Wizard survives the clash on 1 orb. In round 4, summon a Sheriff in lane 1 and end the turn. Singularity and the Wizard's hit finish Mounted Billy in that clash. You are back to one Sheriff against one Skeleton with both Bases at 5. Played on by the bots, the Wizard side wins 3 orbs to 2 at the round limit.
- Attack 4: the Wizard dies in the round 3 clash. Round 4: summon a Sheriff in lane 1, end turn. Round 5: summon a Sheriff in lane 3, end turn. The Wizard Base falls in round 5.

**Keep.** Summon the Sheriff in lane 3, cast Deadeye on the Skeleton in lane 1, end turn. Both older Sheriffs die in that clash anyway, one to Singularity and one to the new Wizard. With Mounted Billy left in hand for the rest of the match, the bots reach a 2–2 draw at the round limit with either card.

| Seed 823, round 3 | Keep | Commit |
| --- | --- | --- |
| Attack 3 | Draw, round 9 | Wizard wins, round 9 |
| Attack 4 | Draw, round 9 | Cowboy wins, round 5 |

I opened both pages in headless Chrome with no address ending and clicked through them. Both opened on the board above. The commit route ended in "Victory. A Base fell in round 5." on the attack-4 page and with Mounted Billy defeated in the round 4 clash on the attack-3 page. Restart and **Replay this deal** each returned to the same board and hand. The round-9 results in the table come from the script, where the bots play on.

Codex rebuilt both pages, reproduced the two SHA-256 hashes from the handoff, and independently played the full commit route in Safari. Both versions opened on the same round-three board and hand. Attack 3 left the Wizard on one orb and ended in a round-nine defeat. Attack 4 removed the Wizard and ended in a round-five victory. Replay restored the decision on both pages. The keep-route round-nine draws were verified by the engine trace.

`--board 850 --cpu hard` prints the same four results against the Hard bot. That board comes from the script only. The pages do not open on it.

## Two follow-up boards: seeds 254 and 167

Seed 823 shows attack 4 paying off. These two boards show where it does not, and where the answer changes between the pages.

**How they were found.** `--scan --from 0 --count 2000` deals seeds 0–1999 as the pages do: starter deck, the seed's own first seat, Normal bots, stopped at the first turn Mounted Billy can be summoned. That gives 1,466 boards. On each board the Normal bots finish one line where he stays in hand for the rest of the match (keep) and one line for each lane he can enter now (commit), at attack 3 and at attack 4.

| Seeds 0–1999, Normal bots | Boards |
| --- | --- |
| Reached a Mounted Billy decision | 1,466 |
| Keeping beats committing in every lane at attack 4 | 136 |
| Of those: only Sheriffs on the board, keeping wins and every commit lane loses, at both attack values | 23 |
| Best choice flips from keep at attack 3 to commit at attack 4 (seed 823 is one) | 20 |
| Best choice flips from commit at attack 3 to keep at attack 4 (seed 17) | 1 |

- **Seed 254** is the lowest of the 23 that has the same six lanes as seed 823 and a Sheriff in hand, so keeping costs no tribute. Seed 4 is lower and has the same lanes, but its hand has no Sheriff. Seeds 11 and 43 have other lanes.
- **Seed 167** is the lowest of the 20 with only Sheriffs on the Cowboy side. Seed 81 is lower and has a Billy on the board.

**Links.** After `--build`, open `dist/mounted-billy/index.html`. It links each board on both pages and names no outcome. The address endings are `?mode=match&deck=starter&seed=254` and `?mode=match&deck=starter&seed=167` on `attack-3.html` and `attack-4.html`. **Replay this deal** and Restart return to the board, as on seed 823.

**The boards.**

- Seed 254, round 3. Same lanes as seed 823: your Sheriffs on 1 and 2 orbs in lanes 1 and 2, Skeletons on 1 and 2 orbs across from them, lane 3 empty, both Bases on 5. The hand is Mounted Billy, Billy, Sheriff, Billy. Seed 823 had a Deadeye where this hand has a second Billy.
- Seed 167, round 3. The same lanes again, plus a fresh Skeleton in the Wizard's lane 3, because the Wizard acted first this round. The hand is Billy, Sheriff, Mounted Billy, Billy.

Play both pages before reading on.

### Outcome notes

These are the bots' lines from `--board 254` and `--board 167`. A player can do better or worse than either.

| Round 3 choice | Seed 254, attack 3 | Seed 254, attack 4 | Seed 167, attack 3 | Seed 167, attack 4 |
| --- | --- | --- | --- | --- |
| Keep (Sheriff into lane 3) | Cowboy wins, round 9 | Cowboy wins, round 9 | Draw, round 9 | Draw, round 9 |
| Commit (any lane) | Wizard wins, round 5 | Wizard wins, round 5 | Wizard wins, round 4 | Cowboy wins, round 6 or 7 |

**Seed 254: keeping wins at both attack values.** With no Deadeye, nothing removes the Skeleton in lane 1 once its Sheriff is tributed. The Wizard does not block Mounted Billy. It turns that Skeleton into a Wizard and races through the two lanes the tribute opened, and the Cowboy Base goes 5, 3, 2, 0. Attack 4 only changes how close the race is: the Wizard Base ends on 2 orbs at attack 3 and on 1 at attack 4.

**Seed 167: the best choice flips.** At attack 3 the Wizard answers the tribute by sacrificing two Skeletons for the Dragon in lane 3. The Dragon takes the last 3 orbs of the Cowboy Base in round 4, while Mounted Billy and a Sheriff leave the Wizard Base on 1. At attack 4 the same race would empty both Bases in the same clash, so the Normal bot blocks Mounted Billy every round and never plays the Dragon. The Cowboy wins in round 6 if he enters lane 1 and in round 7 otherwise. I take the block to follow from the bot's penalty for losing its own Base. I did not test that separately.

**Seed 17 is the one flip the other way,** at round 8. At attack 3 the Wizard gambles on the Dragon in round 9 and loses the round-limit count 3 orbs to 1. At attack 4 it has to block instead, and wins the count 4 to 2. It reads as a bot mistake that attack 4 happens to prevent. It is not on the link page; the address ending with `seed=17` opens it.

I followed the link page to all six board pages in headless Chrome. For each seed the attack-3 and attack-4 pages opened on the same lanes, Bases and hand, with only Mounted Billy's printed attack differing. I then clicked the bots' commit line and keep line on every page, twelve lines in all, and each ended with the result and round in the table. Replay this deal after each line, and Restart from the ☰ menu mid-match, restored the board and hand every time. No page errors.

## What a human playtest should answer

At the round 3 board, before any result is shown: does the player see a real choice between holding two wounded Sheriffs and riding in with Mounted Billy, and can they say what he is for?

On seed 254 the lanes are the same as on seed 823 and only the hand differs: does the player notice that the missing Deadeye changes the answer? On seed 167: does the choice on the attack-4 page feel different from the same board on the attack-3 page before any clash is shown?

Record the choice and the reason on each page. The bots cannot tell whether attack 4 makes the commit feel earned or simply obvious, and their Normal results suggest it could be the second.

## Limits

- Every number here is a bot playing a bot, against one Wizard deck.
- Seed 823 was chosen from the first 1,500 seeds because committing wins there only at attack 4. Seeds 254 and 167 were picked by the rules above from the scan of seeds 0–1999. Each illustrates one case. The scan counts say how often each case occurred under the Normal bots, with "keep" meaning he is never summoned.
- Deadeye Control was compared in the bot table. It was not played on the seed 823 board, because a different deck deals different hands. To play it, run `npm run build`, open the ordinary graybox page and choose Build Deck, Load Deadeye Control, then Save deck.

## Reproduce

```sh
node scripts/mounted-billy-lab.mjs                           # both tables, about 80 seconds
node scripts/mounted-billy-lab.mjs --board 823               # the four seed 823 endings, move by move
node scripts/mounted-billy-lab.mjs --board 850 --cpu hard
node scripts/mounted-billy-lab.mjs --scan --from 0 --count 2000   # the follow-up board counts and seeds
node scripts/mounted-billy-lab.mjs --board 254
node scripts/mounted-billy-lab.mjs --board 167
node scripts/mounted-billy-lab.mjs --build                   # dist/mounted-billy/index.html, attack-3.html and attack-4.html
```

The script stops if its patched copy still loads the shipped card, if the two rule sets do not reach the same board, or if the two built pages differ by anything other than the digit 3 against 4 in the title, the lab line and the card.
