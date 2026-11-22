# Showdown preview maintenance

The illustrated build has a local preview at `.artifacts/showdown-preview/current/index.html`. Run `node scripts/maintain-showdown-preview.mjs` from a checkout with the game dependencies, Chrome and an authenticated Kiro CLI. Kiro's saved `maintain-showdown-preview` workflow can run the same cycle.

Each cycle builds the current integrated source in a detached checkout and runs the Showdown presentation tests and Chrome checks. The [maintenance spec](../../.kiro/specs/showdown-preview-maintenance/requirements.md) defines the required behavior. Its repair registry links a requirement to a specific browser check, Kiro agent and editable file. The first two repairs cover stopping the troop reel and opening the Trail from the title after a local match.

When Chrome reports a registered failure, the runner gives Kiro the requirement and the observed browser state. If several cases fail, Kiro repairs them in parallel in separate checkouts. The runner validates each patch's file scope, combines the patches and reruns the full gate on the resulting build. Failures outside the registry stop the cycle. The browser receipt must match the exact HTML being promoted.

A passing build goes into its own immutable directory. The runner advances the `current` link in one rename. A failed check leaves the last playable preview in place. The generated HTML and the run output live under `.artifacts/showdown-preview/`. The candidate revision is pinned locally under `refs/kiro/showdown-preview/`. This workflow has no public deployment integration.
