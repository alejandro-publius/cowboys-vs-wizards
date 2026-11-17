Command: `node scripts/verify-duel.mjs --browser` (project root, one shell call)
Exit status: 0

- **Node tests:** 157 tests, 157 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo. Duration was 4845.95 ms.
- **Asset structural checks:** 2 of 2 files passed (`dragon.glb`, `mounted-billy.glb`). The check covers structure only, not motion quality.
- **Build:** `dist/cowboys-vs-wizards-board-duel.html`.
- **Chrome replay:**
  - Chrome/157.0.8103.52.
  - Seed 0.
  - Revision e9aeb06.
  - 8 of 8 steps observed.
  - Pending step IDs: none.
  - Console errors: 0.
- **SHA-256:** `a5d0c756077e89afa4f8a107c64e863a7d09cba48456f8229a8b42b4fa208bd2`. This is the build SHA-256 that the replay printed for the standalone duel HTML. I did not hash it separately.
- **Receipt path:** `.artifacts/kiro/replay/browser-run.json`

I edited no source.