# Proof scorecard ingestion fixes (Kiro CLI, 2026-11-22)

Kiro CLI session (model `claude-opus-5.5`) on branch `kiro/native-proof-scorecard`, base
`79e651765eb65906203fdaa6088a37fb2c2dffe1`, 2026-11-22 21:40 PST (America/Los_Angeles). The
assignment was to close the two ingestion defects Job 18 reported, without new specs or reviews.
This session did not observe a `steering_inclusion` event, so it does not count as an observed
native load of `goal.md`.

## Changed behaviour

**SHALL counting** ([`scripts/scorecard.mjs`](../../scripts/scorecard.mjs), `ID`). The
identifier grammar accepted `NSB-1:` and `R1.2` but not multi-part card IDs. All 29 card specs
write their clauses as `- CARD-COWBOY-BILLY-01: ...` or `- **CARD-WIZARD-HEX-01.** ...`, so the
scorecard skipped every one of them while `scripts/trace.mjs` indexed them. The identifier now
takes further `-WORD` parts and a closing `.` inside bold. The rules for short items (three
words besides SHALL and NOT) and for repeated text are unchanged.

**Review ingestion** (`measureReviews`). The ten expert-panel reviews write each finding as a
heading (`## E1. ...`) with its own `- **Status:** open.` or `answered.` bullet. They had no
file-level `Status:` line and no `Findings` heading, so all ten were rejected. Changes:

- An identified finding heading (`## <1–3 capitals><digits>. <five or more words>`) now counts
  as a finding, alongside list items under a Findings heading.
- `answered` is accepted as an outcome, because the reviews use that word for a closed question.
- New guard: a review whose `Status:` approves (approved, accepted, resolved, fixed, pass) while
  any identified finding records `**Status:** open` is rejected. Open findings cannot be counted
  as approvals.
- Each counted review is listed in `details.counted` with its status and open finding IDs.

**Reviews.** Each of the ten files got a `Status:` line taken from its own finding statuses, a
sentence naming which findings are open and which are answered, and a note saying who added it
and that the findings are unchanged. No finding text or per-finding status was edited.

| Review | Status line | Open | Answered |
| --- | --- | --- | --- |
| night-shift-balance-contract/game-economist | open | E1, E3 | E2 |
| night-shift-balance-contract/rules-lawyer | open | L1, L2 | L3 |
| night-shift-repair/game-economist | open | E1, E2 | none |
| night-shift-repair/rules-lawyer | open | R1, R2, R3 | R4 |
| night-shift-repair/security-reviewer | open | S1 | S2 |
| night-shift-saloon/accessibility-reviewer | open | A1, A2, A3 | A4 |
| night-shift-saloon/lore-keeper | open | K1, K2, K3 | none |
| night-shift-saloon/new-player | open | N1, N2 | N3 |
| night-shift-saloon/rules-lawyer | open | L1, L2, L3 | L4 |
| night-shift-saloon/security-reviewer | answered | none | S1–S4 |

None is marked approved. The saloon security review says `answered` because all four of its
findings say answered. The review ran none of its acceptance checks, and its file now says their
results are pending. No review was uncountable under the scorecard's rule. Each one states the
same author: one Kiro CLI agent writing every panel lens from a static reading after its shell
calls were refused.

**Docs.** [`docs/SCORECARD.md`](../SCORECARD.md) describes the new accepted syntax and the
remaining differences. No log line was added by hand.

## Commands and outcomes

| Command | Base `79e6517` | Head (this change) |
| --- | --- | --- |
| `node --test tests/game/dec4-scorecard.test.js` | 12 existing tests pass; on base code the 4 new tests fail | 16 pass, 0 fail |
| `npm run scorecard -- --offline` | 3 of 14 pass, exit 1 | 3 of 14 pass, exit 1 |
| `node scripts/trace.mjs` | exit 1 | exit 1, output byte-identical to base |

The 4 new tests were run against the base `scripts/scorecard.mjs` (restored afterwards) to show
they catch the defects. They cover multi-part IDs on fixtures, cross-checking every list or
table SHALL clause trace.mjs indexes in this checkout, review finding headings and the
approval-over-open guard on fixtures, and the ten real reviews (status matches findings, none
rejected).

Offline scorecard rows, base → head:

