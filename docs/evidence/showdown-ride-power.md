# K-039 cold start: installed Power answers "Why would I decline this ride?"

## Stage 3 (current): Camp-routed case, opened link (2026-11-20 PST, same worker)

Branch `kiro/showdown-ride-power` after the coordinator merged gate and search into it (`b72e5eb`). Candidate head
`a8c8673df6a33a40cd9d89b7a653b3a3eab7050e`. No game, gate, rule or Dragon file changed; only `.kiro/powers/orb-duel-review/` and this doc.

**Power 1.5.0.** New default case `outrider-camp-case` = search `case-e`, the first `fight-only` label in `results/observed.json`
([camp.mjs](../../.kiro/powers/orb-duel-review/camp.mjs), [receipt](../../.kiro/powers/orb-duel-review/cases/outrider-camp-case.json)).
- Semantic freshness comes from the game's own K-011 gate (`scripts/outrider-gate.mjs` `loadDecision`/`replayAll`/`judge`). Both arms
  are replayed in the bound tree against `results/observed.json` and the gate's transcript digests. File hashes decide nothing.
- A fresh session's landing must equal `positions.json`, and both arms must be legal there.
- The link is issued only from a built page (`dist/web/index.html` or the standalone page) that meets both conditions:
  - the page carries the bound tree's own build label (`scripts/graybox-build-label.mjs`). A `+local` tree or an older label is refused.
  - the page carries this case's exact verified entry, in esbuild's minified form.
  Otherwise the verdict is `stale`, with no link, no outcome and no advice. A stale or missing page therefore cannot stand in for the head.
- Links:
  - `links.local`: `http://127.0.0.1:47391/?outrider=case-e`, with its `serve` command. It is verified as page bytes at this head.
  - `links.public`: `https://alejandro-publius.github.io/cowboys-vs-wizards/?outrider=case-e`. It is canonical once deployed and is marked as not checked by the tool.
- `judgeOnly` is kept apart from `decision.position`. It holds each choice's winner and turn, and the line of `[Cowboy, Wizard]` Bases and standing troops at each changed turn.
- `advice`: `allowed` true, `scope` "this example only", `general` false, with the holdout reason.
- Port 8765 was already held by an unrelated `http.server` running since Nov 18 (not touched), so the link uses 47391.

**Already live vs locally verified.** On 2026-11-20 the mirror's `build.json` reported commit `bf510f3`, which predates the gate. So the public
link is **not live** for this head; that build has no `?outrider` route. Only the local link is verified.

**Checks (this head)**
- `node --test .kiro/powers/orb-duel-review/test/*.test.mjs`: 29 pass. [test/camp.test.mjs](../../.kiro/powers/orb-duel-review/test/camp.test.mjs) uses throwaway git copies:
  - a current page gives `pass`, with a link, judge-only lines, example-only advice, and no seed or prefix;
  - each of these gives `stale` with no link, outcome or advice: a page at an older commit, a page without the case, no page, uncommitted page sources;
  - the ride strike changed from 1 to 2 orbs, committed and with a page rebuilt at the new head, gives `stale` via the gate;
  - a comment-only commit gives `pass`. This is the unrelated-edit control.
- `node --test tests/match/showdown-turn.test.js tests/match/showdown-outrider-gate.test.js`: 20 pass (Dragon and gate unchanged).
  `node scripts/outrider-gate.mjs --check`: 10 fresh.
- Real browser, headless Chrome, fresh profile. `node scripts/build-graybox.mjs --hosted` at `a8c8673` gave label `a8c8673df6a3`, "10 verified".
  The page was served with the tool's own serve command. The served bytes' SHA-256 equalled `dist/web/index.html` (`041652fe…9240`), as the tool reported.
  - `node scripts/browser-showdown-outrider-check.mjs http://127.0.0.1:47391/` passed **85/85**. It covers the Camp, both arms, Restart, Retry,
    the direct URL, reload, bad ids, 375 px, and the save byte-identical at the end.
  - A separate open of `http://127.0.0.1:47391/?outrider=case-e` landed on "Experiment: an Outrider turn · turn 3 · your turn" with:
    - Outrider in Cowboy slot 0 at 2 of 3 orbs, "Can attack";
    - Skeleton at 3 orbs in Wizard slot 0;
    - Bases 5 and 4;
    - hand Billy, Billy, Deadeye, Outrider;
    - neutral lesson text, and no outcome or Wizard hand card.
    This matches `decision.position`. The server was stopped afterwards.

**Native runs (installed only, isolated `KIRO_HOME`, empty cwd, fresh sessions, same command and `--trust-tools` as below, once each)**

| Prompt | Session | Calls (all `completed`) | Credits |
| --- | --- | --- | --- |
| Why would I decline this ride? | `sess_09043bfd-518e-4085-b6e5-87f7d1e97393` | Kiro Powers load `plugin::orb-duel-review::skill::showdown-ride-decision`; Tool Load; `@orb-duel-review/review/inspect_ride_decision {}` | 0.261 |
| How do I patch a small hole in drywall? | `sess_a778765f-4281-4dee-abe4-125266ec1131` | none | 0.085 |

