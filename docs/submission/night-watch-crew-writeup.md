# Best Kiro Crew App Bonus Write-Up: Night Watch

Ready-to-paste Devpost bonus submission text for **Best Kiro Crew App** (`https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch`). Every figure below is backed by tracked receipts in `docs/evidence/kiro-night-watch.md` and `docs/evidence/night-watch-activation.md`.

- **Crew App Repository (Public, MIT, same GitHub account, created Nov 17, 2026 UTC):** https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch
- **In-Repo Source Mirror:** [`apps/night-watch/`](../../apps/night-watch/README.md)
- **Observed Crew Receipts:** [`docs/evidence/kiro-night-watch.md`](../evidence/kiro-night-watch.md) · [`docs/evidence/night-watch-activation.md`](../evidence/night-watch-activation.md) · [`docs/evidence/night-shift/crew-scheduled-2026-11-20.json`](../evidence/night-shift/crew-scheduled-2026-11-20.json)

---

## Paste-Ready Devpost Write-Up (Best Kiro Crew App)

**Night Watch** (`alejandro-publius/cowboys-vs-wizards-night-watch`) is a standalone, MIT-licensed **Kiro Crew** application created during the Kiroween 2026 submission period to solve a recurring strategy-game engineering problem: **catching silent win-rate, first-turn-advantage, and rule-parity regressions between commits before a patch reaches players.**

### Features and Functionality

1. **Paired Seeded Commit Comparison:** Given any two Git revisions (`baseline` and `candidate`), Night Watch exports both snapshots cleanly, runs `65` Showdown rule and engine checks, and simulates `1,000` paired deals (`2,000` games, playing each seed from both starting seats so deal luck cancels out).
2. **Cryptographic Engine Identity & Drift Detection:** Every report hashes the canonical engine and card-spec blobs (`rulesBlob`, commit SHA, seed range, bot policy) under the `night-watch-receipt/1` schema. Downstream tools—including the in-game **Sheriff's Ledger** and `scripts/scorecard.mjs`—verify that a receipt belongs to the exact ruleset under review and mark mismatched revisions stale automatically.
3. **Scheduled Overnight Patrol (`2:00 AM America/Los_Angeles`):** Installed in Kiro Crew (`v0.1.2`) with explicit workspace grants and a nightly schedule. In its observed scheduled Crew run (`crew-scheduled-2026-11-20.json`, report `aa2997cc6c88`), Night Watch played `2,000` bot duels across seeds `0–999` and measured the baseline skew (`59.4%` Cowboy share, `57.1%` first-player share) that motivated the Night Shift Saloon's Billy `2 → 1` balance audit.
4. **Human-Gated Issue Drafts (Never Unreviewed Auto-Spam):** When win-rate bands or rule invariants drift, Night Watch generates structured Markdown issue drafts with exact reproduction seeds, commit hashes, and delta tables—leaving final filing and balance rulings to human designers.
5. **Local Dashboard & Unit Suite:** Ships with a Python backend (`apps/night-watch/backend`, verified in CI on every PR via `python3 -m unittest test_night_watch`) and an inspectable report viewer for comparing historical runs side by side.
