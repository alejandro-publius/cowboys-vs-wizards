# Counterfactual tribute-choice audit (Antigravity)

Author: Antigravity (Gemini 4 Carbon High), 2026-11-17 America/Los_Angeles.
Branch: `antigravity/tribute-choice-study` from frozen baseline `9603fe4` (`orb-duel-draft-1`).
Owned files: [scripts/audit-tribute-choices.mjs](../../scripts/audit-tribute-choices.mjs), [tests/game/tribute-choices.test.js](../../tests/game/tribute-choices.test.js), this note, and the four single-run JSON outputs in [antigravity-tribute-choices/](antigravity-tribute-choices/). No file under `src/`, `.kiro/`, `assets/`, or UI/build configuration was modified.

## 1. Question and method

Orb Duel lets a player keep a wide board or sacrifice 1 troop (5-star `Billy`) or 2 troops (7-star `Mounted Billy`) for a stronger piece. To measure when that trade is genuinely useful without inflating counts from duplicate cards in hand:

1. **Sample & balanced seats**: Development uses seeds `0–999` (including showcase seed `60`); disjoint holdout uses seeds `2000–2999` (disjoint from both development and the `0–1999` seeds used when tuning `hard` in [cpu-difficulty.md](cpu-difficulty.md)). Each seed is played twice via `openingMatch(seed, "shipped", firstSeat)` (`cowboy` first and `wizard` first), giving `2,000` matches per setting (`stepBound = 54`, CLI `MAX_COUNT = 5000`).
2. **Stratified CPU levels**: Cowboy (`playerSide = "cowboy"`) walks baseline trajectories with `cpuFor("normal")`; Wizard is stratified into `normal` and `hard` (`cpuFor(level)`) and never pooled.
3. **Eligible public decisions & action deduplication**: At each Cowboy phase start (`publicState(state, "cowboy")`), states with `>= 1` legal tribute summon and `>= 1` legal non-tribute option (free summon, spell, or `end-phase` hold) are selected. Legal actions from `legalActions(view, "cowboy")` are grouped by public meaning (`actionMeaningKey`: action type, card species, tribute count, and resulting species/health board layout), collapsing duplicate hand copies and identical in-place replacements.
4. **Frozen single-round counterfactuals**: Each distinct action group's representative is applied to `structuredClone(frozenState)`, and the current round is finished using `publicState(cur, actor)` only (never passing full state, `seed`, `rng`, opponent hand, or future draws). Next-round `round-start` draws emitted after clash resolution are stripped before measuring `ownRemainingHand`.
5. **Four public comparison axes**: Each tribute outcome $T$ is compared against each non-tribute outcome $N$ in the same state on:
   - `baseOrbs`: net Base orb margin (`ownBaseOrbs - enemyBaseOrbs`),
   - `livingTroops`: net surviving board count (`ownLivingTroops - enemyLivingTroops`),
   - `remainingHand`: Cowboy cards left at end of round (`ownRemainingHand`),
   - `defeat`: `10 * matchDefeatScore + (enemyTroopsDefeated - ownTroopsDefeated)`, prioritizing round-ending match win/loss (`+1 / -1`) and breaking ongoing ties by net combat/spell troop defeats.
   A pair is a **4-axis trade-off** when $T$ wins on `>= 1` axis and loses on `>= 1` axis. Because `end-phase` (`Hold`) always conserves `+1` hand card over summoning, we also report the **3-axis combat relation** (`baseOrbs`, `livingTroops`, `defeat`) separately.

## 2. Exact commands and output JSON receipts

One bounded run was executed per setting:

