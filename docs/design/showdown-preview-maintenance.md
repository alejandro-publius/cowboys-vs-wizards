# Showdown preview maintenance

The illustrated build has a local preview at `.artifacts/showdown-preview/current/index.html`. Run `node scripts/maintain-showdown-preview.mjs` from a checkout with the game dependencies, Chrome and an authenticated Kiro CLI. Kiro's saved `maintain-showdown-preview` workflow can run the same cycle.

Each cycle branches from the current integrated source. It builds in a detached checkout and runs the Showdown presentation tests plus the actual Singularity gallery in Chrome. The first supported repair is the troop reel's Stop button. When Chrome reproduces that defect, the scoped Kiro agent patches the gallery. A fresh test and browser run must pass on the candidate it produced. The browser's receipt must match the exact HTML being promoted.

A passing build goes into its own immutable directory. The runner advances the `current` link in one rename. A failed check leaves the last playable preview in place. The generated HTML and the run output live under `.artifacts/showdown-preview/`. The candidate revision is pinned locally under `refs/kiro/showdown-preview/`. This workflow has no public deployment integration.
