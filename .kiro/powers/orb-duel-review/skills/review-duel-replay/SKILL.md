---
name: review-duel-replay
description: Give a verdict on the Orb Duel Chrome replay receipt by calling inspect_duel_replay. Use when asked whether replay evidence covers the current build.
---

Choose one route, then call `inspect_duel_replay`. Do not run Chrome or rebuild.
- Standalone build: call with `{}` or `{"target":"standalone"}`.
- Packaged web judge build: call with `{"target":"web"}`.
- Seed 60 showdown on the same standalone build: call with `{"target":"showcase"}`. Use it after the standalone call; a full claim needs both to pass.
Accept no other input, and never pass a path, URL or command.

Report, from the tool output only:
- The returned `target`.
- `verdict`: pass, fail, stale, absent or malformed, with each entry in `reasons`.
- Whether the receipt hash covers the current build hash, plus the receipt commit and seed. For showcase, the seed must be 60, and `receipt.companion.sameBuild` must be true: it shows the showcase and standalone receipts carry the same build hash.
- Steps observed out of `stepsRequired` (8, or 4 for showcase), pending step ids, and console error count.
- The receipt and screenshot paths.

Only `pass` supports the claim that the current build replayed cleanly in Chrome under that seed. Receipts do not show appearance or fun; those need rendered review and human playtests. For `stale` or `absent`, say the replay must be rerun by the coordinator.

## Character asset identity
To identify the GLB behind a screenshot or replay, call `inspect_character_asset` with `{"model":"<name>"}`, where name is billy, mounted-billy, sheriff, wizard, dragon or skeleton. Accept no path. An unknown name is a protocol error; a missing or invalid file returns `isError` with the reason. Report `sha256`, `bytes`, `triangles` (or `unknown` with its reasons), skins, joints and clips from the output only. Review appearance, grip, deformation and contact using fixed-view Blender renders and the board-camera replay.

## Install and binding (v1.2.0)
The package is self-contained. Bind it to one project once: `node setup.mjs <projectRoot> <PLUGIN_DATA dir>` writes `PLUGIN_DATA/project.json`. With `PLUGIN_DATA` set and no valid binding, tools report the project as unavailable (verdict `unavailable`, or `isError` for assets); never infer a path. Without `PLUGIN_DATA` (workspace MCP) the source checkout is used.
Installed, the MCP server is named `review`, so tool names may appear namespaced by the host (for example `review` plus the tool name). Use whichever form the tool list shows.

## Play a Showdown Trail duel (v1.2.0)
The same server plays the Cowboy seat of a Showdown Trail duel against the game's own bot (canonical `src/game/showdown` via `src/match/showdown-session.js`). The tools above review the earlier lane build and its 3D assets; these three are Showdown.
- `start_showdown_duel` with `{}` (Boot Hill) or `{"duel":"<trail id>"}`. Returns `session`, `revision`, `view`, numbered `intents`, `events` and a seed `commitment`.
- `observe_showdown` with `{"session"}` rereads the current observation.
- `act_showdown` with `{"session","revision","intent"}` applies one listed intent; the bot answers. A stale revision or unlisted intent is refused.
Choose from the observation only. The Wizard hand, traps and deck order are counts, and the seed is hidden until `result` is set; then `proof` holds seed, salt and actions so the duel can be replayed. `SHOWDOWN_MCP_DEBUG_SEED` fixes the deal for tests only and is never a tool input.
