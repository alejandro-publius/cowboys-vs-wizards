# Contributing

This guide is for people. If you are working through an AI coding agent, point it at [AGENTS.md](AGENTS.md) first; the same rules apply to both.

Open tasks are in the [issue list](https://github.com/alejandro-publius/cowboys-vs-wizards/issues). Issues labelled [`handoff`](https://github.com/alejandro-publius/cowboys-vs-wizards/issues?q=is%3Aissue+is%3Aopen+label%3Ahandoff) are ready to pick up.

## Set up

You need Node.js 22.18 or later and a browser with WebGL 2 (current Chrome works).

```sh
git clone https://github.com/alejandro-publius/cowboys-vs-wizards.git
cd cowboys-vs-wizards
npm ci
npm run build -- --diorama --contest
```

Open `dist/cowboys-vs-wizards-showdown-3d.html` for the illustrated title. For the lightweight Camp used by most input checks, run `npm run build` and open `dist/cowboys-vs-wizards-board-duel.html`. [Public game](https://alejandro-publius.github.io/cowboys-vs-wizards/) · [Build instructions](README.md#local-build)

## Make a change

1. Pick an issue and comment on it so nobody else starts the same work.
2. Create a branch from `main`, named after you and the topic, for example `rachel/playtest-results`.
3. Keep the branch to one topic. A small pull request is reviewed faster than a large one.
4. Run the check that covers what you touched (see below).
5. Push the branch and open a pull request against `main`. Link the issue with `Closes #12` in the description.
6. Alex reviews and merges. Please do not push to `main` or merge your own pull request.

## Which check to run

| You changed | Run |
| --- | --- |
| Only Markdown or other documents | Nothing. Check that your links open. |
| Game rules, match flow or the card interface (`src/`) | `node scripts/verify-duel.mjs` |
| Illustrated entry, release routes or the Saloon link | `node scripts/stage-pages.mjs --commit "$(git rev-parse HEAD)"`, then `node scripts/check-pages-tree.mjs --browser` |

Say in the pull request which command you ran and whether it passed. If you could not run it, say that instead.

## Rules that are easy to break by accident

- **No new art, animation or card mechanics without asking Alex first.** The art and the rules are approved as they are. Open an issue with the idea instead.
- **Do not edit the evidence records** under `docs/evidence/`, or the `docs/kiro-*.md` and `.kiro/` files. They record what was observed at the time. Add a new note next to them if something changed.
- **Report only what you saw.** A playtest result, a device check or a test count goes in a document only if you observed it yourself. Leave a cell blank when you have no result.
- **Never commit** `node_modules/`, `dist/`, passwords or API keys.

## Where things are

The [README](README.md#code-map) has a table of what each folder owns, and [docs/PROJECT-STATUS.md](docs/PROJECT-STATUS.md) lists what is built and what is proposed next.
