# Security review: Night Shift repair protocol

Reviewer: one native Kiro CLI agent (model `claude-opus-5.5`) working in the
`12-expert-reviews` worktree. The same agent wrote every review in this panel,
each through a different lens.

Scope: defensive reading only. The review covers whether requirement 7's
integrity promise ("A missing input, mismatched object ID ... fails the run")
holds against the local environment the scripts inherit. No exploit was
written, no Git state was altered and no command ran in this pass, because
the session's shell calls were refused before they could start.

## S1. The field-trial Git calls are not isolated the way the saloon reader's are

- **Question:** Requirement 7 treats the four recorded object IDs as proof of
  which engine was played. Can local Git settings make the extracted files
  differ from those IDs, or reach the network?
- **Record:**
  - [`scripts/field-trial-engine.mjs`](../../../scripts/field-trial-engine.mjs)
    line 32:
    `GIT_ENV = {...process.env, GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0"}`.
    The helpers `git()` and `localCommit()` run `rev-parse` and `archive`
    with this environment and no `-c` options.
  - For comparison,
    [`scripts/saloon-patches.mjs`](../../../scripts/saloon-patches.mjs) and the
    saloon design ("Safety") clear every `GIT_*` variable first. They then set
    `GIT_NO_REPLACE_OBJECTS=1` and `GIT_CEILING_DIRECTORIES`, and pass
    `--no-replace-objects` and `-c protocol.allow=never`.
- **Observed (by reading, not run):**
  1. Inherited `GIT_DIR`, `GIT_WORK_TREE`, `GIT_OBJECT_DIRECTORY` or
     `GIT_ALTERNATE_OBJECT_DIRECTORIES` are passed through. A stray
     environment can point the scout, confirm and witness scripts at another
     object store than the checkout at `ROOT`.
  2. Replace refs (`refs/replace/*`) are honoured, because neither
     `--no-replace-objects` nor `GIT_NO_REPLACE_OBJECTS` is set. Git then reads
     the replacement object's content wherever the original ID is named.
  3. `GIT_NO_LAZY_FETCH` exists only in newer Git. The saloon
     [tasks.md](../night-shift-saloon/tasks.md) records Apple Git 2.39.5 on
     the run machine and notes that this version "predates
     `GIT_NO_LAZY_FETCH`". Without `protocol.allow=never`, a partial clone
     could fetch missing blobs during `git archive`.
- **Threat model:** These are local misconfiguration and integrity risks for
  receipts. None is an attack surface open to other people. In each case the
  scripts would still print object IDs that look valid.
- **Status:** open.
- **Acceptance check:**
  - `GIT_ENV` is built the same way as the saloon reader's: `GIT_*` removed,
    then `GIT_NO_REPLACE_OBJECTS=1` and `GIT_NO_LAZY_FETCH=1` set.
  - Every call passes `--no-replace-objects -c protocol.allow=never`.
  - A test in a temporary repository adds `refs/replace/<card blob>` and
    checks one of two outcomes: `openTrialEngine` extracts the original
    content, or it refuses. It must never extract the replacement while
    reporting the original ID.
  - A second test runs with `GIT_DIR` set to another temporary repository
    and checks that the inputs are still read from `ROOT`.

## S2. Passed reading: input shapes are validated before any Git or file access

- **Question:** Are the untrusted arguments `ref`, `change`, `expectedInputs`
  and `dir` checked before they are used?
- **Record:** `field-trial-engine.mjs`:
  - `checkRef` accepts only `HEAD` or a full lowercase 40- or 64-hex ID, so
    no option-looking or revision-expression `ref` reaches Git.
  - `checkChange` requires exactly four keys, `CARD_ID`
    `^[a-z]+(?:-[a-z]+)*$`, a field from the allowlist, and safe integers.
  - `checkExpected` requires exactly the four `INPUT_PATHS` keys, each with a
    full object ID.
  - `prepareDir` requires an absolute path that is new or empty, created with
    mode `0o700`.
  - `buildCandidate` accepts only troops present in `DECKS`.
- **Observed:** The card slug cannot contain `/` or `.`, so
  `join(base, CARDS, "<card>.json")` stays inside the extracted tree.
- **Status:** answered.
- **Acceptance check:** A test for `openTrialEngine` rejects each of the
  following with the named error before creating `dir`:
  - `ref` values `"--output=x"` and `"main"`;
  - card `"../x"`;
  - a fifth key in `change`;
  - `expectedInputs` missing one path.
