# Graveyard Dragon and Lantern Wraith task receipts

Codex CLI worker 5, November 27, 2026. On game revision `323c3cce20e0`, 75 distinct Node tests passed. This closes 13 of 13 [Dragon tasks](../../.kiro/specs/card-wizard-dragon/tasks.md) and 5 of 5 [Wraith tasks](../../.kiro/specs/card-wizard-lantern-wraith/tasks.md). The named-test index went from 33/34 to 34/34 Dragon clauses and stayed at 16/16 Wraith clauses. Kiro execution and first-time-player recruitment (integration goal G10) remain separate evidence.

## Task receipts

Each link goes to the assertion block in the named test. The original checklists retain the full acceptance wording.

| Dragon task | Passing test and observed result |
| --- | --- |
| 1. Tribute pairs | [Dragon engine and bounty specification](../../tests/game/card-ears-catalog-proofs.test.js#L1063) offers no summon with zero or one Skeleton. Three give exactly `[0,1]`, `[0,2]`, `[1,2]`. Paying the first pair puts the ready Dragon opposite a legally targetable Sheriff. |
| 2. No Sweep on a Base attack | [Dragon engine and bounty specification](../../tests/game/card-ears-catalog-proofs.test.js#L1093) records a single attack against the empty board's Base for 3, taking it from 5 to 2. |
| 3. Sweep ignores cover and Ghostly | [Sweep counts a covered Sheriff and a Ghostly bystander separately in the log](../../prototypes/showdown/rules.test.js#L155) attacks Sheriff 1. Covered Sheriff 2 ends on 2 orbs and the uncovered Captured Wraith on 1. |
| 4. Sweep never fires Last Stand | [Dynamiter full specification](../../tests/game/card-ears-catalog-proofs.test.js#L480) sends the target Sheriff and the 1-orb Dynamiter to the Cowboy graveyard in that order. The Dragon keeps 5 orbs with no Last Stand event. |
| 5. Sweep before the Dragon falls | [The Wagon's lethal hit-back](../../tests/game/showdown-wanted-combat.test.js#L10) leaves the Wagon on 1, kills the Dragon and emits one Sweep. The swept Sheriff is already in its graveyard at the instant the Dragon enters its own. |
| 6. Bear Trap survived | [Dragon engine and bounty specification](../../tests/game/card-ears-catalog-proofs.test.js#L1113) records Bear Trap on Dragon (3 left), attack on Sheriff 1 (0 left, no hit-back), then one Sweep. Sheriff 2 retains 2 orbs. |
| 7. Sweep event and log | [Sweep counts a covered Sheriff and a Ghostly bystander separately in the log](../../prototypes/showdown/rules.test.js#L155) checks the single emitted Sweep and exact displayed sentence on each board. Removing the Wraith changes count 2 to 1 and “other troops” to “other troop.” |
| 8. Hunt table | [Dragon engine and bounty specification](../../tests/game/card-ears-catalog-proofs.test.js#L1124) checks poster 1 (zero-based), boss, entrance, turn, five orb/level/Base triples, first seat and exact escort. Every escort type lacks Guard. |
| 9. Landing leaves the turn's plays open | [Dragon engine and bounty specification](../../tests/game/card-ears-catalog-proofs.test.js#L1171) matches hand and deck to a draw-only control. All three play flags are free. On that same turn Skeleton can summon for free or Wizard can spend the boss in slot 0. |
| 10. Log name | [Dragon engine and bounty specification](../../tests/game/card-ears-catalog-proofs.test.js#L1177) passes the actual turn-4 landing event for `wizard-dragon-0` to `presentEvent` and gets “The Wizards' Dragon arrived.” |
| 11. Capture | [Dragon engine and bounty specification](../../tests/game/card-ears-catalog-proofs.test.js#L1202) settles five wins after finishing the Trail. Counts advance 1–5, the first four capture receipts are null, and the fifth names `cowboy-captured-dragon`. [Captured Dragon full specification](../../tests/game/card-ears-catalog-proofs.test.js#L383) checks zero copies before that win and one after. |
| 12. Lesson | [Dragon engine and bounty specification](../../tests/game/card-ears-catalog-proofs.test.js#L1134) compares the returned hunt lesson verbatim with clause 34. |
| 13. Catalog | [Dragon engine and bounty specification](../../tests/game/card-ears-catalog-proofs.test.js#L1055) compares all printed fields, one lane copy, the absent Showdown `copies` field and all even-match, Trail, rival and bounty deck counts. |

| Lantern Wraith task | Passing test and observed result |
| --- | --- |
| 1. Attack target | [Billy can attack the lone Wraith until a Bone Wall guards it](../../prototypes/showdown/rules.test.js#L98) offers only `0>0` on the lone-Wraith board and only `0>1` after adding the escort Guard. |
| 2. Sweep reaches it | [Lantern Wraith engine and bounty specification](../../tests/game/card-ears-catalog-proofs.test.js#L1035) sends Gatling Crew into the Skeleton in slot 1. One Sweep takes the Wraith in slot 0 from 4 to 3. |
| 3. Bear Trap | [Bear Trap leaves two Wraith orbs for the Sheriff's hit-back](../../tests/game/showdown-wanted-combat.test.js#L39) checks the trap's target and 4 → 2, followed by the attack against the Sheriff and its hit-back for 1. Both troops end on 1. |
| 4. Hunt table and lesson | [The first Wanted poster supplies the Wraith, escort and lesson](../../prototypes/showdown/progress.test.js#L102) checks poster 0, boss, board entrance, every hunt and escort count, Cowboy first, Wizard Base 4 and the exact lesson. |
| 5. Sync rule | [The synced Wraith is a bounty troop](../../tests/game/card-specs.test.js#L29) checks the generated record's kind, bounty flag, zero copies and absent limit. [Card sync accepts zero attack and enforces the bounty fields](../../tests/game/card-ears-sync.test.js#L12) also runs the validator against bad copies, kind and limit. |

## Counterexample

The 62-repo matrix flagged unchecked tasks. Resource progress K-003 calls for per-task receipts. Deadline Séance's counterexample, GOLEM's matched inputs and second-seed check, and Felix's instruction to inspect raw outcomes suggested a test for a timing error a final board could hide.

In a scratch copy of `src/game/showdown/rules.js`, Codex moved the dying attacker's `defeat(own, action.slot)` from after Sweep to immediately before its block. The complete returned state and events were identical to the live result on seed 62 and on seed 317 with Sheriff and Wagon slots reversed. The test observes the Cowboy graveyard at the write to the cloned Wizard graveyard. With the original rules it read `["cowboy-sheriff-0"]`. With the reversal it read `[]`. Running the same combat test file in the scratch copy exited 1, with only the Dragon test failing. The checkout's rules were untouched.

## Commands run

Local macOS, Node v26.0.0. Each command below exited 0 in the worktree. The combined command repeats 35 tests explicitly requested by Dragon task 13.

```sh
node --test prototypes/showdown/rules.test.js                          # 29 passed
node --test prototypes/showdown/progress.test.js                       # 15 passed
node --test tests/game/card-specs.test.js                             # 20 passed
node --test tests/game/card-specs.test.js prototypes/showdown/progress.test.js  # 35 passed
node --test tests/game/showdown-wanted-combat.test.js                 # 2 passed
node --test tests/game/card-ears-sync.test.js                         # 1 passed
node --test --test-name-pattern='Dragon engine and bounty|Lantern Wraith engine and bounty|Dynamiter full specification|Captured Dragon full specification|Wizard Card gallery previews' tests/game/card-ears-catalog-proofs.test.js  # 5 passed
node --test --test-name-pattern='every troop opens a real rules-engine preview|Ranger, Dragon counter|covered Last Stand, Ride' tests/match/showdown-3d-presentation.test.js  # 3 passed
node scripts/trace.mjs --require CARD-WIZARD-DRAGON- --require CARD-WIZARD-LANTERN-WRAITH- --json
```

Open design questions include whether the bot should tribute its landed Dragon and how the Wraith's Guard escort affects hunt difficulty. This pass measured neither. Browser rendering, other operating systems and human play were outside the receipt.
