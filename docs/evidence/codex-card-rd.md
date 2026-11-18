# Graybox card design experiments

November 17, 2026 Pacific. This note covers Codex's work. The Kiro and Antigravity jobs have separate worktrees and receipts.

## Make the existing lane choice readable

Mark Rosewater describes how a simple game element can carry depth that becomes apparent as players learn its interactions. The duel already gives a troop a tactical role depending on whether it holds a lane or pressures an empty one. The graybox now previews the lane's immediate exchange before a player commits a summon. [Living in Synergy](https://magic.wizards.com/en/news/making-magic/living-synergy-2013-02-25)

The preview uses the engine's existing simultaneous-clash resolver and copies only the public state needed for the candidate lane. It appears for legal placement lanes after any tributes have been selected. It assumes the visible board stays in place. It disappears on cancel and when the game advances. The experimental trap match shows no forecast. The illustrated entry point keeps its current presentation.

**Observed in Safari.** On the guided seed-0 opening, all three destinations showed the Sheriff applying one orb of Base pressure. Cancelling the center-lane selection left four cards in hand and the lane empty. After ending the turn without summoning, two lanes showed both sides of the exchange with a Skeleton and the last lane still showed Base pressure. The Node checks also cover a defeated opposing troop getting its hit and verify that the forecast never mutates the view.

## Stop treating one CPU as the balance verdict

Pokémon's tabletop rules restrict the first player's initial attack. That supports testing early tempo as its own variable. In this simultaneous duel, Kiro's separate experiment compares a symmetric round-one Base shield. Yu-Gi-Oh's tribute summons illustrate the field-presence tradeoff the duel already has. Antigravity's separate task measures that trade by comparing legal actions from the same board. [Pokémon TCG rules](https://assets.pokemon.com/assets/cms2/pdf/trading-card-game/rulebook/par_rulebook_en.pdf) · [Yu-Gi-Oh official rulebook](https://www.yugioh-card.com/ygo_cms/ygo/all/uploads/Rulebook_v9_en.pdf)

The existing Both experiment combines a guaranteed free opener and a fifth card for the second seat. Reuse the prior paired harness with the same decks and each faction taking the first seat on every seed. A positive seat gap means the first seat won more matches. A negative gap means the second seat won more.

| CPU mirror | Seeds | Matches per policy | Shipped gap | Both gap | Round-1 sides with no summon | Mean rounds |
| --- | --- | --- | --- | --- | --- | --- |
| Normal | 20000–20999 | 2,000 | +23.00 pt | +15.95 pt | 132 to 0 | 7.279 to 7.678 |
| Normal | 21000–21511 | 1,024 | +27.05 pt | +20.12 pt | 54 to 0 | 7.354 to 7.748 |
| Hard | 21000–21511 | 1,024 | −28.13 pt | −47.17 pt | 54 to 0 | 5.771 to 5.800 |

On the shared 512-seed set, the paired change was −6.93 points for Normal (95% interval −12.06 to −1.80) and −19.04 points for Hard (95% interval −23.26 to −14.82). Both eliminated the observed no-summon starts, but it widened the existing Hard second-seat advantage. Free opener alone removed the same no-summon starts with a much smaller gap change (+0.59 for Normal and −0.29 for Hard). Keep the ordinary opening rules while testing those two questions separately: can both sides act early, and is the seat advantage acceptable? Human balance remains unmeasured.

The deck workbench now shows the exact chance of a four-card opening with no free summon for the current legal deck. This is calculated from the deck's own card counts without simulating games. In Safari, the six-Sheriff stock deck showed 3.0% and a legal one-Sheriff deck showed 66.7%. The calculation describes the ordinary opening, before any optional opening policy.

## Test whether the biggest summon pays off

The deck screen uses the game's legal deck builder and current engine. It tests five Cowboy deck plans against the stock Wizard deck over seeds 24000–24255, each with both starting seats and separate Normal and Hard mirrors. Wider control decks with six Sheriffs performed better than tribute-heavy and spell-heavy decks in that sample.

An isolated follow-up replaces just one Mounted Billy with one Deadeye, keeping six Sheriffs and three Billy cards. Each deck ran 1,024 matches per CPU cohort on fresh seeds 24256–24767. Both decks had the same 40 opening droughts in each cohort.

| CPU mirror | Stock Cowboy wins | Swapped Cowboy wins | Paired win-share change |
| --- | --- | --- | --- |
| Normal | 429/1,024 | 570/1,024 | +13.77 pt (95% interval +11.20 to +16.34) |
| Hard | 447/1,024 | 574/1,024 | +12.40 pt (95% interval +9.94 to +14.87) |

The stock deck and signature seed-60 route stay intact. Check whether the extra Deadeye, the lost opportunity to draw an expensive troop, or a particular response policy drives the result before tuning a card. This is a deck swap under fixed bots, so it does not by itself establish a cause or a human balance change.

```sh
node scripts/screen-cowboy-decks.mjs
node scripts/screen-cowboy-decks.mjs --isolate
```

```sh
node scripts/compare-opening-policies.mjs --from 20000 --count 1000 --out .artifacts/card-rd/opening-20000.json
node scripts/compare-opening-policies.mjs --from 21000 --count 512 --cpu normal --out .artifacts/card-rd/opening-normal-21000.json
node scripts/compare-opening-policies.mjs --from 21000 --count 512 --cpu hard --out .artifacts/card-rd/opening-hard-21000.json
node --test tests/match/{summon-forecast,selection,card-model,guide}.test.js
```

Record which lane a new player chooses before showing the outcome, then ask what they gave up by choosing it. Open lane vs. blocked lane and keep two troops vs. tribute for Mounted Billy make concrete paired examples. Collect decisions and explanations before revisiting effects or roster size.

[Earlier opening study](fable-opening-holdout.md) · [Working graybox](codex-graybox.md)
