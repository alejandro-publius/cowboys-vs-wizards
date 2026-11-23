# Rules lawyer review: Night Shift balance contract

Status: open

Findings as recorded below: L1 and L2 are open; L3 is answered.
This line was added on 2026-11-22 (America/Los_Angeles) by the native Kiro
proof-scorecard pass so the scorecard can read the outcome. The findings below
are unchanged.

Reviewer: one native Kiro CLI agent (model `claude-opus-5.5`) working in the
`12-expert-reviews` worktree. The same agent wrote every review in this panel,
each through a different lens.

Method: compared the grammar section of [requirements.md](requirements.md)
line by line with
[`scripts/showdown-balance-contract.mjs`](../../../scripts/showdown-balance-contract.mjs).
No command ran in this pass because the session's shell calls were refused
before they could start.

Lens: does the parser accept exactly the grammar the file says it accepts?

## L1. The parser accepts wording the spec calls fixed

- **Question:** The grammar section, item 2, says each line must use "the
  exact wording above with only the numbers free". Is any other text free?
- **Record:** `TEMPLATES` at `showdown-balance-contract.mjs` lines 14–15.
  - NSB-1: `faction['’]s` accepts a straight or a curly apostrophe.
  - NSB-2: `opening player['’]s` and `percentage points?` accept the curly
    apostrophe and both "point" and "points".
- **Observed:** By reading the regexes, `- NSB-2: The opening player’s
  absolute win-share distance from 50% SHALL grow by at most 2 percentage
  points versus the baseline.` parses as tolerance 2, even though it is not
  the exact wording.
- **Effect:** No threshold can be misread: the numbers are still captured
  only from the fixed slots. The gap is between the documented grammar and the
  accepted grammar.
- **Status:** open (documentation gap, low risk).
- **Acceptance check:** Either the grammar section lists both accepted
  variants (apostrophe form, and "point" or "points"), or the regexes drop
  them. `tests/match/showdown-balance-contract.test.js` must contain one case
  for each variant and assert the documented outcome.

## L2. Numbered list items with an identifier are not treated as normative

- **Question:** Grammar item 1 says "a list item that starts with an
  identifier such as `NSB-1:`" is normative. Does that include ordered list
  items?
- **Record:** `NORMATIVE` at line 18:
  `/^\s*[-*+]\s+[A-Za-z][A-Za-z0-9]*-\d+\s*:|\bSHALL\b/`. Only `-`, `*` and
  `+` bullets match.
- **Observed:** By reading the regex, a line `1. NSB-3: Draws must stay under
  5%.` has no `SHALL` and no bullet, so the parser ignores it as explanatory
  text. Grammar item 4 says any other normative line makes the file
  malformed. Under the spec's own wording ("a list item"), this line is a
  list item and should be refused.
- **Effect:** A rule written as a numbered item would be silently ignored,
  not refused. The Measurement section already uses numbered items, so this
  form is the one an editor is most likely to copy.
- **Status:** open.
- **Acceptance check:** A test that puts `1. NSB-3: ...` (without `SHALL`) into
  an otherwise valid contract expects `BalanceContractError` naming that line.
  The alternative is to narrow grammar item 1 to unordered bullets and state
  that explicitly.

## L3. Passed reading: missing, duplicate and inverted values fail closed

- **Question:** Do the fail-closed promises in grammar items 3 and 4 hold?
- **Record:** `parseBalanceContract` and `contractProblems`.
- **Observed (by reading):**
  - A duplicate ID reports both line numbers.
  - A missing ID reports `missing NSB-n`.
  - Inverted bounds report `NSB-1 bounds are inverted`.
  - A value over 100 is refused by `percent()`.
  - Non-finite measurements never pass, because `inBand` and the NSB-2 pass
    expression both require `finite(...)`.
  - Every problem is collected before the single throw, so all problems are
    reported together, as item 4 requires.
- **Status:** answered.
- **Acceptance check:** `node --test tests/match/showdown-balance-contract.test.js`
  passes and contains at least one case for each of those five refusals. This
  pass did not run that command; its result is pending.
