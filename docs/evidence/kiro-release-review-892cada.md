# Release verification for 892cada

November 17, 2026, Pacific time. The native Kiro CLI V3 workflow `wf_b7f50a2cb1f5a6a6` ran its three stages on clean commit `892cadac5689290b8fd109ae6a51837cc6f1c31d`. Codex selected Claude Opus 5.5 for the parent session. The final Kiro report recorded **consistent with gaps**.

| Check | Result |
| --- | --- |
| Node tests | 333 of 333 passed |
| GLB structural checks | 2 of 2 passed |
| Headless Chrome, seed 0 | 8 of 8 steps observed, zero console errors |
| Headless Chrome, seed 60 | 4 of 4 steps observed, zero console errors |
| Standalone and web builds | Both completed |
| Standalone HTML SHA-256 | `7cba5a94a51fdf457cb8115e2d7886dbf00f9e6a6e5751f0fe8a75e1c3b5bc16` |
| Web HTML SHA-256 | `b9969dd742e44e1a4ab9ae1a23b62c955a09bcd9c64c9861b8e81e79edae6753` |

The recipe did not find a standalone file at freeze time. Its web build did not emit a manifest. In a separate check, Codex verified the live commit and web HTML SHA-256 against the successful [Pages workflow](https://github.com/alejandro-publius/cowboys-vs-wizards/actions/runs/44247999970). The web HTML produced by the Kiro run had the same digest as the independently verified live HTML.

## Desktop Safari smoke check

Codex opened the deployed seed-0 match in Safari 18.1.1 on macOS 15.1.1. Selecting Sheriff exposed three available lanes and the Cancel button. Escape deselected the card and returned focus to Sheriff. Space reopened selection. Confirming the center-lane summon placed Sheriff at 3 of 3 life and reduced the hand from four cards to three. End turn ran the Wizard turn and returned control in round 2. Option-Tab moved focus to the Card art button.

This smoke check covers one desktop Safari route using the accessibility tree and keyboard. Human onboarding, the paired trap trial, iPhone Safari, VoiceOver speech and art-owner approval are pending.

## Corrected native workflow and replay review

Kiro CLI V3 completed the three stages of `wf_f48c4d50004ff115` on the clean local candidate `f76ff606c239ade094c527024ef7af8e00e6ffe0`. It reported 333 of 333 Node tests, two model structure checks and both Chrome replays with zero console errors. The standalone digest matched across a rebuild. The generated web manifest named the frozen commit and its HTML digest matched a separate hash of the built file. The report's verdict was **consistent with gaps**. The local candidate and the live commit have separate identities.

Codex bound the project's Orb Duel Review 1.1.0 MCP server to an isolated fixture using the package setup command. With the exact built HTML and both browser receipts from the corrected run, `inspect_duel_replay` returned `pass` for the 8-step opening and 4-step showdown. Adding one HTML comment to the fixture copy while retaining the showdown receipt produced `stale` for the expected digest mismatch. This comparison ran the Power's MCP server directly. It does not establish Kiro app invocation or player experience. The original builds and receipts were preserved.

## Guided duel entry on the next candidate

The local candidate exposes **Start guided duel** in **How to Play** before the first match. In desktop Safari 18.1.1, Codex reached the action with Option-Tab and Space. The starter hand, opening hint and pinned seed 0 appeared on a preview opened at `?seed=60&guide=0`. Sheriff summoned to the center lane. Returning to How to Play hid the guided action while the match was paused. Resume restored Sheriff and the three-card hand. After the guided duel reached defeat in round 4, Main menu → Play started an ordinary seed-60 match. A fresh tab confirmed that ordinary Play also starts at seed 60 with hints off.

The Chromium menu script could not launch from the restricted shell. Three loopback-dependent tests in the full suite also hit that restriction. The other 330 tests passed. A fresh release workflow is due on the final candidate.