What the positive run answered:
- verdict `pass`, commit `a8c8673…`, label `a8c8673df6a3`, both pages current with `041652fe…`;
- the local URL with its serve command, and the public URL "not verified live", quoting the rule;
- the position with slot 0 named correctly;
- "in this example only": riding takes the Wizard Base from 4 to 3 on turn 3, then the Cowboy Base falls to 3 by turn 7 and to 0 on turn 10, a Wizard win.
  Declining keeps the Wizard Base at 4 through turn 9, and the Cowboys win on turn 23 with Base 3;
- `advice.general` false, with the holdout reason quoted: "Don't turn this into a rule, for example about the rider's health".

There were no 429s. Alex's `~/.kiro` was unchanged (16 files). Stream SHA-256 prefixes: `b9cd8e7a`, `5c7d1401`.

**Mechanisms:**
- Native skill activation: the skill was loaded unprompted, and the negative run loaded nothing.
- MCP tool use: the installed plugin namespace only.
- Browser launch: Kiro did **not** open a browser. It reported the URL. The URL opening at the decision was verified separately by the headless Chrome runs above,
  which were scripted and not native Kiro.

**Stage 3 gaps:**
- The public mirror is not deployed at this head, and publishing was out of scope.
- The explanation is one deterministic bot line per choice on one case. It is not human play.
- The local link works only while the serve command runs.
- The IDE was not tested.

---

History: stages 1 and 2 below are unchanged records from before the gate landed.

Date: 2026-11-20, 12:55-13:10 PST (America/Los_Angeles). Worker: Kiro CLI 3.5.0 (claude-opus-5.5), branch
`kiro/showdown-ride-power` from `bf510f3`. No rule, card, deck, save, art or UI changed. No human played.

## Stages

- **Stage 1, infrastructure.** `../cases-ready.json` did not exist yet. This stage used the Outrider README's own `--replay`
  point (Bone Fence, Cowboy turn 7). Case `outrider-replay-infrastructure` carries no ride or decline outcome.
- **Stage 2, searched case.** `../cases-ready.json` then named search commit `6ab8899`. Its
  `experiments/showdown-outrider/decision/` files were imported unchanged as commit `1908eaa`, and `check.mjs` printed
  "ok: 10 case(s) reproduce". Case `outrider-ride-search` maps to search label `case-e`. The selection rule was the first label
  whose decline arm won in `results/observed.json`. The search's holdout scored its cue as unsupported (3 of 7 against always-ride 5 of 7).

## Change (Power 1.3.0 to 1.4.0)

- New tool `inspect_ride_decision` ([ride.mjs](../../.kiro/powers/orb-duel-review/ride.mjs), wired in
  [server.mjs](../../.kiro/powers/orb-duel-review/server.mjs)). Its only input is a fixed `case` id. The default is `outrider-ride-search`.
- For each case, the tool re-derives the decision from the bound project and compares it with a packaged receipt in
  [cases/](../../.kiro/powers/orb-duel-review/cases/). Receipts are recorded with `node ride.mjs --record <root> <case>`. For a searched case:
  - a fresh `createShowdownSession` must reproduce the `positions.json` view, and both arms must be legal;
  - both arms must replay to `results/observed.json`;
  - the four data files must match their recorded SHA-256.
- Output fields:
  - `game.commit`: read from git files, with no shell.
  - Code-closure fingerprint: 10 files for `decision.js` and `src/match/showdown-turn.js` with their imports.
  - Built page SHA-256.
  - `decision.ride` and `decision.decline`.
  - The position as `viewFor(cowboy)`.
  - `replayUrl`: set only when the receipt names a `?turn=` id that `src/match/showdown-turn.js` allowlists and a page is built.
- Outcomes, seeds, prefixes and case labels never leave the tool.
- Advice gate: `advice.allowed` requires all of these:
  - verdict `pass`;
  - a routed URL;
  - verified paired outcomes;
  - for searched cases, a cue the holdout supports.
  Otherwise the tool lists the reasons.
- New skill [showdown-ride-decision](../../.kiro/powers/orb-duel-review/skills/showdown-ride-decision/SKILL.md), with plugin keywords
  `outrider ride` and `decline this ride`. After stage 1, the skill was told that slots number from 0 (see Gaps).

## Scripted checks (not native)

- `node --test .kiro/powers/orb-duel-review/test/*.test.mjs`: 22 pass, 0 fail. The 12 earlier tests pass, and
  [test/ride.test.mjs](../../.kiro/powers/orb-duel-review/test/ride.test.mjs) adds 10:
  - both cases `pass` on this checkout, with advice withheld;
  - payloads are public only, and the searched view has no Wizard `hand`/`deck`/`traps` keys;
  - a `rules.js` edit in a copy gives `stale` for both cases, with that file named;
  - an edit to `src/app.js` plus a rebuilt page stays `pass`. This is the unrelated-edit control;
  - a forged position hash gives `rejected`, even with a refreshed closure hash;
  - a one-turn edit to `observed.json` gives `rejected`, and the data hash is reported as stale;
  - a routed copy gives a `?turn=` URL, and advice opens only with outcomes;
  - paths and extra inputs return -32602.
