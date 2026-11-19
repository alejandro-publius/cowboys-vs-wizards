---
inclusion: always
---

# Build evidence

Use the user’s Tripo exports or licensed finished assets and clips from
their supplied GitHub repos. Work out any new visual design, asset or
animation with the user before creating it. Follow the
[sourcing rule in AGENTS.md](../../AGENTS.md) for Blender, renderer work,
and delegated tasks.

Maintain `docs/kiro-build-log.md` as the record of this project's development.

Date entries in the user's timezone, America/Los_Angeles. Include the timezone when recording a time of day.

After a meaningful spec decision, implementation task, debugging result, or playtest, update the current entry with the problem, Kiro capability actually used, change, verification, evidence, and remaining work. Keep routine entries concise. Preserve the earlier baseline and completed entries.

Record the actual app and agent used. Identify work performed in Kiro, Codex, Tripo, and by the user accurately. Attribute this initial steering file and log to Codex.

Link evidence to source files, requirement identifiers, existing screenshots or replays, and test output. Include commit or PR references when available. Use `docs/evidence/` for new compact, task-relevant evidence files and relative links from the log. Keep raw exports and credentials out of evidence bundles.

Label planned work, observed behavior, and verified outcomes precisely. Record failures and fixes only when they occur. Record unrun checks as pending. Geometry checks support measured conditions. Rendered review supports claims about appearance. Human playtests support claims about clarity and fun.

For simulations, record seeds, deck/rules versions, case count, bot strategy, draws, faction results, starting-player results, boss appearances, and ending conditions. Describe conclusions as estimates under the tested conditions.

For orb-duel, generate properties around unique card ownership, valid sacrifice payments, one action applied once, health-orb bounds, and deterministic replay. Connect each property to a requirement and retain any real failing seed with the fix.

Follow the [game design R&D rule](../../AGENTS.md#game-design-rd) in design and
playtest work. Surface simpler or stronger candidates as research uncovers
them, including replacements for existing cards and mechanics. The current
duel gives each candidate a playable comparison.

When implementing hooks, use the installed Kiro version's supported configuration. Verify a real trigger and record its result. Update one entry for its task and avoid recursive log-triggered execution or duplicate entries.

Use this evidence record to support the eventual Kiro write-up. Choose Kiro capabilities according to the gameplay or workflow result they can improve.
