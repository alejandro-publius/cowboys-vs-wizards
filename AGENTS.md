# Working on this game

Read README.md, your assignment and its owned files. Read relevant functions and
imports; do not dump the repository or all reference documents.

- Source new art and motion from the user’s Tripo exports or finished assets
  and animation clips in GitHub repos they supplied. Confirm reuse rights
  and record the source. Plan any new design, asset or animation with the
  user before creating it. Apply this to Blender, in-game visual effects and
  poses, and work delegated to Fable or Kiro.
- Preserve the approved haunted Western art and existing attack demo.
- Build a small browser card game: visible deck/hand, three lanes per side,
  tribute summons and one-to-five life orbs per living troop.
- Draft numeric rules and known spec contradictions are in docs/kiro-task-01.md.
  Do not invent mechanics to fill asset gaps.
- Keep plain JavaScript, Three.js, Rapier and esbuild. Rules in src/game/ must
  have no DOM, rendering, filesystem, network or model dependencies.
- Prefer direct functions and explicit data. Split modules by purpose. Avoid
  generic frameworks, unused abstractions and speculative infrastructure.
- Add no language or dependency without a concrete reason. Profile a real
  bottleneck before proposing a rewrite or optimization.
- Run the affected check once; repeat after relevant changes or failures.
  Pure game-rule tests do not require a renderer build.
- Do not dump binary assets into text context. Keep generated builds,
  dependencies, credentials and temporary worktrees out of commits.
- docs/fable-tasks.md is the active task list. Workers own only their assigned
  paths in separate worktrees. The coordinator owns shared package files,
  entry points, logs and integration. Never overwrite another worker's changes.
- Stop at the task boundary. Commit one focused change and report actual
  checks, changed files and blockers. Never auto-merge PRs.
- Verify the existing GitHub remote and its history before publishing. No
  force-pushes or replacement repository. Finish local work if origin is missing.
- Attribute work to the actual app/agent. Never invent test, visual, performance,
  Kiro-usage or PR evidence. Each worker has its own evidence note.
- For animation work read docs/character-animation-plan.md and the relevant
  Lucca reference sections only. Preserve the original Tripo GLBs. The game’s Dragon and Mounted Billy GLBs contain exported attack clips.
