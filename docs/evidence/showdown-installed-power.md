# Installed Orb Duel Review Power on Showdown (K-038/039/042)

Date: 2026-11-20, 08:38-08:43 PST (America/Los_Angeles). Worker: Kiro CLI 3.5.0 (claude-opus-5.5) on branch
`kiro/showdown-sprint-power`, base `2fcf39b` (main). Fable's design, rules and balance were not touched; no game file changed.

## What changed (Power 1.2.0 to 1.3.0)

- New tool `inspect_showdown_receipt` ([showdown.mjs](../../.kiro/powers/orb-duel-review/showdown.mjs),
  [server.mjs](../../.kiro/powers/orb-duel-review/server.mjs)). It takes only a fixed receipt id
  (`installed-power-boot-hill` (the default) or `mcp-boot-hill`), never a path. It replays the proof from its revealed seed on the bound
  project's Showdown engine, checks each action against the listed legal intents, and compares an **engine fingerprint**.
  Verdicts: `pass`, `stale`, `unbound`, `rejected`, `malformed`, `absent`, `unavailable`. Output carries
  `kind: "showdown-gameplay-proof"` and `power: {name, version}`.
- Engine fingerprint: SHA-256 over the sorted `path sha256` lines of the static relative-import closure of the modules the
  server loads (`src/match/showdown-session.js`, `src/game/showdown/{contract,progress,trail}.js`). Today that is 7 files,
  including `src/game/card-specs.generated.js`. Observations now include `engine {sha256, fileCount}`; a finished `proof`
  includes the per-file map.
- `inspect_duel_replay` output now says `kind: "lane-duel-chrome-replay"`, `showdownProof: false`. Its page-hash binding
  covers the earlier lane build only and can no longer be read as Showdown gameplay proof.
- `setup.mjs` prints the bound project's Showdown engine fingerprint, or `absent` for an older lane-only checkout (still
  bindable). Skill text documents the new tool and verdicts.
- Compatibility: all earlier tool names, inputs and verdicts are unchanged. Additions to the output are new fields only.
  The workspace MCP route (no `PLUGIN_DATA`) still uses the source checkout. Alex's installed copy (1.1.0) was not modified.

## Isolation (no change to Alex's install)

`KIRO_HOME=<task dir>/power-verify-20261120-083800/kiro-home` gave the CLI a separate Powers/settings home, while
login stayed in the default data dir (`kiro-cli whoami` worked). `kiro-cli powers install <worktree>/.kiro/powers/orb-duel-review`
reported `Updated power "orb-duel-review"` and wrote only to the isolated home. The CLI also auto-installed the
recommended `firebase` Power there. Binding: `node setup.mjs <worktree> <isolated>/powers/data/orb-duel-review` printed
`showdown engine: 1bc43654…b8ee (7 files)`. The main checkout at `2fcf39b` has the same fingerprint. Before and after the
runs, SHA-256 of Alex's `~/.kiro/powers/installed.json`, installed `orb-duel-review` files and `data/orb-duel-review/project.json`
all matched (7/7 OK). Its binding still points at the earlier `current-release` checkout.

Sessions ran in an empty directory outside every repo, with no workspace `.kiro`. The streams contain no workspace-form
`tool::orb-duel-review::…` id and no other workspace server (for example `tripo`). Every call came from the plugin namespace.

## Native Kiro CLI runs (installed Power only)

All three runs used `kiro-cli chat --v3 --no-interactive --trust-workspace --output-format stream-json` with
`--trust-tools` listing only `kiro_powers` and the named tools in both forms (`@orb-duel-review/review/<tool>`,
`plugin::orb-duel-review::tool::review::<tool>`). Each stage ran once, with no retries.

| Stage | Session | Activation | Calls (stream titles) | Result |
| --- | --- | --- | --- | --- |
| 1 Play Boot Hill | `sess_1ad3f289-6eaf-4a06-8744-7e24c48c89cc` | The prompt did not name the skill. Kiro listed `plugin::orb-duel-review::skill::review-duel-replay` and chose **not** to load it: no automatic activation. | 2 Tool Load, `@orb-duel-review/review/start_showdown_duel` ×1, `@orb-duel-review/review/act_showdown` ×23, all `completed`, none refused | `winner: cowboy`, `reason: base`, seed hidden until the end (start output has no `seed` key) |
| 2 Matching engine | `sess_38b344e8-727c-4aed-ab65-3d524fc280de` | Explicit: `Kiro Powers` loaded `plugin::orb-duel-review::skill::review-duel-replay` | `inspect_showdown_receipt` {} and {"receipt":"mcp-boot-hill"}, `inspect_duel_replay` {} | `pass`; `unbound`; lane `absent` with `kind: lane-duel-chrome-replay`, `showdownProof: false` |
| 3 Altered copy | `sess_37925237-fc84-4188-abc3-b14d760c55dd` | Explicit, as above | `inspect_showdown_receipt` {} | `stale`, `changedFiles: ["src/game/showdown/rules.js"]` |