```sh
node scripts/audit-tribute-choices.mjs --from 0 --count 1000 --wizard normal --example-seed 60 --out docs/evidence/antigravity-tribute-choices/dev-seeds-0-999-normal.json
node scripts/audit-tribute-choices.mjs --from 0 --count 1000 --wizard hard --example-seed 60 --out docs/evidence/antigravity-tribute-choices/dev-seeds-0-999-hard.json
node scripts/audit-tribute-choices.mjs --from 2000 --count 1000 --wizard normal --example-seed 60 --out docs/evidence/antigravity-tribute-choices/holdout-seeds-2000-2999-normal.json
node scripts/audit-tribute-choices.mjs --from 2000 --count 1000 --wizard hard --example-seed 60 --out docs/evidence/antigravity-tribute-choices/holdout-seeds-2000-2999-hard.json
```

| Setting | Output JSON | Matches (with `>=1` choice) | Cowboy / Wizard / Draw | SHA-256 |
| --- | --- | --- | --- | --- |
| Dev `normal` (`0–999`) | [dev-seeds-0-999-normal.json](antigravity-tribute-choices/dev-seeds-0-999-normal.json) | `2,000` (`1,986`) | `880 / 943 / 177` | `710a14bd67bde71dcd4dacde24b7f0d29ea7f1e7cea7b20078f7010d02f9178d` |
| Dev `hard` (`0–999`) | [dev-seeds-0-999-hard.json](antigravity-tribute-choices/dev-seeds-0-999-hard.json) | `2,000` (`1,986`) | `646 / 1,163 / 191` | `e952cf67f95385f896464bfed2ec2ff116673b9f712560ecc3eb163c9dfd8d0d` |
| Holdout `normal` (`2000–2999`) | [holdout-seeds-2000-2999-normal.json](antigravity-tribute-choices/holdout-seeds-2000-2999-normal.json) | `2,000` (`1,988`) | `818 / 977 / 205` | `e696107552abe7f6b701a36c3b43e191c5d1ea6234d903fd6d01789134b1fa0d` |
| Holdout `hard` (`2000–2999`) | [holdout-seeds-2000-2999-hard.json](antigravity-tribute-choices/holdout-seeds-2000-2999-hard.json) | `2,000` (`1,988`) | `640 / 1,141 / 219` | `4cf87ec7ef94197e0923b801b666aed5df1fd85bf3268c59d0373804cbb5f534` |

## 3. Stratified results and denominators

### 3.1 Decision-state denominators and state-level utility

| Setting | Decision states (`uniquePositions`) | Distinct action groups / Raw legal (`collapsed`) | `>=1` tribute undominated (4-axis) | `>=1` tribute beats `Hold` on Base | `>=1` tribute saves match defeat vs `Hold` | Bot chose tribute (`1-trib` / `2-trib`) | Bot Base regret when tributing (`vs any legal`) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dev `normal` | `10,753` (`5,198`) | `74,256 / 92,196` (`-19.46%`) | `8,938` (`83.12%`) | `5,788` (`53.83%`) | `919` (`8.55%`) | `4,787` (`4,387 / 400`) | `1,698 / 4,787` (`35.47%`) |
| Holdout `normal` | `10,514` (`5,154`) | `71,749 / 90,401` (`-20.63%`) | `8,804` (`83.74%`) | `5,605` (`53.31%`) | `963` (`9.16%`) | `4,726` (`4,333 / 393`) | `1,649 / 4,726` (`34.89%`) |
| Dev `hard` | `8,722` (`2,856`) | `61,626 / 81,498` (`-24.38%`) | `6,436` (`73.79%`) | `4,772` (`54.71%`) | `2,113` (`24.23%`) | `3,494` (`2,771 / 723`) | `1,265 / 3,494` (`36.20%`) |
| Holdout `hard` | `8,558` (`2,881`) | `59,729 / 79,961` (`-25.30%`) | `6,400` (`74.78%`) | `4,754` (`55.55%`) | `2,208` (`25.80%`) | `3,434` (`2,746 / 688`) | `1,153 / 3,434` (`33.58%`) |

Deduplicating identical card copies and equivalent moves removes `19.5%–25.3%` of raw `legalActions` entries across all four runs. Holdout rates replicate development within `0.5–2.6` percentage points on every metric.

### 3.2 Pairwise trade-offs by baseline action, tribute cost, and sacrificed troop health

