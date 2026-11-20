# K-011 tasks

- [x] 1. Pure Outrider turn module and gate script with `--check`/`--write` (G1, G2, G4)
- [x] 2. Build-time verified list and neutral Camp controls; no list without frozen cases (G2, G5, G8)
- [x] 3. Gate tests on a labelled fixture: positive, changed outcome, fail closed, gameplay mutation with refreshed
      hashes, unrelated-edit control (G1-G4)
- [x] 4. Headless Chrome check on the fixture page and on the no-case build (G5, G6, G8)
- [x] 5. Native PostFileSave hook with receipts; trigger and skip observed (G7)
- [x] 6. Import the search worker's frozen cases from `../cases-ready.json`, write the receipt with `--write`,
      rerun `--check`, `npm run build` and the browser check on the real cases (G1, G6). Done: 10 cases from 6ab8899.
- [x] 7. Repair: one Camp entry, curated pair in the collapsed Ledger with explicit reveal, Night Watch engine identity,
      stale Ledger status; tests, clean-worktree browser runs, mutation/control build receipts, native hook (G9-G11)