| Row | Base | Head | Target |
| --- | --- | --- | --- |
| shall | 219 FAIL | 662 FAIL | ≥ 4000 |
| night-shift-prs | unavailable FAIL | unavailable FAIL | ≥ 300 |
| reviews | 0 FAIL (10 rejected, no Status line) | 10 FAIL (0 rejected) | ≥ 100 |
| duels | 3000 FAIL | 3000 FAIL | ≥ 10,000,000 |
| card-band | 0/29 FAIL (29 unknown) | 0/29 FAIL (29 unknown) | 29/29 |
| properties | 20 FAIL | 20 FAIL | ≥ 100 |
| hooks | 14 PASS | 14 PASS | ≥ 8 + Saloon |
| agents | 5 FAIL | 5 FAIL | ≥ 8 |
| frontier-kit | no FAIL | no FAIL | yes |
| submission-licence | yes PASS | yes PASS | yes |
| submission-kiro | yes PASS | yes PASS | yes |
| submission-site | unavailable FAIL (offline) | unavailable FAIL (offline) | HTTP 200 |
| submission-video | none FAIL | none FAIL | < 180 s |
| submission-category | OWNER FAIL | OWNER FAIL | a contest category |

No row that passed at base fails at head. `shall` now reads 662 numbered items, 0 too short and
0 repeated, from 670 physical SHALL lines in 44 files.

Trace at head: 44 specs, 714 clauses, 2 proven by a named test (NSB-1, NSB-2), 712 orphan IDs,
0 duplicate IDs, 6 unsupported-syntax lines, 3 unresolved test references.

## SHALL versus trace after the fix

Of trace's 714 clauses, 654 contain SHALL in trace's 160-character text. Four more have SHALL
past that cut-off (sheriffs-office 02, boneyard 03, hellfire 03, saloon 4.3), which makes 658.
The scorecard's 662 = 658 − 1 + 5:

- −1: `deck-builder-readability` `### R5 Desktop layout` is a heading clause with prose and no
  numbered criteria. The scorecard does not count heading clauses.
- +5: `orb-duel/requirements.md` lines 240–244 are numbered SHALL items outside a requirements
  section. Trace reports them as `unidentified-normative`; the scorecard counts them.

Whether these 6 lines count is a metric decision, so it is recorded here and was not made.

## Scorecard versus steering (`goal.md`): differences, targets unchanged

The scorecard measures its own Step 0 targets (`TARGETS` in `scripts/scorecard.mjs`). The
user's scorecard in `.kiro/steering/goal.md` defines some lines differently. No target was
changed. These differences would change an approval:

- **reviews.** goal.md counts 100 GitHub reviews, each of a named head SHA, by a reviewer other
  than the PR's author. The scorecard counts written spec review files. None of the ten reviews
  names a head SHA or is a GitHub review, and one agent wrote all ten. They count 10 here and
  would count 0 under goal.md.
- **hooks / scoping.** The scorecard's `hooks` row passes (14 triggers configured). goal.md's
  `scoping` line needs a real native trigger observed for each hook and agent, scored from
  receipts. A configuration-only PASS here is not a `scoping` pass.
- **card-band.** The scorecard has a fixed 45–55% band (`TARGETS.band`). goal.md says the
  per-card band's numbers and measurement stay unset until an approved spec requirement sets
  them, and NSB-1 is a faction band, not a per-card claim. The row fails today (29 of 29 cards
  unknown, no faction shares used), so this pass grants nothing. If per-card receipts appeared,
  the row could pass on numbers no approved requirement has set. Per-card fairness is unproven.
- **second-game.** The scorecard checks `packages/frontier-kit`. goal.md scores the shared kit
  `src/review/paired-duel-kit.js` via the deployed `build.json` commit and
  `scripts/verify-poker-kit.mjs`. Both paths exist in this checkout.
- **loop-prs and properties.** goal.md asks for PRs traced to native Kiro session receipts and
  properties linked to requirement IDs run by `node --test`. The scorecard counts PRs that cite
  sealed Night Shift bundles and fast-check receipts. Both rows fail either way.
- **shall.** The scorecard's 4000 target has no matching goal.md line.

## Remaining blockers

- Every count target still fails: shall 662/4000, reviews 10/100, duels 3000/10,000,000,
  properties 20/100, agents 5/8, card-band 0/29. GitHub PR and live-site rows were not measured
  (offline).
- Per-card fairness has no approved measurement or receipt.
- Whether to align `TARGETS` and the row definitions with goal.md is for the user.
- No requirement ID covers `scripts/scorecard.mjs` itself. The commit cites NSB-1 and NSB-2,
  which the two balance-contract reviews examine.
- `docs/kiro-build-log.md` is outside this task's owned paths and was not updated. The
  coordinator still has to add a log entry.
- The `dec4-scorecard.json` Stop hook may append a line to `docs/SCORECARD.md` after this
  commit. That line would come from the hook, not from this pass.
