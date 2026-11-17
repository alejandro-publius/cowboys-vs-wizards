# Orb Duel Review Power: installed package repair

Verified 2026-11-17 UTC with Kiro CLI 3.3.0. Package version **1.1.0**.

## What changed

The earlier reproduction note found that the installed Power was stale and that its apparent MCP tools actually came from workspace MCP. The source package also depended on files outside its install directory.

- Removed unsupported `skills` from `plugin.json`; skills are discovered under the fixed `skills/` directory.
- Added package-root `mcp.json` with the supported stdio server `review`, command `node`, and `${PLUGIN_ROOT}/server.mjs` argument.
- Bundled the project's existing GLB parser as `glb.mjs`. The installed server no longer imports `../../../scripts/audit-assets.mjs`.
- Added explicit per-Power project binding in `PLUGIN_DATA/project.json`. `setup.mjs` validates the project package name and required markers before writing the canonical project root.
- Missing or invalid installed binding produces `unavailable` / asset `isError`. The old source-checkout root inference remains only when `PLUGIN_DATA` is absent, preserving the workspace MCP route.
- Bumped both manifest and MCP server identity to 1.1.0. The read-only fixed target/model enums remain unchanged.

No workspace MCP configuration, global permissions, game code, visuals or animation changed.

## Official packaging references

Checked primary sources before implementation:

- https://kiro.dev/docs/powers/create/
- https://kiro.dev/docs/powers/installation/
- https://agent-plugins.org/schemas/1.0.0/plugin.schema.json
- https://agent-plugins.org/schemas/1.0.0/mcp.schema.json
- https://agent-plugins.org/plugin-authors/mcp-servers
- https://kiro.dev/docs/cli/headless/

The standards define plugin-root MCP configuration and supply `PLUGIN_ROOT` and `PLUGIN_DATA`. MCP's default working directory is the installed plugin, not the game repository. That is why project association is explicit instead of relying on an undocumented workspace variable.

## Reproduce a local install

Requires Node on PATH and Kiro CLI. From the game checkout you intend to inspect:

```sh
kiro-cli powers install "$PWD/.kiro/powers/orb-duel-review"
node "$HOME/.kiro/powers/installed/orb-duel-review/setup.mjs" "$PWD" "$HOME/.kiro/powers/data/orb-duel-review"
node --test .kiro/powers/orb-duel-review/test/server.test.mjs
```

Installing the same local path successfully reported `Updated power "orb-duel-review"`. The CLI refreshes its installed copy; it is not a live link to source. Reinstall after package edits. The binding persists across updates in the dedicated Power data directory.

Start a fresh session after installation. For unattended, read-only verification, the exact launch-only trust entries used successfully were:

```sh
kiro-cli chat --v3 --no-interactive --trust-workspace   --trust-tools='kiro_powers,plugin::orb-duel-review::tool::review::inspect_duel_replay,@power-orb-duel-review-review/inspect_duel_replay'   'Load plugin::orb-duel-review::skill::review-duel-replay. Use plugin::orb-duel-review::tool::review::inspect_duel_replay for standalone and showcase; report returned hashes, verdicts and steps. Do not run a browser, shell or edit files.'
```

The server's observed resource identity was:

```json
{
  "kind": "plugin",
  "name": "orb-duel-review",
  "serverName": "review",
  "toolName": "inspect_duel_replay"
}
```

Kiro displayed calls as `@orb-duel-review/review/inspect_duel_replay`. This is distinct from the legacy workspace tool resource `tool::orb-duel-review::inspect_duel_replay`. The skill and bundled MCP both loaded from the installed Power.

## Actual installed-only verification

Verification session directory was outside the game repository, with no workspace MCP configuration:

`/Users/alexvintera/Documents/Codex/kiro-power-verification-20261116-202121`

The bound project was an isolated copy of the existing standalone HTML and standalone/showcase receipts from `.worktrees/kiro-final-release-check`. Those receipts identify commit `e9aeb06` with `uncommittedChanges: true`. They are historical browser evidence, **not a new browser run**.