| Setting & comparison slice | Pair denominator | 4-axis: Tribute dom. / **Trade-off** / Non-trib. dom. | 3-combat-axis: Tribute dom. / **Trade-off** / Non-trib. dom. | Lethal saved / Lethal dealt / Own defeat caused |
| --- | --- | --- | --- | --- |
| Dev `normal` · all pairs | `114,600` | `8.37% / 66.14% / 23.77%` | `42.55% / 28.75% / 20.13%` | `3,479 / 1,898 / 4,608` |
| Holdout `normal` · all pairs | `110,190` | `8.65% / 65.60% / 23.93%` | `42.84% / 28.19% / 19.95%` | `3,626 / 1,511 / 4,784` |
| Dev `hard` · all pairs | `101,677` | `10.67% / 61.04% / 26.78%` | `44.57% / 25.91% / 20.64%` | `12,993 / 1,170 / 8,951` |
| Holdout `hard` · all pairs | `98,125` | `11.23% / 60.91% / 26.34%` | `45.85% / 25.08% / 20.25%` | `13,127 / 1,246 / 8,658` |
| Dev `normal` · `vsFreeSummon` (equal card cost) | `39,926` | `4.00% / 55.88% / 40.02%` | `4.26% / 46.43% / 49.21%` | `92 / 280 / 3,244` |
| Holdout `normal` · `vsFreeSummon` | `38,298` | `4.33% / 56.19% / 39.45%` | `4.67% / 46.58% / 48.73%` | `72 / 201 / 3,296` |
| Dev `hard` · `vsFreeSummon` | `35,138` | `6.16% / 42.84% / 49.71%` | `6.34% / 39.10% / 52.78%` | `157 / 217 / 6,825` |
| Holdout `hard` · `vsFreeSummon` | `33,721` | `6.48% / 43.06% / 49.08%` | `6.73% / 39.30% / 52.11%` | `198 / 221 / 6,663` |
| Dev `normal` · `1-trib vsHold` vs `2-trib vsHold` | `33,185` vs `11,496` | `0% / 78.63% / 21.37%` vs `0% / 88.00% / 12.00%` | `74.53% / 4.10% / 1.81%` vs `28.86% / 59.13% / 11.90%` | `1,511/558/236` vs `353/388/651` |
| Holdout `normal` · `1-trib vsHold` vs `2-trib vsHold` | `32,360` vs `10,476` | `0% / 78.15% / 21.85%` vs `0% / 86.28% / 13.72%` | `73.84% / 4.30% / 1.75%` vs `29.17% / 57.11% / 13.53%` | `1,627/486/271` vs `364/283/712` |
| Dev `hard` · `1-trib vsHold` vs `2-trib vsHold` | `28,551` vs `6,018` | `0% / 80.55% / 19.45%` vs `0% / 89.22% / 10.78%` | `68.11% / 12.44% / 1.16%` vs `41.31% / 47.91% / 9.42%` | `4,784/402/212` vs `1,268/57/839` |
| Holdout `hard` · `1-trib vsHold` vs `2-trib vsHold` | `27,712` vs `5,370` | `0% / 80.80% / 19.20%` vs `0% / 89.80% / 10.20%` | `69.01% / 11.79% / 1.27%` vs `43.89% / 45.90% / 9.11%` | `4,826/466/235` vs `1,197/53/794` |
| Dev `normal` · `1-HP sacrifice` vs `full-HP sacrifice` (`vsHold`) | `18,545` vs `5,047` | `0% / 91.25% / 8.75%` vs `0% / 69.39% / 30.61%` | `62.99% / 28.27% / 5.20%` vs `66.10% / 3.29% / 1.27%` | `693/225/636` vs `369/290/4` |
| Dev `hard` · `1-HP sacrifice` vs `full-HP sacrifice` (`vsHold`) | `8,954` vs `9,805` | `0% / 93.52% / 6.48%` vs `0% / 67.30% / 32.70%` | `72.95% / 20.57% / 3.08%` vs `56.88% / 10.42% / 0.57%` | `1,583/109/679` vs `1,453/70/8` |

