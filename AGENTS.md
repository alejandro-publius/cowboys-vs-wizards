# Working on this game

Read the task, this file and the owned files. Use docs/AGENT-ROUTER.md to
locate relevant paths and focused tests; read it only when orientation is needed.
Read imports one level at a time. Never dump the repo or reference collection.

## Game design R&D

Codex owns the current build, pull request reviews, integration and release
verification. Mechanics decisions from Alex and Fable 5.2 live in docs/design/.
Use their acceptance cases when changing gameplay. Kiro's implementation,
Workflows and receipts are credited where they were produced. Bring new
game-design decisions to Alex with the playable alternatives and evidence.

Treat every card, stat, deck and mechanic as a design hypothesis. Propose
simpler or stronger ideas whenever research or playtests reveal them, even
when the current version already works. Consider tuning, replacing or cutting
an idea as readily as adding one.

Explain which player decision improves, what evidence prompted the idea, and
what it costs in rules or learning time. When prototyping, compare the smallest
playable alternative with the current graybox using the same matchup where
possible. Use human playtests to judge clarity and fun.

## Working constraints

- Source new art and motion from the user’s Tripo exports or finished assets
  and animation clips in GitHub repos they supplied. Confirm reuse rights
  and record the source. Plan any new design, asset or animation with the
  user before creating it. Apply this to Blender, in-game visual effects and
  poses, and work delegated to Fable or Kiro.
- Preserve the approved haunted Western art and the source assets in
  assets/ (models, clips, card paintings). Card art briefs for every
  Showdown card: prototypes/showdown/ART-DIRECTION.md, generated from
  prototypes/showdown/art.js by `node prototypes/showdown/export-art.mjs`.
- Showdown is the one supported game. Current state, paths and the remaining
  human gate: docs/PROJECT-STATUS.md ("Current build"); Fable's
  decisions: the latest Fable comment on issue 143. Its engine is
  src/game/showdown/. Its rules are prototypes/showdown/RULEBOOK.md; the full
  reference page is prototypes/showdown/ (/showdown/). Start Showdown work
  from docs/AGENT-ROUTER.md.
- Showdown routes, as this checkout stages them (introduced by PR 186): the
  site root / starts the illustrated Showdown (src/ui/showdown-3d) with the
  Ride or Fight? challenge, Camp secondary; /3d/ is a byte-identical
  compatibility copy of that build; /graybox/ stages the same game in the
  lightweight graybox (src/app.js) with direct Camp entry.
- The earlier lane duel and its lane-based 3D build (src/main.js, src/render/)
  are retired; this is separate from Showdown's illustrated src/ui/showdown-3d.
  Old ?mode= URLs lead to Showdown. The last playable lane and lane 3D source
  is in Git history at main ea183ee29dbd; lane evidence stays as history. Do
  not assign work to lane paths or the lane 3D build, or run their harnesses,
  unless the user reopens them. Lane progress does not carry into Showdown
  (keepsakes only; see release-line.md). Do not invent mechanics to fill
  asset gaps.
- Keep plain JavaScript, Three.js, Rapier and esbuild. Rules in src/game/ must
  have no DOM, rendering, filesystem, network or model dependencies.
- Prefer direct functions and explicit data. Split modules by purpose. Avoid
  generic frameworks, unused abstractions and speculative infrastructure.
- Add no language or dependency without a concrete reason. Profile a real
  bottleneck before proposing a rewrite or optimization.
- Run the smallest affected check once; repeat after relevant changes or
  failures. Pure rules need no renderer build. Do not re-run every browser
  replay for a docs-only change or treat historical test receipts as new runs.
- Do not dump binary assets into text context. Keep generated builds,
  dependencies, credentials and temporary worktrees out of commits.
- docs/PROJECT-STATUS.md is the dated status snapshot; docs/fable-tasks.md
  and docs/kiro-task-queue.md are historical assignments, not open tasks.
  Workers own only their assigned paths in separate worktrees. The coordinator
  owns shared package files, entry points, logs and integration. Never
  overwrite another worker's changes.
- Stop at the task boundary. Commit one focused change and report actual
  checks, changed files and blockers. Never auto-merge PRs.
- Verify the existing GitHub remote and its history before publishing. No
  force-pushes or replacement repository. Finish local work if origin is missing.
- Attribute work to the actual app/agent. Never invent test, visual, performance,
  Kiro-usage or PR evidence. Each worker has its own evidence note.
- For animation work read docs/character-animation-plan.md and the relevant
  Lucca reference sections only. Preserve the original Tripo GLBs. The game’s Dragon and Mounted Billy GLBs contain exported attack clips.
