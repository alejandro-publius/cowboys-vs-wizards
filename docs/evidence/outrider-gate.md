# K-011 Outrider gate: evidence (gate worker)

Author: Kiro CLI gate worker, session `sess_2109871e-40e2-4ed2-9f65-901526fa8cee`, branch `kiro/showdown-ride-gate`
(base bf510f3), 2026-11-20 PST. Local only, not pushed. Spec: [`.kiro/specs/outrider-gate/`](../../.kiro/specs/outrider-gate/requirements.md).
No rule, card, deck, reward or save change. No human play. Fable decides whether any case becomes advice or a bounty;
the search worker reports its cue as unsupported, so nothing here is advice.

## Dependency
`experiments/showdown-outrider/decision/` imported byte-identical from the search worker's data commit
`6ab88990a5536040594286f5f2d9d840a526f474` (`../cases-ready.json`), committed separately as 49c4823.
The gate reads `replay.json`, `results/observed.json` and `decision.js` `policy` (the layout in `../contract.json`).
It does not run the search worker's checker: it replays each arm with its own `playArm` through `createShowdownSession`.

## Results (all actually run in this session)

| Check | Result |
| --- | --- |
| `node scripts/outrider-gate.mjs --check` on the 10 imported cases | 10 fresh, 0 stale (both arms match winner and final turn in `observed.json`, and the receipt's transcripts) |
| `node --test tests/match/showdown-outrider-gate.test.js` | 9/9 pass |
| Showdown suites (`tests/match/showdown-*`, `tests/game/showdown-*`, `prototypes/showdown/{rules,contract}.test.js`, `decision.test.js`) | 155/155 pass |
| Clean detached worktree at c4e9723: `--check`, `npm run build` (build `c4e97235fab9`, "Outrider gate: 10 verified") | pass |
| Same clean build: `browser-showdown-outrider-check.mjs` (headless Chrome, fresh profile) | 85 checks pass |
| Same clean build: `browser-showdown-check.mjs` 22 checks, `browser-showdown-turn-check.mjs` 29 checks | pass (existing game unchanged) |
| No-case build (before import): Outrider check | 4 checks pass: no control, `?outrider=` opens the menu, save intact |
| Fixture page (`--outrider-fixture`, `.artifacts/` only) | 20 checks pass |

Browser check per case: Camp control → landing with neutral lesson, no Wizard hand card and no seed in the page; the Base
and a troop are both offered once the Outrider is picked; ride arm, Restart, fight arm, play out with End turn, Retry,
Back to camp (focus returns to the control); direct `?outrider=<id>` and reload; four ids outside the list open the menu;
375 px Camp fits; saved career byte-identical throughout. It does not judge outcomes (the browser plays End turn, not the
policy); the Node replay does.

Built page: grep of the clean HTML found no `ride-only`, `fight-only`, `riderHealth` or `"winner":"cowboy"`. The page holds
each verified case's id, Trail position, seed, Cowboy prefix and turn (same exposure as the Dragon turns' seeds); the seed
never reaches the view or the DOM.

## Mutation and control (clean worktree, then discarded)
- Gameplay mutation: `rules.js` ride strike past troops 1 → 2 orbs. `--write` refused (`refused: case-j: ride: replayed
  {"winner":"cowboy","turn":11} but measured {"winner":"wizard","turn":20}`, and the rest). Receipt source hashes then
  refreshed to the mutated files: `--check` still 0 fresh, 10 stale, exit 1. Build: "Outrider gate: withheld stale".
  Browser check on that build: no Outrider control, menu for bad ids, save intact (5 checks).
- Unrelated edit: a `rules.js` comment and a new export in the lane-only `src/game/clash.js` (both change source
  hashes): `--check` 10 fresh; build "10 verified".
- The same pair runs in a disposable `src/` copy in the unit tests on the fixture.