Even when hand expenditure is equalized (`vsFreeSummon`), **`46.43%` (Dev) / `46.58%` (Holdout)** of pairs in `normal` and **`39.10%` (Dev) / `39.30%` (Holdout)** in `hard` remain genuine combat trade-offs (trading lane width or own Base defence for blocker kills and single-lane durability). When both `2-tribute` and `1-tribute` summons are legal in the same state (`twoTributeVsOneTribute`), `1-tribute` strictly dominates `2-tribute` on combat axes in `43.30%` / `43.17%` (`normal`, `32,196` / `28,692` pairs) and `48.88%` / `48.95%` (`hard`, `19,890` / `16,644` pairs), while `2-tribute` strictly dominates `1-tribute` in `10.14%` / `10.48%` (`normal`) and `23.67%` / `23.68%` (`hard`).

### 3.3 Seat and round-order stratification

| Setting | Stratum | States | Tribute beats `Hold` on Base | `vsFreeSummon` combat trade-off | Bot `2-trib` choices | Bot `2-trib` Base regret (`vs any legal`) |
| --- | --- | --- | --- | --- | --- | --- |
| Dev `normal` | `firstSeat=cowboy` / `firstSeat=wizard` | `5,344 / 5,409` | `58.12% / 49.58%` | `46.49% / 46.36%` | `234 / 166` | `203/234` (`86.75%`) / `127/166` (`76.51%`) |
| Dev `normal` | `actingFirstInRound` / `actingSecondInRound` | `5,411 / 5,342` | `34.21% / 73.70%` | `52.72% / 40.55%` | `245 / 155` | `231/245` (`94.29%`) / `99/155` (`63.87%`) |
| Holdout `normal` | `actingFirstInRound` / `actingSecondInRound` | `5,342 / 5,172` | `33.77% / 73.49%` | `52.16% / 41.24%` | `252 / 141` | `238/252` (`94.44%`) / `82/141` (`58.16%`) |
| Dev `hard` | `firstSeat=cowboy` / `firstSeat=wizard` | `3,875 / 4,847` | `65.68% / 45.95%` | `34.28% / 43.00%` | `405 / 318` | `377/405` (`93.09%`) / `266/318` (`83.65%`) |
| Dev `hard` | `actingFirstInRound` / `actingSecondInRound` | `4,414 / 4,308` | `37.22% / 72.63%` | `52.05% / 27.16%` | `672 / 51` | `626/672` (`93.15%`) / `17/51` (`33.33%`) |
| Holdout `hard` | `actingFirstInRound` / `actingSecondInRound` | `4,319 / 4,239` | `38.04% / 73.39%` | `51.66% / 28.00%` | `642 / 46` | `569/642` (`88.63%`) / `15/46` (`32.61%`) |

Turn order within the round is the sharpest divider in the game: when Cowboy acts **second** (clash resolves immediately), a tribute beats `Hold` on Base orbs in **`72.6%–73.7%`** of states across both CPU levels; when Cowboy acts **first** (Wizard still gets a summon and/or `Singularity` before clash), that rate drops to **`33.8%–38.0%`**.

## 4. Concrete board examples (Seed 60, natural `wizard` first seat, `wizard=normal`)

All three examples come from `exampleSeed` in [dev-seeds-0-999-normal.json](antigravity-tribute-choices/dev-seeds-0-999-normal.json) (`seed = 60`, `firstSeat = "wizard"`, matching the showcase match in [morning-handoff.md](../morning-handoff.md)).

