# Requirements: duel card pipeline

Authoring lifecycle for the Cowboys vs. Wizards cards. One small JSON spec per card is the source; the runtime catalog is generated from it. The per-card catalog may grow. The initial migration covers exactly eight cards, in the order listed in R1 and R2.

## Glossary
- Card spec: `.kiro/specs/duel-card-pipeline/cards/<card>.json`.
- Catalog: the generated runtime card data produced by `scripts/sync-card-specs.mjs`.

## Requirements

### R1 Card specs
User story: as the designer, I want one spec per card so a change is reviewed in one file.
1. There is exactly one spec per card. For the initial migration the cards are exactly Sheriff, Billy, Mounted Billy, Deadeye, Skeleton, Wizard, Dragon and Singularity, in that order. Later cards may be added as further specs without changing the eight or their order.
2. A spec states side, kind, copies and, for troops, stars, health and attack; for spells, whether it relocates.

### R2 Preserved game
1. The generated catalog yields the same 12-card deck order per side as `src/game/cards.js`: Sheriff x6, Billy x3, Mounted Billy x1, Deadeye x2; Skeleton x6, Wizard x3, Dragon x1, Singularity x2.
2. Card IDs, tribute costs (1-4 stars none, 5-6 one, 7+ two) and legal moves are unchanged.
3. Art and the existing attack demo are not touched.

### R3 Staleness
1. `node scripts/sync-card-specs.mjs` regenerates the catalog.
2. With `--check`, it exits non-zero when the catalog differs from the specs.

### R4 Save check
1. Saving a card spec runs `sh scripts/check-card-specs.sh`.
2. Saving the generated catalog or any other file does not trigger it.
3. The script records each command's exit status in the matching receipt in `.artifacts/kiro/` and exits non-zero if any command failed.

### R5 Review workflow
1. The `card-summoning-circle` workflow takes a `card` key and a `proposal`.
2. The `card` key is used as a file reference only if it matches `^[a-z][a-z0-9-]{0,31}$` and names an existing spec. Neither input is interpolated into a shell command.
3. For a proposal that is one exact stat change (`<field> = <whole number>` for stars, health, attack or copies), the first step edits that field in the one named spec in the isolated workflow workspace. For `review existing` it only reads. Any other proposal causes no edit.
4. A separate review step checks the resulting JSON against the proposal and R1 and R2, then the check wrapper runs once, then a bounded seeded sample is reviewed.
5. The sample is seeds 0-99, CPU against CPU, and is reported as an estimate for those conditions. Numeric balance stays subject to playtesting. It runs on the active Showdown engine (`src/game/showdown/`) with the even-match decks, each seed once from each opener (`node scripts/showdown-smoke.mjs --from 0 --count 100`). A card counts as covered only if the sample played it; a card in the decks that was never played, or one outside the decks, is reported as unmeasured. A proposal is measured only when the printed engine stars, attack or health of that card show the proposed value; deck copies come from the even-match decks, so a `copies` proposal is reported as not measured.
