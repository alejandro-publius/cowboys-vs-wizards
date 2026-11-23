# Night Shift balance contract

## Introduction

This file is the written source of the two decision thresholds used by the
Night Shift balance loop (`node scripts/contest-balance.mjs`). The loop's
default policy reads its faction band and first-seat tolerance from the two
normative lines below through `scripts/showdown-balance-contract.mjs`. The
numbers are the ones already recorded in earlier receipts (band 45 to 55,
tolerance 1 percentage point); this file moves them, it does not retune them.

The balancer agent never edits this file. It may change one number on one
troop card inside a scratch snapshot, nothing else. The reviewer records this
file's SHA-256 when an attempt is prepared and fails the attempt if the file
changed before review.

## Normative requirements

- NSB-1: Each faction's win share SHALL be within 45% to 55%, inclusive.
- NSB-2: The opening player's absolute win-share distance from 50% SHALL grow by at most 1 percentage point versus the baseline.

## Measurement

1. All values are percents of all games in one seed range (tune or holdout),
   each deal played from both seats with the level-2 bot on both sides.
   Draws count for neither faction.
2. NSB-1 is checked on the candidate's Cowboy share and Wizard share. Each must
   lie in the band; the bounds themselves pass.
3. NSB-2 compares seat skew, `abs(firstSharePct - 50)`, of the candidate with
   the baseline on the same range. Growth equal to the tolerance passes.
4. Both requirements apply separately to tune and to holdout. A missing or
   non-finite measurement never passes.
5. A PASS means only that measured match shares meet NSB-1 and NSB-2 on tune
   and holdout and the candidate is ready for Fable/Alex review. It is not a
   claim that any single card is balanced, and nothing is applied to a card or
   release.

## Grammar accepted by the parser

The parser reads only this small grammar. It does not interpret other prose.

1. A normative line is a list item that starts with an identifier such as
   `NSB-1:`, or any line containing the all-caps modal verb used above.
   Every other line is explanatory text and is ignored.
2. Exactly two normative lines are supported, NSB-1 and NSB-2, each once, in
   the exact wording above with only the numbers free.
3. Numbers are plain decimals (digits, optional fraction), finite, from 0 to
   100. The NSB-1 low bound may not exceed its high bound.
4. Any other normative line, a duplicate, a missing requirement or a bad number
   makes the file malformed. The loop then reports every problem with its line
   number and refuses to prepare or review a new attempt. Verifying an earlier
   receipt still uses the policy recorded inside that receipt.
