---
name: review-duel-replay
description: Give a verdict on the Orb Duel Chrome replay receipt by calling inspect_duel_replay. Use when asked whether replay evidence covers the current build.
---

Choose one route, then call `inspect_duel_replay`. Do not run Chrome or rebuild.
- Standalone build: call with `{}` or `{"target":"standalone"}`.
- Packaged web judge build: call with `{"target":"web"}`.
Accept no other input, and never pass a path, URL or command.

Report, from the tool output only:
- The returned `target`.
- `verdict`: pass, fail, stale, absent or malformed, with each entry in `reasons`.
- Whether the receipt hash covers the current build hash, plus the receipt commit and seed.
- Steps observed out of 8, pending step ids, and console error count.
- The receipt and screenshot paths.

Only `pass` supports the claim that the current build replayed cleanly in Chrome under that seed. Receipts do not show appearance or fun; those need rendered review and human playtests. For `stale` or `absent`, say the replay must be rerun by the coordinator.