### Example A · Round 3 (acting second): recycling a 1-HP blocker creates a three-way trade-off
- **Frozen public state**: Bases `5–5`; Cowboy board `[Sheriff:1 | Sheriff:2 | -]`; Wizard board `[Skeleton:3 | Skeleton:2 | -]`; Cowboy hand `[Mounted Billy, Billy, Billy]`. Grouping collapses `12` raw legal actions into `8` distinct choices (merging the duplicate `Billy` copies). Wizard has already ended Round 3.
- **Round-end outcomes**:
  - `Hold` (`end-phase`): Bases `5–5` (`net 0`), living troops `1–2` (`[-|Sheriff:1|-]` vs `[Skeleton:2|Skeleton:1|-]`), hand `3`, troop defeats `1–0` (`L0 Sheriff:1` dies in combat).
  - `1-Tribute Billy -> L0` (sacrifice `L0 Sheriff:1`): Bases `5–5` (`net 0`), living troops `2–2` (`[Billy:3|Sheriff:1|-]` vs `[Skeleton:1|Skeleton:1|-]`), hand `2`, troop defeats `0–0` (preserves all `5` Cowboy Base orbs and `2` living troops for `1` card).
  - `1-Tribute Billy -> L2` (sacrifice `L0 Sheriff:1`, bot pick): Bases `4–3` (`net +1`), living troops `2–2` (`[-|Sheriff:1|Billy:4]` vs `[Skeleton:3|Skeleton:1|-]`), hand `2`, troop defeats `0–0` (trades `1` own Base orb in `L0` to deal `2` unblocked Base damage in `L2`).
  - `2-Tribute Mounted Billy -> L0` (sacrifice `L0, L1`): Bases `4–5` (`net -1`), living troops `1–1` (`[Mounted Billy:4|-|-]` vs `[-|Skeleton:2|-]`), hand `2`, troop defeats `0–1` (wins `defeat` by killing `Skeleton:3`, loses Base orbs and board width).

### Example B · Round 4 (acting first): 2-tribute consolidation punished by `Singularity`
- **Frozen public state**: Bases `4–3`; Cowboy board `[- | Sheriff:1 | Billy:4]`; Wizard board `[Skeleton:3 | Skeleton:1 | -]`; Cowboy hand `[Mounted Billy, Billy, Billy]` (`enemyHandCount = 4`; `12` raw actions -> `8` distinct groups). Cowboy acts **first**, so Wizard still has its Round 4 summon and spell.
- **Round-end outcomes**:
  - `2-Tribute Mounted Billy -> L2` (sacrifice `L1 Sheriff:1` and `L2 Billy:4`, bot pick): Wizard summons `Skeleton -> L2` and casts `Singularity` to pull `Mounted Billy` (`5 -> 4`) into `L1`. Clash ends at Bases **`2–3` (`net -1`)**, living troops **`1–2`** (`[-|Mounted Billy:3|-]` vs `[Skeleton:3|-|Skeleton:3]`), hand `2`, troop defeats `0–1`.
  - `1-Tribute Billy -> L1` (sacrifice only `L1 Sheriff:1`, keep `L2 Billy:4`): Clash ends at Bases **`3–3` (`net 0`)**, living troops **`2–2`** (`[-|Billy:3|Billy:3]` vs `[Skeleton:3|-|Skeleton:1]`), hand `2`, troop defeats `0–1` — **strictly dominating** the 2-tribute line on Base orbs (`+1` Cowboy orb) and living troops (`+1` surviving `Billy`) at identical hand cost and defeat count.

