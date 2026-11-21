# Devpost lift: judge demo route check (worker `judges`, K-099, K-101, K-102)

November 20, 2026, America/Los_Angeles. Kiro CLI worker, model claude-opus-5.5, branch `kiro/devpost-lift-judges`, base `main` `ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df`. Docs only: no rule, card, wording, art or game file changed. No media frames were viewed. Nothing was uploaded, published or submitted.

## Route chosen

Showdown title → Play → Camp → Dragon turn 5 (two deals) → Sheriff's Ledger → Night Shift review of Sheriff health 3 → 4 (rejected) → native Workflow `wf_0756c413da3e189f`. Sequence and criteria matrix: [judge demo script](../submission/judge-demo-script.md#current-one-closing-loop-decision-to-reviewed-candidate-owner-rehearsal-about-216).

## Checks rerun on `ea183ee` (macOS, Node, headless Chrome)

| Command | Result |
| --- | --- |
| `node --test tests/match/showdown-turn.test.js tests/match/sheriffs-ledger.test.js` | 21 of 21 passed |
| `node experiments/showdown-dragon-strategy/rival-search.mjs --print`, compared with `cmp` to `rival-cases.json` | Byte-identical. 64 seeds (64–127), 60 tested, 20 with different winners, seed 3 A `c15` B `w10`, shrunk to seed 70 (A `w14`, B `c17`) |
| `npm run build` | `dist/cowboys-vs-wizards-board-duel.html`, build `ea183ee29dbd`, SHA-256 `d570e411…bc3c` |
| `node scripts/browser-showdown-turn-check.mjs dist/cowboys-vs-wizards-board-duel.html` | 29 of 29 (`file://` only; the HTTP variant was not rerun) |
| `node scripts/browser-ledger-check.mjs dist/cowboys-vs-wizards-board-duel.html` | 12 of 12, including "the Night Shift review state of this run is shown (rejected)" |
| `shasum -a 256` on both local copies of `Showdown_Dragon_Decision.mp4` | Both `cd7353bf…7883`. Receipt duration 85.367 s |
| `node scripts/check-links.mjs` | 326 Markdown files, 1,095 relative links, 0 broken. It checks file targets, not `#` anchors, so a throwaway heading-slug script (not committed) checked 47 anchors in the edited files and the files that link into them: 0 broken after the fixes below |

## Findings for the owner

- The cut's Bear Trap log line predates the fatal-trap wording fix. The current build reads "defeated before it struck". Engine events are unchanged.
- The in-game Ledger cites the direct CLI review bundle. The native Workflow reproduced the same shares and verdict. The captions say "the same draft, rerun as a Kiro Workflow".
- `judge-demo-script.md#part-2-first-time-human-playtest-protocol`, linked from three files, had stopped resolving after the heading gained "(lane duel)". An explicit anchor now restores it. Likewise `JUDGE-GUIDE.md` linked `kiro-brag-sheet.md#proof-on-the-current-build`, which no heading produced. An explicit anchor now marks the reproducible-checks section.

## Not done

`scripts/night-review.mjs verify --rerun` was not run: its game records are not committed. No HTTP or WebKit browser run, no live-site check (no network), no B or C capture, no narration, and no human observation.
