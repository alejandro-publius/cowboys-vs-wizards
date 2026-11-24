# Saloon Sheriff ruling: independent replay audit

**Date:** 2026-11-23 (America/Los_Angeles)
**Performed by:** Kiro (claude-opus-5.5) in a local detached checkout, as a scoped worker. This is a local check run by a Kiro session. It is not a native Kiro workflow run and adds no workflow ID.
**Source commit checked:** `e1e2d325958b82c5f99e54c4831484901d994508` (read from the checkout's HEAD; the working tree had no tracked changes, per `git status --short`).
**Ruling under audit:** [scout-ruling.json](night-shift-repair/scout-ruling.json): Sheriff (`cowboy-sheriff`) health 3 → 2, verdict `withheld`, `freshRun: false`, `applied: false`.

## What was run

| Command | Exit | Result |
| --- | ---: | --- |
| `git status --short` | 0 | Only untracked entries outside this task (a local agent config and `node_modules`). No tracked edits. |
| `node scripts/scout-ruling.mjs --verify` | 0 | `verified docs/evidence/night-shift-repair/scout-ruling.json` |
| `node --test tests/game/scout-ruling.test.js` | 0 | 7 tests, 7 pass, 0 fail |

Nothing else was run. No card, rule, metric, asset or package file was edited. No held-out confirmation cohort was played, and the original 49,280-game sweep was not re-run. Runtime of the verify command was not measured.

## What the verifier reproduced

`scout-ruling.mjs --verify` rebuilds the base and the Sheriff edit from the Git objects of the frozen base `8ec0fe7195414fb1cba94d20e6c8c8a362fea669` ([script](../../scripts/scout-ruling.mjs)). It then replays both scout cohorts for both versions and requires every stored arm value to match exactly: wins, draws, first-player wins, shares, seat skew, mean end turn and changed-winner count. That is 2 cohorts × 160 deals × 2 starting seats × 2 versions = 1,280 games, all from seeds already in [scout.json](night-shift-repair/scout.json).

| Cohort | Seeds | Starting seats | Cowboy wins, base → Sheriff 2 HP | First-player share, base → edit | Changed winners |
| --- | --- | --- | ---: | ---: | ---: |
| scout-1 | 630100000–630100159 | Cowboy first and Wizard first on every deal | 208/320 → 166/320 | 58.75% → 57.50% | 54 |
| scout-2 | 630200000–630200159 | Cowboy first and Wizard first on every deal | 192/320 → 177/320 | 58.75% → 59.0625% | 25 |

Starting seats are checked in aggregate through `firstWins` and `seatSkew` per cohort. The record stores no separate win split per starting seat, so this audit makes no per-seat claim beyond those two values.

**Archival seed:** seed `630100004`, Cowboy first, reproduced. Both versions first differ on turn 5, when the Sheriff strikes the Wizard Base (4 → 3 orbs). The attacker keeps 3 orbs on the current card and 2 on the edit. The winner changes from Wizard to Cowboy.

## One-win boundary, from raw counts

The band is NSB-1 [45, 55] from the scout's contract ([requirements](../../.kiro/specs/night-shift-balance-contract/requirements.md)). Draws were 0 in both cohorts.

- Cowboy ceiling per cohort: ⌊55 × 320 / 100⌋ = 176 wins.
- scout-1: 166 ≤ 176. NSB-1 passes. NSB-2 passes (seat skew 7.5 ≤ 9.75).
- scout-2: 177 > 176, so 177/320 = 55.3125%, which is 0.3125 pp, or exactly one win, over the ceiling. The Wizard side is 143/320 = 44.6875%, outside the floor by the same game. NSB-2 passes (9.0625 ≤ 9.75).

The ruling holds on its own stated metric: the edit fails NSB-1 on scout-2 by one game in 320. The focused test "one Cowboy win over the ceiling fails a block; a block at the ceiling holds" pins this boundary (176 holds, 177 fails). Under the tested conditions (level-2 bot on both sides, fixed decks, these 640 deals and seats), a one-game margin is small enough that a different seed range could plausibly land on either side. That is an estimate. No held-out run was made to test it, and this audit does not reinterpret the verdict.

## Fresh run versus archive replay

- **Archive replay (this audit):** deterministic recomputation of stored scout cohorts at the frozen base. Matching output shows that the archive is internally consistent and reproducible from Git objects. It is not new evidence about balance.
- **Fresh independent run:** none exists for this edit. The native workflow nominated nothing, so no confirmation cohort was played ([README](night-shift-repair/README.md)). The ruling's `freshRun: false` is accurate.
- **Wording to watch:** the focused test named "fresh confirmation independently rejects the Sheriff's sealed scout result…" plays no games. It runs `scoutNominationProblems` over the stored scout record. A reader should not read that test name as a fresh confirmation run.

## Archived Kiro run IDs and links

| Run ID | Purpose | Recorded status | Commit |
| --- | --- | --- | --- |
| `wf_80aa97dac058694f` | balance-sweep (source of this ruling) | failed, CLI exit 1 at `node scripts/field-trial-scout.mjs` | `8ec0fe7195414fb1cba94d20e6c8c8a362fea669` |
| `wf_ca086c54e37eac39` | arena-first-refusal | failed, exit 1 | `aa60fe7c377e…` |
| `wf_d5aad547ec014474` | arena-verified | completed, exit 0 | `11c46b5c9ec1…` |
| `wf_2ce9a1d3d1df7891` | forge-runner-refusal | failed, exit 1 | `87888499ac1a…` |
| `wf_a81a1969da647d72` | forge-verified | completed, exit 0 | `b00a5e18b8ad…` |

Source: [native-runs.json](night-shift-repair/native-runs.json). Observations:

- The run IDs are plain strings. No URL, exported run log or transcript accompanies them in the repo, so an outside reader cannot open a run from its ID. The status, exit codes and hook names come only from that hand-assembled record.
- `wf_80aa97dac058694f` appears in three places: native-runs.json, the README and a hard-coded constant in `scout-ruling.mjs`. `scout.json` itself does not carry it, as the README already says. The link from the ID to the scout data is an assertion in the record, not something the verifier checks.
- `scout.json` names its brief and cache under `.artifacts/…`. Those files are not committed. The committed [brief.json](night-shift-repair/brief.json) is tied to it by SHA-256, and the verifier checks that hash.

## One change for fast reproduction from a clean checkout

The verifier never clones or fetches (stated in [field-trial-engine.mjs](../../scripts/field-trial-engine.mjs)). It reads the base `8ec0fe7…` and its four input trees from local Git objects. A judge working from a shallow clone, a source tarball or a squashed fork will see a Git error, not a verdict, and nothing in the README says why.

**Recommended change:** next to `node scripts/scout-ruling.mjs --verify` in the README command table, add a short reproduce block with its precondition and expected output:

```
git cat-file -e 8ec0fe7195414fb1cba94d20e6c8c8a362fea669^{commit}   # needs full history; if missing, fetch with full depth
node scripts/scout-ruling.mjs --verify                                # expect exit 0 and "scout-2: Cowboys 177/320 … over the limit by 1"
```

This needs no npm install, because the ruling path imports only Node built-ins and repo scripts. It changes no metric, ledger or game code. It turns the archived ID into a check a skeptic can run in one step. Whoever owns the README would make that edit; this task owns only this note.

## Remaining

- The verify command's wall time is pending; it was not measured here.
- A held-out confirmation of Sheriff health 2 was not run and is out of scope. Any decision to run one goes to Fable.
