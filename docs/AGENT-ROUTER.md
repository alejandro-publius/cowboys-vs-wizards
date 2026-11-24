# AI agent quick router (read on demand)

**Purpose:** find the few files needed for a task without scanning the repository. This is *not* automatically included in agent context. Root [AGENTS.md](../AGENTS.md) is the short always-on contract.

## First 30 seconds

1. Identify the requested behavior, the **owned paths**, current branch/HEAD and working-tree changes. Never overwrite another agent's edits.
2. Select **one** row below. Read the smallest entry point, the immediately imported dependency and the matching test. Search for symbols before reading whole files.
3. Make one focused change and run the row's targeted check. Expand only when a failure or dependency requires it.
4. Report exact changed paths, commit, tests actually run and what remains unverified. No automatic merge or force push.

## The game: Showdown

Showdown is the one supported game. The [release line](design/release-line.md) has the current state, site paths and remaining human gate. Fable's decisions are on [issue 143](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/143). The illustrated build is staged at `/` and `/3d/`, and the lightweight build opens Camp at `/graybox/`. Both use `src/app.js`. Old `?mode=` URLs load Showdown.

**First check for any graybox change: the normal Play path.** `npm run build`, then `node scripts/browser-showdown-check.mjs dist/cowboys-vs-wizards-board-duel.html` (Play opens the Camp, Boot Hill won with clicks, seat privacy, every retired lane URL opens Showdown).