## Native hook (G7)
`.kiro/hooks/check-outrider-gate.json` (PostFileSave, engine/session/decision/receipt paths) →
`scripts/check-outrider-gate-hook.mjs`. Receipts: [`outrider-gate/hook-receipts.jsonl`](outrider-gate/hook-receipts.jsonl)
(copied from ignored `.artifacts/outrider-gate-hook/receipts.jsonl`, output trimmed to the last line). Each carries this
session's id and `hook_event_name: "PostFileSave"`; a manual run of the wrapper would have neither.
- Trigger, fail: a save of `src/match/showdown-outrider.js` mid-edit (duplicate export) failed; the next save passed.
- Trigger, stale claim: a probe receipt naming a case with no decision files failed; removed afterwards.
- Trigger, gameplay mutation: saving the ride-strike mutation in `rules.js` → failed, "0 fresh, 10 stale"; the revert
  save → passed. A first attempt with two saves in quick succession produced two passing receipts with the same
  timestamp: the hook ran after the revert, so it missed the mutated state. Recorded, not counted as a proof.
- Trigger, unrelated: a comment-only `rules.js` save → passed, "10 fresh".
- Skip: saves of the three spec Markdown files and other non-matching files produced no receipt.
- Not shown: Kiro IDE behaviour (no IDE run), and whether a non-zero hook exit is surfaced to a user.
- `node scripts/outrider-gate.mjs --check` run from a shell is the manual path and leaves no receipt.

## Not done or pending
- The Sheriff's Ledger payload and hook are unchanged; this gate is a separate check modelled on its `--check`.
- X-041 SpecGuard README and videos 55 and 24 were not read in this session.
- `docs/kiro-build-log.md` not edited (coordinator owns it); `../gate.md` carries the entry.
- `npm test` (lane `verify-duel.mjs`) not run: no lane file changed.

## Repair: one Camp entry, Ledger comparison, Night Watch relation (2026-11-20 PST, same Kiro CLI session)

Commits 870bff1 (code) and ce6bdfe (check), on top of the coordinator's merge b72e5eb. Everything below was run on a
clean detached worktree at ce6bdfe unless it says otherwise.

What changed for the player and Fable:
- Camp: one neutral control, "Try an Outrider turn" (`#camp-outrider-turn`, case-e). The ten buttons are gone. All ten
  cases stay in `experiments/showdown-outrider/decision/` and in the gate check and receipt.
- Sheriff's Ledger (collapsed, after the card table): "Outrider experiment (for review, not advice)" with a status line,
  Position 1 (case-e) and Position 2 (case-a) as public boards only, "Open Position 1/2" links (the same `?outrider=` ids),
  and the Night Watch relation. Results appear only after "Show the measured comparison" and leave the DOM when hidden.
  Revealed text: each position's ride and fight result; that the pair is one of each kind from 23 reversals (12 ride-only,
  11 fight-only) among 184 decisions in 300 seeds; that each result depends on every later move (greedy Cowboy policy,
  level-0 Trail bot); the cue's holdout 3 of 7 against always-ride 5 of 7, unsupported; no general rule proven.
  Screenshots: [before reveal](outrider-gate/ledger-before-reveal.png), [revealed](outrider-gate/ledger-revealed.png),
  [stale build](outrider-gate/ledger-stale.png).
- Night Watch relation: `scripts/outrider-ledger.mjs` takes the import closure of `prototypes/showdown/rules.js` (the file
  the Night Watch simulator loads and hashes as `rulesBlob`) at the receipt's commit e813ae8 and in this tree, and compares
  git blob ids. Result on ce6bdfe: the 4 files are byte-identical and the rules blob 66538ac matches. The Ledger keeps the
  receipt's date (November 19, 2026, 11:46 PM PST), trigger, bot (level 2 both seats), seeds 0–999 and says it measures the
  whole ruleset, not this move, and names the files the Outrider path uses that the run did not exercise
  (contract.js, progress.js, trail.js, showdown-session.js, showdown-outrider.js). No new Night Watch run was needed or made.
