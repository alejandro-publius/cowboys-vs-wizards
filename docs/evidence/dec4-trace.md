# Dec 4 Step 2: requirement traceability

Claude Code (Claude Opus 5.5) wrote this on 2026-11-22 in the `dec4-claude-studio/trees/trace` worktree, based on `e1e2d32`. It is Claude's work: Kiro has not run these files, so nothing here counts as Kiro evidence. No spec, card, existing test or game file changed. New files: `scripts/trace.mjs`, `tests/game/dec4-trace.test.js` and this note.

## Use

    node scripts/trace.mjs                   # text report
    node scripts/trace.mjs --json            # machine-readable report
    node scripts/trace.mjs --require CARD-   # also fail while a CARD- clause lacks proof

| Exit | Meaning |
| --- | --- |
| 0 | No duplicate IDs and no unsupported syntax. Orphans alone don't fail. |
| 1 | Any of: a duplicate ID, an unsupported line, a `--require` prefix with an unproven clause, or a `--require` prefix that matches no clause. |
| 2 | Bad argument, or no `.kiro/specs` directory under `--root`. Also (added 2026-11-25) a `.config.kiro` that is not JSON, or one that declares a bugfix spec without its `bugfix.md`. |

The JSON report has these keys: `summary`, `specs`, `duplicates`, `problems`, `unresolved`, `orphans`, `clauses` and `required`.

- `duplicates` lists every `file:line` where a duplicated ID appears.
- `problems` entries carry `at`, `kind` and `detail`.
- Each entry in `clauses` carries `key`, `at`, `style`, `text` and its `refs`.

## Clauses

Clauses come from `.kiro/specs/*/requirements.md` and, since 2026-11-25, from native bugfix specs (see below). The existing styles are read as written:

| Style | Written as | ID |
| --- | --- | --- |
| table | rows of a table whose first header cell is `ID` (`\| CL-1 \| … \|`) | `CL-1` |
| list | `- NSB-1: …`, `- **PM1.** …`, `- **G1 Title.** …` | `NSB-1`, `PM1`, `G1` |
| paragraph | `R1 One zone per side. …` | `R1` |
| numbered | `1. …` under `### R1 …`, `### Requirement 1: …`, `## Requirement FH-R1: …` or a bare `## Requirements` | `R1.1`, `1.1`, `FH-R1.1`, `1` |
| heading | a requirement heading with no numbered criteria | `R5` |

Where explicit IDs count:

- They count inside a section whose heading mentions "requirement", inside a requirement heading, or before the file's first `##`.
- They don't count in Glossary, Decisions, Measurement or proof tables.
- Indented lines continue the clause above them. Fenced code is ignored.

CARD IDs (for example `CARD-COWBOY-BILLY-01` or `CARD-WIZARD-DRAGON-01`):

- They count in any section and in any of the forms above.
- They must match `CARD-(COWBOY|WIZARD)-NAME-NN` and contain SHALL (EARS).

IDs with two or more leading capitals (`CL-1`, `PM1`, `FH-R3.2`, `CARD-…`) are global. Single-letter and numeric IDs collide across specs, so their key is `<spec>/<id>`, for example `orb-duel/3.7`.

**Native Kiro bugfix specs (added 2026-11-25).** A spec directory whose Kiro IDE metadata `.config.kiro` has `"specType": "bugfix"` also contributes its `bugfix.md` ([evidence](kiro-bugfix-spec-trace.md)):

- Clauses are `2.N …` lines under an `Expected Behavior` heading and `3.N …` lines under an `Unchanged Behavior` heading. Their style is `bugfix` and their key is local, for example `showdown-bear-trap-log/2.1`. Indented lines and plain prose continue the clause above.
- `Current Behavior` (`1.N`, the defect) and the introduction are context. They yield no clause and are not checked for SHALL.
- Problems: a number that doesn't match its section (`malformed-id`), a clause without SHALL (`not-ears`), a SHALL line in those two sections that isn't a clause (`unidentified-normative`), and no clause at all (`no-clauses`).
- A `bugfix.md` without that metadata, such as the hand-written `showdown-camp-return-focus`, is not read.
- `--require showdown-bear-trap-log/2.` gates the expected clauses and `--require showdown-bear-trap-log/3.` the unchanged ones.

Problem kinds:

- `unidentified-normative`: a SHALL line that belongs to no clause.
- `malformed-id`
- `not-ears`
- `no-clauses`

## Proof

Only a `test(...)` or `it(...)` call can prove a clause (`.only` allowed). It must be real code, its first argument must be a string or template literal, and the static text of that title must cite the ID. Cite a global ID bare and a local ID as `<spec>/<id>`. A test whose body uses `fc.assert` or `fc.property` is labelled `property`.

None of these count as proof:

- Comments, and the contents of strings or templates.
- Titles built from variables, arrays, `${…}` or concatenation.
- `.skip` and `.todo` tests, and any `skip` or `todo` option other than literal `false`. That includes conditional skips such as `{skip: NO_GIT}`, because a static trace can't tell whether they run.
- Tests inside a skipped suite, tests with an empty body, and tests with no callback.
- `RE.test(…)` and `t.test(…)` calls.
- Design and tasks files, and manifests.
- Anything under `fixtures/`, `node_modules`, `dist` or `.artifacts`, plus `tests/game/dec4-trace.test.js` itself.

A bare local ID in a title, such as `R1.1`, is listed under `unresolved` as `unqualified` with its candidate clauses. It proves nothing.

## Actual run on this checkout (2026-11-22)

`node scripts/trace.mjs` exits 1. `--json` gives the same numbers.

- **Size:** 15 specs, 271 clauses, 0 duplicate IDs.
- **Proven: 2.**
  - NSB-1: `tests/match/billy-balance-gate.test.js:36` and `:46`, and `tests/match/showdown-balance-contract.test.js:78`.
  - NSB-2: `tests/match/billy-balance-gate.test.js:46` and `tests/match/showdown-balance-contract.test.js:154`.
- **Orphans: 269.** These are expected. The other specs map proof in prose or tables, not in test titles.
- **Unsupported syntax: 6, all in the retired `orb-duel` spec.** This is the only cause of exit 1.
  - Line 227: a SHALL NOT bullet under Asset Gaps.
  - Lines 240-244: Asset Gaps acceptance criteria with no requirement number.
- **Unresolved: 3.**
  - `tests/match/sheriffs-ledger.test.js:52` cites a bare `R1.1`, which both deck-builder-readability and duel-card-pipeline define.
  - `tests/game/showdown-fast-check.test.js:24` and `:30` cite `G1`. That is a fast-check property ID, not outrider-gate G1.
- **`--require CARD-`:** no CARD clause exists yet, so the run reports "no clause has this prefix" and fails.

## Checks run

- `node --test tests/game/dec4-trace.test.js`: 8 of 8 passed.
- Mutation check: I made rejected tests count as proof. The spoof regression failed, listing its 7 skipped, empty and callback-less tests. I then reverted the change.
- Lexer cross-check: across all 121 test files, the lexer found the same 954 single-line literal titles at the same lines as a line grep.
- `npm test` was not run. `scripts/verify-duel.mjs` collects every file in `tests/game`, so the new test joins it.

## Limits

- A trace shows that a test cites a clause, not that the test proves the behaviour.
- These aren't read: subtests (`t.test`), `describe` titles, and `test` imported under another name.
- The `property` label relies on the `fc` name.
- The lexer treats a `/` after `)` or `]` as division.
