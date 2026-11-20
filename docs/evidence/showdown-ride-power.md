# K-039 cold start: installed Power answers "Why would I decline this ride?" (infrastructure stage)

Date: 2026-11-20, 12:55-12:57 PST (America/Los_Angeles). Worker: Kiro CLI 3.5.0 (claude-opus-5.5), branch
`kiro/showdown-ride-power` from `bf510f3`. No rule, card, deck, save, art or UI changed. No human played.

**Stage.** The search worker's `../contract.json` was present, but `../cases-ready.json` was not. So no searched ride case
existed. This stage tests the plumbing on one existing verified decision: the Outrider README's own `--replay`
point (Bone Fence, Cowboy turn 7, ride `{"type":"attack","slot":1,"target":"base"}` legal). It is infrastructure only and
supports no ride advice.

## Change (Power 1.3.0 to 1.4.0)

- New tool `inspect_ride_decision` ([ride.mjs](../../.kiro/powers/orb-duel-review/ride.mjs), wired in
  [server.mjs](../../.kiro/powers/orb-duel-review/server.mjs)). Its only input is a fixed `case` id. The tool:
  - re-derives the decision from the bound project's `experiments/showdown-outrider/compare.js` `replay`;
  - compares it with the packaged receipt [cases/outrider-replay-infrastructure.json](../../.kiro/powers/orb-duel-review/cases/outrider-replay-infrastructure.json),
    which was recorded with `node ride.mjs --record`;
  - reports the bound `game.commit` (read from git files, no shell), the code-closure fingerprint (8 files: `compare.js`,
    `src/match/showdown-turn.js` and their imports), the built page SHA-256, and the position as `viewFor(cowboy)`.
- `replayUrl` is set only when the receipt names a `?turn=` id that `src/match/showdown-turn.js` allowlists and a built page exists.
- `advice.allowed` is true only when all of these hold: verdict `pass`, a routed URL, and `evidence.pairedOutcomes` in the receipt.
  Otherwise the tool lists the reasons and the skill tells Kiro not to give advice.
- New skill [showdown-ride-decision](../../.kiro/powers/orb-duel-review/skills/showdown-ride-decision/SKILL.md). Two keywords were
  added to `plugin.json`: `outrider ride` and `decline this ride`.
- The output has no seed, prefix, salt, policy choice or outcome. The Wizard hand, deck and traps are empty lists (counts only).

## Scripted checks (not native)

`node --test .kiro/powers/orb-duel-review/test/*.test.mjs`: 19 pass, 0 fail. The 12 earlier tests pass, and
[test/ride.test.mjs](../../.kiro/powers/orb-duel-review/test/ride.test.mjs) adds 7:

- `pass` on this checkout, with advice withheld and no URL.
- The payload is public only.
- A `rules.js` edit in a copy gives `stale`, with that file named.
- An edit to `src/app.js` plus a rebuilt page stays `pass`. This is the unrelated-edit control.
- A forged position hash gives `rejected`, even with a refreshed closure hash.
- A routed copy gives a `?turn=` URL, and advice is allowed only once paired outcomes exist.
- Path and extra inputs return -32602.

Installed server over direct stdio (`PLUGIN_DATA` isolated): `serverInfo 1.4.0`, verdict `pass`, `{"case":"../../x"}` refused.

## Native runs (installed Power only)

Setup:
- Profile: `KIRO_HOME=<task>/power-verify/kiro-home`, an isolated profile. `kiro-cli powers install <worktree>/.kiro/powers/orb-duel-review`
  printed `Installed power "orb-duel-review"`. The installed copy matched the source in every file.
- Binding: `node setup.mjs <worktree> <isolated>/powers/data/orb-duel-review`.
- Page: `npm run build` at `b8e7dcc`, giving `dc55e303…83c1`.
- Sessions ran in empty directories outside every repo, with no workspace `.kiro`. Each was a fresh session, with no `--resume`.

Command for each run: `kiro-cli chat --v3 --no-interactive --trust-workspace --output-format stream-json
--trust-tools=kiro_powers,@orb-duel-review/review/inspect_ride_decision,plugin::orb-duel-review::tool::review::inspect_ride_decision "<prompt>"`.
The prompt did not name the Power, a path or a tool. Each run happened once, with no retries and no 429s.

| Run | Session | What happened | Credits |
| --- | --- | --- | --- |
| Positive: "Why would I decline this ride?" | `sess_a9a8580c-66fb-45f9-b680-59abfd36b762` | Kiro loaded skill `plugin::orb-duel-review::skill::showdown-ride-decision` on its own, then ran Tool Load on `plugin::orb-duel-review::tool::review::inspect_ride_decision` and called `@orb-duel-review/review/inspect_ride_decision {}`. All three completed. | 0.226 |
| Unrelated control: "How long should I boil an egg for a soft yolk?" | `sess_cd556f27-31e3-489d-849e-29b4cf75206c` | No skill was loaded and no tool was called. Kiro answered directly. | 0.041 |

What Kiro reported in the positive run:
- The tool's verdict was `pass`, with status `infrastructure-only`.
- Commits: game commit `b8e7dccec969…`, recorded commit `bf510f305058…`, `sameCommit` false. The closure matched (`5b817be4…fe140`, 8 files, none changed).
- Build: `dc55e303…83c1`. Replay URL: none.
- Kiro said: "I can't give a reason to decline this ride, or to take it, from verified evidence." It listed both `advice.reasons`
  and did not use the README's aggregate results as a reason.

**Which mechanism did what:**
- Workspace MCP: not used. The cwd was empty, and the stream contains no workspace-form `tool::orb-duel-review::…` id.
- Installed tool: every call used the `plugin::`/`@orb-duel-review` namespace.
- Skill loading: done by the `Kiro Powers` tool (`load_resource`).
- Automatic activation: the model chose to load the skill from the installed catalogue for an unnamed prompt. This is
  the first time it was observed. In the K-038 stage-1 run, Kiro saw the earlier skill and declined to load it.
- Tool approval: each load and call raised `pendingInteraction tool_approval`, and `--trust-tools` accepted it. Without that list,
  `--no-interactive` would have had no way to approve. That list is a permission, not a tool supplied to Kiro.

**Isolation.** SHA-256 of Alex's `~/.kiro/powers/installed.json`, installed and data `orb-duel-review` files, and `settings/` were
identical before and after the runs (16 files). Raw streams and the extractor stay outside the repo in `<task>/power-verify/logs/`.
Stream hashes: positive `3a07c7e9…1c`, negative `d3907e07…0c`.

## Gaps

- **No real ride case yet.** The case needs the search worker's frozen `decision/` files and a game route. The gate plans
  `?outrider=<id>`, but the tool recognises only `?turn=` ids. The positive run therefore proves that advice is withheld.
  It does not prove the Power gives correct advice. A rerun needs:
  - a case entry in `RIDE_CASES` mapped to `replay.json`/`results/observed.json`;
  - route detection for the gate's allowlist;
  - one positive and one negative cold prompt.
- **Reporting fault in the positive answer.** Kiro numbered the board slots from 1, so "attack from slot 1" reads as the
  Covered Wagon, but the rider is the Outrider in index 1. It also relayed the view's `ready: false` for the Outrider without
  comment. Both are the model's reporting. A clearer `rider` field or slot wording in the tool would be a later change.
  This stage ran unchanged and was not rerun.
- Activation was observed once, in one CLI session. The IDE and other prompts were not tested. Kiro CLI is the supported
  native route used here. No private UI was driven.
