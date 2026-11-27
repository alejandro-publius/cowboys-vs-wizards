# Design: Devpost Gallery Stills & Official Kiroween Form Q&A

## Architecture

1. **Deterministic `3:2` Gallery Capture & Offline Verification (`DGR-1`, `DGR-2`):**
   - `scripts/capture-devpost-gallery.mjs --capture` serves `dist/web/` on loopback `127.0.0.1`, drives headless Chrome at `1200x800` (`deviceScaleFactor: 1`), waits for each route's interactive DOM selector, asserts zero console/page errors, writes five PNGs to `docs/evidence/devpost-gallery/`, and records SHA-256 hashes + dimensions in `docs/evidence/devpost-gallery/manifest.json`.
   - `scripts/capture-devpost-gallery.mjs --verify` (and `verifyGalleryManifest` imported by `tests/assets/devpost-gallery.test.js`) parses PNG `IHDR` chunks directly in pure Node without launching Chrome so CI verifies image dimensions and SHA-256 integrity in milliseconds.

2. **Non-Overlapping Form Q&A & Rules Compliance Companion (`DGR-3..DGR-6`):**
   - `docs/submission/devpost-form-qa-and-gallery.md` provides standalone, copy-paste answers to every sub-question in `docs/submission/rules-check.md` (`#38`) without modifying `docs/submission/devpost-packet.md`, avoiding merge conflicts while keeping human-only reflection slots explicitly marked `[OWNER]`.
