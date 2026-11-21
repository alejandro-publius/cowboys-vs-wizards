# Claude Code entry point

Read [AGENTS.md](AGENTS.md) for the universal constraints. The current release state, site paths and remaining human gate are in the "Current status" section of [docs/design/release-line.md](docs/design/release-line.md); Fable's game decisions are the latest Fable comments on [issue 143](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/143). Showdown is the one supported game. The lane duel and its standalone 3D build are retired: `/3d/` redirects to `/` and serves no second game, and the last lane and 3D source is in Git history at commit `ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df`. For a scoped task, use [docs/AGENT-ROUTER.md](docs/AGENT-ROUTER.md) to find only the owned files and focused check; do not recursively load the repository.

[docs/PROJECT-STATUS.md](docs/PROJECT-STATUS.md) is a dated snapshot, not a replacement for checking the live branch. The older `docs/fable-tasks.md` is historical evidence and must **not** be executed as a fresh work queue.

Use the existing signed-in model and worktree. Do not change global permissions, launch paid services or merge PRs without an explicit integration decision.