| Area | Where it lives | Focused check |
| --- | --- | --- |
| Showdown engine (pure rules, cards, screen contract) | `src/game/showdown/{rules,cards,contract,presenter}.js`; rules text in [`prototypes/showdown/RULEBOOK.md`](../prototypes/showdown/RULEBOOK.md) | `node --test prototypes/showdown/rules.test.js prototypes/showdown/contract.test.js tests/game/showdown-presenter.test.js` |
| Showdown in the public graybox (Play opens the Camp) | entry `src/app.js`; `src/ui/{showdown-screen,showdown-cues}.js`, `src/ui/showdown.css`, `src/match/showdown-session.js` | `node --test tests/match/showdown-session.test.js tests/match/showdown-cues.test.js`; page change: `npm run build`, then `node scripts/browser-showdown-check.mjs dist/cowboys-vs-wizards-board-duel.html` |
| Graybox Camp modes (rivals, Wanted, packs, deck builder, best of three, two players, save code) | `src/ui/{showdown-camp,showdown-builder}.js`, `src/match/{showdown-campaign,showdown-match}.js`, `src/game/showdown/savecode.js` | `node --test tests/match/showdown-modes.test.js`; page change: `node scripts/browser-showdown-modes-check.mjs dist/cowboys-vs-wizards-board-duel.html` |
| Trail, Camp, keepsakes, keyboard | `src/match/showdown-campaign.js`, `src/game/showdown/campaign-store.js` (reads the old lane save `cvw-player-v1` for keepsakes, never writes it), `src/ui/showdown-camp.js` | `node scripts/browser-showdown-trail-check.mjs …` and `node scripts/browser-showdown-keyboard-check.mjs …` on the same built file |
| Full Showdown reference page (Trail, rivals, bounties, packs, deck builder, save codes) | `prototypes/showdown/` ([README](../prototypes/showdown/README.md)); `rules.js`, `cards.js` and `contract.js` there re-export `src/game/showdown/`; saved progress and its `migrate()` are in `progress.js` | `node --test prototypes/showdown/*.test.js`; page change: `node prototypes/showdown/build.mjs`, then the one `prototypes/showdown/*-browser-check.mjs` for that screen |
| Card art briefs (style, per-card prompts, places, model sheets, frames) | `prototypes/showdown/art.js`; generated page [`ART-DIRECTION.md`](../prototypes/showdown/ART-DIRECTION.md); existing paintings in `assets/cards/` | `node prototypes/showdown/export-art.mjs`, then `git diff prototypes/showdown/ART-DIRECTION.md`; coverage notes in the [README](../README.md#card-art-library) |
| New card and card registration | `.kiro/specs/duel-card-pipeline/cards/`, `scripts/sync-card-specs.mjs` (Showdown's card table reads the generated specs) | `sh scripts/check-card-specs.sh`; `node --test tests/game/card-specs.test.js` |
| Moving reference features into the graybox | [integration brief](design/showdown-integration-kiro-brief.md); open slice work may already be in a PR, so check open PRs first | the rows above for the paths touched |
| Build / public site / replay | `scripts/{build-graybox,stage-pages,check-pages-tree,verify-build-identity}.mjs`, `.github/workflows/pages.yml` | `npm test`; site: `node scripts/stage-pages.mjs --commit <sha>` then `node scripts/check-pages-tree.mjs --commit <sha>` (CI runs exactly this; add `--browser` locally) |
| Kiro tooling and evidence | relevant file in `.kiro/{specs,agents,steering,hooks,workflows,powers}/` plus matching evidence note | smallest relevant command; don't claim a Kiro run without a receipt |
| Optional Night Watch Crew app | `apps/night-watch/README.md`, then the specific Python backend or UI file | `python3 -m unittest discover -s apps/night-watch/backend -p 'test_*.py'` |

Kiro agent: [`.kiro/agents/showdown-presenter.json`](../.kiro/agents/showdown-presenter.json) for Showdown presentation work (its SessionStart hook runs `sh scripts/check-match-ui.sh showdown`). Replay Workflow: `.kiro/workflows/showdown-practice-replay.workflow.json` (`?practice=0` and `?practice=60`).

`npm run build` writes the graybox as one offline file. The table is a locator, not an instruction to read **every** listed file. The bracketed path group is shorthand, not a literal filesystem path.

## Retired: lane duel and illustrated 3D build

Do not send workers to these paths or run their checks unless the user reopens them. The earlier lane duel and its 3D build (`src/main.js`, `npm run build:art`, the lane rules in `src/game/` outside `showdown/`, `src/render/`, the lane files in `src/ui/` and `src/match/`, `presentation-manifest.js`) are retired. The last playable version is `main` commit `ea183ee29dbd`; read it with `git show ea183ee29dbd:<path>` or a separate worktree. The `duel-presenter` agent, the `orb-duel-replay` and `independent-release-review-lane-3d` workflows, the lane `scripts/browser-*.mjs` harnesses, `play-match.mjs` and `docs/kiro-task-01.md` belong to that build. Their receipts and specs stay as history.

For current research-derived ownership and next handoffs, read [the active closeout queue](kiro-closeout-queue.md). Deep links live in [the source register](kiro-source-register.md); do not load it for unrelated code tasks.

## Context and provenance hygiene

- Never paste the whole `docs/kiro-build-log.md`, archived PRs, full reference guides, huge screenshot trees or GLB files into context. Search for the relevant heading/identifier.
- Don't treat `docs/fable-tasks.md` and `docs/kiro-task-queue.md` as active; their initial instructions predate the implemented game.
- Read `docs/PROJECT-STATUS.md` for a dated summary and `docs/ARCHITECTURE.md` for contracts **only when needed**. Code and tests outrank stale notes.
- `AGENTS.md`, `CLAUDE.md` and Kiro steering may be automatically loaded. Keep them small. Store deep research in on-demand documents.
- In the graybox, `?seed=N` fixes every Showdown deal started from the Camp, and `?practice=0` or `?practice=60` opens a fixed Boot Hill practice deal. Lane seeds 0 and 60 in older evidence refer to the retired 3D build.
- Separate **implementation** (Fable/Claude Code, Kiro, Codex) from **verification**. Attribute contributions exactly. A numerical check cannot prove the visual quality of an animation.

For task assignment, state: **goal, owned files, acceptance criteria, first check, forbidden changes, stopping point**. A worker should be able to start without a repo-wide survey.