- `node --test experiments/showdown-outrider/decision/decision.test.js experiments/showdown-outrider/outrider.test.js`: 14 pass.
- Installed server over direct stdio (`PLUGIN_DATA` isolated): `serverInfo 1.4.0`, `pass`, `{"case":"../../x"}` refused.

## Native runs (installed Power only)

Setup:
- Profile: `KIRO_HOME=<task>/power-verify/kiro-home`, an isolated profile.
- Install: `kiro-cli powers install <worktree>/.kiro/powers/orb-duel-review` printed "Installed", then "Updated" for stage 2.
  The installed copy matched the source in every file.
- Binding: `node setup.mjs <worktree> <isolated>/powers/data/orb-duel-review`.
- Page: `npm run build` before each stage.
- Sessions: each ran in its own empty directory outside every repo, with no workspace `.kiro` and no `--resume`.

Command for each run: `kiro-cli chat --v3 --no-interactive --trust-workspace --output-format stream-json
--trust-tools=kiro_powers,@orb-duel-review/review/inspect_ride_decision,plugin::orb-duel-review::tool::review::inspect_ride_decision "<prompt>"`.
The prompt did not name the Power, a path or a tool. Each run happened once, with no retries.

| Stage | Prompt | Session | Calls (all `completed`) | Credits |
| --- | --- | --- | --- | --- |
| 1 | Why would I decline this ride? | `sess_a9a8580c-66fb-45f9-b680-59abfd36b762` | Kiro Powers load `plugin::orb-duel-review::skill::showdown-ride-decision`; Tool Load `plugin::…::inspect_ride_decision`; `@orb-duel-review/review/inspect_ride_decision {}` | 0.226 |
| 1 | How long should I boil an egg for a soft yolk? | `sess_cd556f27-31e3-489d-849e-29b4cf75206c` | none | 0.041 |
| 2 | Why would I decline this ride? | `sess_5e68d1d2-6d01-4c06-b25d-0ffb8573d2e6` | same three as stage 1 | 0.198 |
| 2 | What is a good way to keep basil fresh in the kitchen? | `sess_700196db-492c-45fa-860e-ce7c28e4b725` | none | 0.076 |

What Kiro answered in the positive runs:
- **Stage 1:** "I can't give a reason to decline this ride, or to take it, from verified evidence." Details:
  - game commit `b8e7dcc`, recorded commit `bf510f3`, `sameCommit` false;
  - closure `5b817be4…` unchanged;
  - build `dc55e303…`, no URL;
  - both advice reasons listed.
- **Stage 2:** "I can't give a verified reason to decline this ride." Details:
  - game commit `3f138bb`, recorded commit `1908eaa`, `sameCommit` false;
  - closure `6b3b3c4e…` unchanged, 10 files;
  - build `ebf14896…`, `replayUrl` null;
  - reasons: no route, and the cue failed its holdout;
  - position given in plain words with the ride (slot 0 to the Base) and the decline (slot 0 attacks the Skeleton);
  - no outcome stated.

**Which mechanism did what:**
- Workspace MCP: not used. The cwd was empty, and the streams contain no workspace-form `tool::orb-duel-review::…` id.
- Installed tool: every call used the `plugin::`/`@orb-duel-review` namespace.
- Skill catalogue: each session advertised both Power skills (`review-duel-replay`, `showdown-ride-decision`) with `origin: power`.
- Skill loading: done by the `Kiro Powers` tool.
- Automatic activation: in both positive runs the model chose `showdown-ride-decision` for an unnamed prompt. In the K-038 stage-1
  run, Kiro had seen the earlier skill and declined to load it. In both negative controls Kiro loaded nothing.
- Tool approval: each load and call raised `pendingInteraction tool_approval`, and `--trust-tools` accepted it. That list is a
  permission. It supplies no tools.

**Isolation and service.**
- Alex's profile: SHA-256 of `~/.kiro/powers/installed.json`, the installed and data `orb-duel-review` files, and `settings/`
  matched before and after all runs (16 files).
- Throttling: stage 2's control logged one HTTP 429, which the CLI retried on its own. No credit limit was hit.
- Raw logs: streams and the extractor stay in `<task>/power-verify/logs/`. Stream SHA-256 prefixes: `3a07c7e9`, `d3907e07`, `78176d20`, `4422fc36`.

## Gaps

- **No ride advice is endorsed by design.** The game routes no ride case. The gate worker plans `?outrider=<id>`, but the tool
  recognises only `showdown-turn.js` `?turn=` ids, and the search found no supported cue. A routed, cue-supported case would
  need three things:
  - route detection for the gate's allowlist;
  - a new receipt;
  - one more positive and negative cold prompt.
- **Stage 1 reporting fault.** Kiro numbered slots from 1, so "attack from slot 1" read as the Covered Wagon. The skill now says slots
  number from 0, and stage 2 reported slot 0 correctly. Both stages relayed the view's `ready: false` for the rider without comment.
- **Coverage.** Activation was observed in CLI `--no-interactive` sessions only. The IDE was not tested, and no private UI was driven.