Tool catalogue reported by Kiro in stage 1 (verbatim IDs): `plugin::orb-duel-review::tool::review::{act_showdown,
inspect_character_asset, inspect_duel_replay, inspect_showdown_receipt, observe_showdown, start_showdown_duel}`. Calls were
displayed as `@orb-duel-review/review/<tool>`.

In stage 1 the model's own summary said "19 act_showdown calls". The stream records 23 completed calls, and the proof holds
23 actions. The fixture uses the stream's count. Stage 1 stderr also logged 4 HTTP 429 throttles, which the CLI retried
on its own. These are model reporting and service facts, not Power faults.

Stage 2 (bound to this worktree, engine `1bc43654…b8ee`):
- `installed-power-boot-hill`: `pass`, no reasons. The receipt engine matched the current engine, the replay applied 23 legal actions and reached `cowboy/base`, and
  `receiptSha256` was `7a61dadc…2260`.
- `mcp-boot-hill` (the 2026-11-19 workspace-MCP receipt): `unbound`, because "proof has no engine fingerprint". Its replay still reaches `cowboy/base`
  (28 actions). It is recorded as replayable but not bound to an engine.

Stage 3: only the isolated profile was rebound to a task-scoped copy of the engine closure and both receipts. One
comment line was appended to the copied `rules.js` (`096eb8a2…` became `7d445508…`), so the copy's engine was `78c6c11d…c220`. The verdict
was `stale`, with the reason "proof engine fingerprint differs from the current Showdown engine (stale proof)". Kiro answered that the
receipt does not support a claim about the current engine. The binding was then restored to the worktree and the copy was deleted.

## Fixture

[showdown-installed-power/boot-hill-receipt.json](showdown-installed-power/boot-hill-receipt.json) (3,841 bytes) was copied from
stage 1's **raw final `act_showdown` tool result**: `result`, full `proof` with engine map, and the start commitment
(`beb62c9e…488b`, equal to the proof's). It is not copied from the model's echo. `debugSeed: false`, seed `524182318`.

## Scripted checks (not native)

- `node --test .kiro/powers/orb-duel-review/test/*.test.mjs`: 12 pass, 0 fail. New tests cover the following:
  - An installed-style server (`PLUGIN_DATA`) on a copied engine closure gives `pass`. An edited `rules.js` gives `stale` with that file named. Restoring the file gives `pass` again.
  - An altered winner gives `rejected`. A changed seed gives a commitment failure. An injected illegal first action is caught at index 0.
  - A forged engine hash gives `stale`, `{proof:{}}` gives `malformed`, the legacy receipt gives `unbound`, and a deleted receipt gives `absent`. Path and extra inputs are refused with -32602.
  - A lane-only project gives `kind: lane-duel-chrome-replay` and Showdown `absent`.
  - The committed fixture passes on this checkout.
- Installed server, direct stdio with the isolated `PLUGIN_DATA`: `serverInfo {"name":"orb-duel-review","version":"1.3.0"}`,
  6 tools listed, and `receipt: "../../x"` refused (-32602).

## Version and hashes (installed copy = source, all 9 files)

| File | SHA-256 |
| --- | --- |
| `plugin.json` (1.3.0) | `73d65975238665ce4f1df7be97d8e9be4078e15710930327d948e785daa629d0` |
| `mcp.json` | `40a1436f6ccce71cb25222cfe1b1c61979bcc43b5383d97b03401d74728c76d4` |
| `server.mjs` | `0a942c40cce17aca7c44efcb5f59f95b71e26e0a3eb831398b520f2af0a44a0d` |
| `showdown.mjs` | `619f261ca051ebca39fcb5993fe1adf3590120c58988325ea03de899d6c973e7` |
| `setup.mjs` | `f732d56a1dec7daf67431e677fbe9e7712325b6126677c75c13a49e36da41d65` |
| `glb.mjs` | `36bdc45b50c539221488ca38fc83d8a688cbba34fdfba66ba1e322f7948aa811` |
| `skills/review-duel-replay/SKILL.md` | `efa88aabd3908cd0bb193517681f0c486edb9bde24ddc2c8cba9f72fea706504` |
| `test/server.test.mjs` | `5cc56f3322fc9c7ad882dccff4b6cf11474174906cfb821b82d6afa253b7cb02` |
| `test/showdown.test.mjs` | `361c54c0fea4a19363373b4d9b136548ddf936eb3628ab76c1ac6b7f69a21e60` |

Engine `1bc43654272bc0b99951cd11200377675f1ab554893e45e16f12c00b1ec9b8ee`, 7 files.

## Limits and pending

- **Automatic skill activation: not observed.** Kiro saw the skill but did not load it in stage 1. Explicit loading worked.
- Alex's real installed Power is still 1.1.0, bound to the old `current-release` checkout. Upgrading it and choosing its binding is
  pending a decision by Alex or the coordinator. A reinstall plus `setup.mjs` is needed, and the binding persists across updates.
- A `pass` shows that one seat's decisions on one seed replay on the same rules code. It is not a Chrome replay and makes no claim about
  appearance, clarity or fun. No human playtest happened.
- The fingerprint follows static relative imports only. A future dynamic import inside the engine would escape it.
- Raw streams, prompts, extractor and digests stay outside the repo under `<task dir>/power-verify-20261120-083800/logs/`.