| Fresh Kiro V3 session | Target | Result | Observed steps | Console errors |
| --- | --- | --- | --- | --- |
| `sess_bf0ea5b0-b39e-42dd-847c-8fab27b606a0` | standalone | pass | 8/8 | 0 |
| Same session | showcase | pass | 4/4 | 0 |
| `sess_58ad5f75-2c8e-4703-b7d8-c530fe20d523` | standalone | stale | 8/8 | 0 |
| Same session | showcase | stale | 4/4 | 0 |

Matching page: 64,355,866 bytes, SHA-256 `a5d0c756077e89afa4f8a107c64e863a7d09cba48456f8229a8b42b4fa208bd2`. Both receipts covered this file; showcase's companion hash matched standalone.

For stale rejection, only the isolated HTML copy received a comment. It became 64,355,912 bytes, SHA-256 `6938609d359c5bac0642ea34201dfaa06c6f63430f0035ce4bb19159ce6b34de`. Both calls returned `stale` with `receipt hash differs from the current build (stale receipt)`. The original release and receipts were untouched. The copy was then restored and its original hash verified.

The first attempted verification session stopped before any replay call because the headless skill activation permission request could not be answered. Trusting the exact `kiro_powers` tool for the next launch resolved that; no global permission rule was changed.

Final installed binding is:

`/Users/alexvintera/Documents/Codex/2026-11-14/new-chat/cowboys-vs-wizards-board/.worktrees/current-release`

Future calls inspect that checkout's current files. These copied-receipt results do not assert that a later rebuild has already been replayed.

## Focused validation

`node --test .kiro/powers/orb-duel-review/test/server.test.mjs`: **4 tests passed**, 0 failures. This starts a server from a copied plugin in an isolated directory and covers manifest/MCP fields, project setup, unbound behavior, initialize/tools listing, matching/stale receipts, invalid path/URL/model arguments, and valid/malformed GLB metadata. Server tests have a timeout and always stop their subprocesses.

A separate installed-server initialize response reported `{"name":"orb-duel-review","version":"1.1.0"}` and listed both `inspect_duel_replay` and `inspect_character_asset`.

Final installed/source SHA-256 values matched for every package file:

| File | Source and installed SHA-256 |
| --- | --- |
| `glb.mjs` | `36bdc45b50c539221488ca38fc83d8a688cbba34fdfba66ba1e322f7948aa811` |
| `mcp.json` | `40a1436f6ccce71cb25222cfe1b1c61979bcc43b5383d97b03401d74728c76d4` |
| `plugin.json` | `83462072308cc8ba5779fe103c3e4788fbf47b12bd5c94363b4c69000f9c5b38` |
| `server.mjs` | `a877b11c33d705418c090859427552a41bf030fa804cbfa74ebad49e5a6d7b41` |
| `setup.mjs` | `cb473a6e431e746c78e3367b89d7558db0846138473fe66a089fe82fe246907a` |
| `skills/review-duel-replay/SKILL.md` | `d71c848632010311f01e7e7cc3eba99e176216646f27afe69638c17749a82248` |
| `test/server.test.mjs` | `e87298ee5d8291d5e91cb4d934c90ba781b88281c6759517d67a0ec9e253c06f` |

## Attribution and preserved evidence

Kiro V3 session `sess_12bde281-5f85-46d9-9e8d-fa34dc2a8858` implemented the package, parser bundle, project setup, skill notes and tests. Codex supplied the scoped brief from official docs, reviewed the diff, added the required MCP `type: stdio` field and corresponding assertion, added test subprocess cleanup/timeouts, performed supported installation and isolated proof sessions, and wrote this note. No model override was used.

Raw worker and verification output is preserved outside the worktree at:

`/Users/alexvintera/Documents/Codex/2026-11-14/new-chat/kiro-worker-logs/power-package-fix-20261116-202121`

Files include `brief.txt`, `raw-stream.jsonl`, `verify-pass-stream.jsonl` (initial permission failure), `verify-pass-2-stream.jsonl`, `verify-stale-stream.jsonl`, `installed-protocol.jsonl`, `final-test.txt`, `final-install.txt`, `final-installed-digests.json` and `final-binding.txt`. Existing logs were not deleted.

This closes the installed Power/source mismatch and demonstrates the installed package's own MCP path. It does not claim new game behavior, visual quality, a fresh browser replay, or a particular judging score.