### Example C · Round 5 (acting second): equal-card width vs survival vs lethal lane vacate
- **Frozen public state**: Bases `2–3`; Cowboy board `[- | Mounted Billy:3 | -]` facing `[- | Dragon:5 | -]`; Cowboy hand `[Billy, Billy, Sheriff]` (`9` raw actions -> `6` distinct groups).
- **Round-end outcomes**:
  - `Free Summon Sheriff -> L0` (bot pick): Bases `2–2` (`net 0`), living troops `1–1` (`[Sheriff:3|-|-]` vs `[-|Dragon:2|-]`), hand `2`, troop defeats `1–0` (`Mounted Billy` dies dealing `3` damage to `Dragon`).
  - `1-Tribute Billy -> L1` (in-place sacrifice of `Mounted Billy:3`): Bases `2–3` (`net -1`), living troops `1–1` (`[-|Billy:1|-]` vs `[-|Dragon:3|-]`), hand `2`, troop defeats `0–0` — **wins `defeat`** (zero combat deaths; `Billy` survives `Dragon`'s 3-attack hit at `1` HP) while **losing `baseOrbs`** (`2–3` vs `2–2`).
  - `1-Tribute Billy -> L0` or `L2` (vacating `L1`): Unblocked `Dragon` hits Cowboy Base `2 -> 0`, causing **immediate match defeat (`0–1`, `loss`)**.

## 5. Design recommendation tested by the data

**Recommendation: Keep the shipped tribute rules and card stats unchanged — do not add a tribute subsidy, card refund, or free-consolidation rule.**

- **Hypothesis tested on dev (`0–999`) and verified on disjoint holdout (`2000–2999`)**: Did tribute summons fail in prior bot deck-balance runs ([deck-balance-report.md](deck-balance-report.md)) because the rules make tributes strictly worse than holding/free-summoning, or because the 1-clash no-response heuristic (`chooseAction`) over-consolidates 2-tribute troops when acting first?
- **Data test**:
  1. Tributes are already live, non-dominated decisions in **`83.12%` (Dev) / `83.74%` (Holdout)** of eligible states under `normal` and **`73.79%` / `74.78%`** under `hard`, and rescue Cowboy from immediate match defeat in **`24.23%` / `25.80%`** of states against `hard` Wizard. A rule buff to tributes would collapse the balanced equal-card trade against free summons (`46.43%` / `46.58%` combat trade-offs in `normal`; `39.10%` / `39.30%` in `hard`).
  2. `chooseAction` scores moves assuming the opponent adds nothing before the clash (`src/game/cpu.js`). When Cowboy acts **first** in a round and picks a 2-tribute `Mounted Billy`, Wizard's unmodeled phase (`Skeleton` + `Singularity` or counter-summon) inflicts immediate same-round Base-orb regret in **`94.29%` (`231/245` Dev) and `94.44%` (`238/252` Holdout)** under `normal`, and **`93.15%` (`626/672` Dev) and `88.63%` (`569/642` Holdout)** under `hard`. When Cowboy acts **second** against `hard` Wizard (no unmodeled opponent phase), 2-tribute regret falls nearly threefold to **`33.33%` (`17/51` Dev) and `32.61%` (`15/46` Holdout)**, and 2-tribute summons strictly dominate 1-tribute alternatives on combat axes in `23.67%` / `23.68%` of head-to-head pairs.
- **Implication**: No rule or stat edit is warranted. Any future optional tuning belongs in onboarding tips or an opt-in CPU heuristic (discounting 2-tribute lane collapse when acting first against an opponent holding cards), not in game rules.

## 6. Verification and unverified boundaries

- **Verified**:
  - `node --test tests/game/tribute-choices.test.js` (`4` tests, `4` pass): action legality, duplicate-copy/in-place grouping soundness (every raw action in a group produces identical round-end outcomes), deep-frozen original-state immutability, public-view isolation, zero future-draw leakage under reversed decks, deterministic replay, Seed 60 reproduction, and CLI bound checks.
  - `node scripts/check-links.mjs`: verified all relative Markdown links in tracked docs resolve cleanly.
- **Not verified (labeled boundaries)**:
  - **Multi-round counterfactual horizons**: Rollouts stop at the end of the decision's own round as specified; a move that loses 1 Base orb in Round $R$ can still win the match later (as Seed 60's Round 4 showcase line eventually wins in Round 9 against `normal` Wizard).
  - **Custom Cowboy decks and Wizard-perspective player seats**: Only the shipped 12-card starter decks and Cowboy player seat were audited.
  - **Human play and browser UI**: No renderer, UI, or rule code was touched, so browser replay (`verify-duel.mjs --browser`) and human playtesting were not run.
