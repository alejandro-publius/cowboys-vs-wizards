# Lean repository and independent agent tasks

User-authorized goal: finish the existing browser card game with small, reviewable
changes, preserving its approved art and keeping iteration inexpensive.

1. Preserve the current demo in git. Move browser code into `src/`, build and
   verification tools into `scripts/`, and media into `assets/`. Verify the same
   scene checks and bundled build. This is the current Codex task.
2. Use the bounded assignments in `docs/fable-tasks.md` as the task list. Start
   summon rules and asset inspection in separate worktrees. They own different
   files and use focused Node checks; neither changes the renderer.
3. Finish combat on top of the summon API, then connect cards and health orbs to
   the board. These depend on the preceding engine work and run sequentially.

Architecture: retain plain JavaScript, Three.js, Rapier and esbuild. Keep game
rules independent of rendering. Add dependencies or a language only when a
measured limitation warrants it. No orchestration service is needed for this
local prototype.

Checks: preserve geometry/event measurements after file moves; build the demo;
review each future branch's scoped tests and diff before integration. Visual
quality still needs an actual browser review. Shared dependencies, lockfiles,
entry points and this queue belong to the coordinator, not parallel workers.

The connected GitHub account did not reveal this project's remote. Work remains
local until the existing repository URL can be verified. Never invent a PR URL.