- Stale: readable status, no results, no research numbers, no reveal, no links, no Camp control; curated ids open the menu.

Build receipts (what each page was given, `.artifacts/outrider-ledger/` copied here):
| Build | Gate | Camp | Links | Ledger | Results in payload | Night Watch engine |
| --- | --- | --- | --- | --- | --- | --- |
| [clean ce6bdfe](outrider-gate/build-receipt-fresh.json) | 10 of 10 fresh | case-e | case-a, case-e | fresh | yes | same 4 files |
| [ride strike 1 → 2 orbs](outrider-gate/build-receipt-stale.json) | 0 of 10 | none | none | stale | no | differs: rules.js |
| [rules comment + clash.js export](outrider-gate/build-receipt-unrelated.json) | 10 of 10 fresh | case-e | case-a, case-e | fresh | yes | differs: rules.js |

The unrelated edit keeps the Outrider claims fresh (semantic), while the Night Watch relation honestly reports a byte
difference: that receipt's numbers are then labelled as describing the earlier rules.

Checks on the clean worktree: gate `--check --ledger` 10 fresh; Node suites 166/166 (Showdown, Sheriff's Ledger, gate,
decision tests); `build-sheriffs-ledger.mjs --check` current; headless Chrome `browser-showdown-outrider-check` 23/23
(Camp entry, Ledger neutral before reveal, reveal text equals the build data, hide removes it, no measured text in the DOM
on the Camp or during either duel, Camp hidden during the duel, both arms, Restart, Retry, Back to camp returning focus to
the Camp control or the Ledger link, direct URL, reload, bad ids, 375 px, save byte-identical); `browser-ledger-check` 12/12;
`browser-showdown-check` 22/22; `browser-showdown-turn-check` 29/29. Mutated build: `--write` refused, refreshed source
hashes still 0 fresh (exit 1), browser 6/6 (stale status, no links or reveal, `?outrider=case-e` and `case-a` open the menu).

Disclosed limit: on a fresh build the measured results for the two positions are inside the page's script as data (the
Ledger needs them to reveal); they are never in the position objects, the duel view or the DOM before the reveal.

Native hook (this session, receipts 10–13 in [hook-receipts.jsonl](outrider-gate/hook-receipts.jsonl), now with `--ledger`):
mutation save → failed, "Ledger: stale; links none; camp none; Night Watch e813ae8 engine differs"; revert save → passed,
"Ledger: fresh … same 4 files"; comment-only save → passed with "engine differs: rules.js"; revert → passed. Each save was
read before the next. The edits to `src/ui/*`, `scripts/*` and these docs produced no receipt (outside the matcher).

## CI repair: shallow checkout (2026-11-20 PST, same Kiro CLI session)

PR 173 CI (`actions/checkout`, depth 1) failed two assertions because the Night Watch receipt's commit e813ae8 is not
fetched. Reproduced locally on a depth-one clone of ade247c: 8 pass, 2 fail with the same messages.
Fix (426fd03): [`outrider-gate/night-watch-engine.json`](outrider-gate/night-watch-engine.json) records the four engine
blob ids that `git rev-parse e813ae8:<path>` returns in a full-history checkout. `scripts/outrider-ledger.mjs` uses git
whenever the commit is present, and refuses the comparison if the snapshot disagrees with git. Without the commit it uses
the snapshot only if it names that commit and its `prototypes/showdown/rules.js` blob equals the receipt's `rulesBlob`.
Current files are hashed as git blobs in Node. When there is neither history nor a snapshot it still reports "cannot compare".
Depth-one clone of 426fd03: gate and Ledger tests 21/21; build "10 of 10 fresh"; engine `from` = snapshot, same 4 files;
headless Chrome Outrider check 23/23 with the rendered "4 engine files ... byte-identical ... rules blob matches" line.
Mismatch there (a comment added to `cards.js`): "engine differs: src/game/showdown/cards.js". Full history: Showdown
suites 153/153; a tampered snapshot is refused (test).
