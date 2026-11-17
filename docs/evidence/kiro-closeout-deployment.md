# Closeout deployment verification

Observed November 16, 2026 (America/Los_Angeles), by Codex.

- Reviewed integration merged through [PR #15](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/15).
- Released commit: c5ef69bce9f62e22f1281506f3983709e5f89d4c.
- [GitHub Pages run 44000366061](https://github.com/alejandro-publius/cowboys-vs-wizards/actions/runs/44000366061): completed, success.
- Direct HTTPS fetch of https://alejandro-publius.github.io/cowboys-vs-wizards/?release=c5ef69b: 2,942,751 bytes.
- Served HTML SHA-256: 863ab8bd525cb2e78b0e73b529406b73c6a2381f982f2854e71340df79718e02, exactly matching the frozen web build checked by Kiro and the local current-release rebuild.
- Stable local checkout advanced to this commit; standalone and web builds completed. All 73 project hub shortcuts resolve. Original model exports were not changed.
- No fresh full browser route was repeated after deployment: the actual earlier replay receipts, web menu/deck checks and exact served-byte identity are recorded separately.

[Saved Kiro Workflow](kiro-closeout-release-check.md) · [Readable deck checks](kiro-readable-deck-workbench.md) · [Current preview video](gameplay-demo/menu-and-gameplay-preview.mp4)

The 59-second preview uses current menu/deck/settings footage and earlier release 599450a seed60 gameplay; its [receipt](gameplay-demo/menu-and-gameplay-preview.json) names both sources. It is a silent preview, not a published YouTube submission or a recording of the Kiro Workflow UI.
