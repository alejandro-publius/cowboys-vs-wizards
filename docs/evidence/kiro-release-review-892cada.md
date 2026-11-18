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
