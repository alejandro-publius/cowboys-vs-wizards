# AI agent quick router (read on demand)

**Purpose:** find the few files needed for a task without scanning the repository. This is *not* automatically included in agent context. Root [AGENTS.md](../AGENTS.md) is the short always-on contract.

## First 30 seconds

1. Identify the requested behavior, the **owned paths**, current branch/HEAD and working-tree changes. Never overwrite another agent's edits.
2. Pick the game, then select **one** row below. Read the smallest entry point, the immediately imported dependency and the matching test. Search for symbols before reading whole files.
3. Make one focused change and run the row's targeted check. Expand only when a failure or dependency requires it.
4. Report exact changed paths, commit, tests actually run and what remains unverified. No automatic merge or force push.

## Pick the game

Showdown is the game being built ([release line](design/release-line.md)). The lane duel is the earlier game; it stays playable and tested.

| Area | Where it lives | Focused check |
| --- | --- | --- |
| Showdown engine (pure rules, cards, screen contract) | `src/game/showdown/{rules,cards,contract,presenter}.js`; rules text in [`prototypes/showdown/RULEBOOK.md`](../prototypes/showdown/RULEBOOK.md) | `node --test prototypes/showdown/rules.test.js prototypes/showdown/contract.test.js tests/game/showdown-presenter.test.js` |
| Showdown in the public graybox (Play opens Boot Hill) | entry `src/app.js`; `src/ui/{showdown-screen,showdown-cues}.js`, `src/ui/showdown.css`, `src/match/showdown-session.js` | `node --test tests/match/showdown-session.test.js tests/match/showdown-cues.test.js`; page change: `npm run build`, then `node scripts/browser-showdown-check.mjs dist/cowboys-vs-wizards-board-duel.html` |
| Full Showdown reference page (Trail, rivals, bounties, packs, deck builder, save codes) | `prototypes/showdown/` ([README](../prototypes/showdown/README.md)); `rules.js`, `cards.js` and `contract.js` there re-export `src/game/showdown/`; saved progress and its `migrate()` are in `progress.js` | `node --test prototypes/showdown/*.test.js`; page change: `node prototypes/showdown/build.mjs`, then the one `prototypes/showdown/*-browser-check.mjs` for that screen |
| Moving reference features into the graybox | [integration brief](design/showdown-integration-kiro-brief.md); open slice work may already be in a PR, so check open PRs first | the rows above for the paths touched |
| Lane duel compatibility (`?mode=lanes`, `match`, `ride-out`, `practice-*`, `fire-arc`) | `LANE_MODES` in `src/app.js` loads `src/graybox.js`; rules in `src/game/*.js` outside `showdown/`; the lane save `cvw-player-v1` is read and written by `src/profile/player-profile.js` | `node --test tests/game/player-profile.test.js`; `browser-showdown-check.mjs` above also loads `?mode=lanes` and `?mode=match` |

Kiro agent: [`.kiro/agents/showdown-presenter.json`](../.kiro/agents/showdown-presenter.json) for Showdown presentation work (its SessionStart hook runs `sh scripts/check-match-ui.sh showdown`); [`duel-presenter.json`](../.kiro/agents/duel-presenter.json) stays for the lane duel.

`npm run build` puts both games' code in the one graybox file. Each mode runs only the modules its branch of `src/app.js` imports; `src/graybox.js` runs only for the lane modes. Lane rules in [`docs/kiro-task-01.md`](kiro-task-01.md) do not apply to Showdown.

## Lane duel and illustrated build

| Task | Read first | Run first |
| --- | --- | --- |
| Lane rules, tribute, spells, CPU | `src/game/{actions,legal,clash,cpu}.js` as relevant; `docs/kiro-task-01.md` only when a rule is disputed | `node --test tests/game/<closest>.test.js` |
| Lane main menu / settings / achievements / decks | `src/ui/title-menu.js`, `src/profile/player-profile.js`, `src/game/deck-builder.js`; integration in `src/graybox.js` (graybox) and `src/main.js` (illustrated) | `node --test tests/game/{deck-builder,player-profile}.test.js`; `scripts/browser-menu-check.mjs` for UI |
| Lane hand, cards, selection | `src/ui/cards.js`, `src/match/selection.js` | `node --test tests/match/selection.test.js` |
| Lane match flow, impact timing, restart | `src/match/{controller,presenter,scheduler}.js` | `node --test tests/match/<closest>.test.js` |
| Sheriff fire / reaction / weapon | `src/render/{sheriff,cues,match-board}.js`; `docs/evidence/fable-sheriff-integration.md` if relevant | `node --test tests/match/sheriff.test.js` |
| Wizard / Dragon / mounted animation | `src/render/{wizard,cues,match-board}.js`, `docs/character-animation-plan.md`; inspect specific asset only | `node --test tests/match/attack-clips.test.js` or `tests/match/wizard.test.js` |
| 3D layout, orbs, camera | `src/render/{match-board,orbs,match-camera}.js` | `node --test tests/match/orbs.test.js` |
| Give a card its 3D model | `src/render/presentation-manifest.js` (one entry; the file explains the fields) | `node --test tests/assets/presentation-manifest.test.mjs` |
| New card and card registration | `.kiro/specs/duel-card-pipeline/`, `scripts/sync-card-specs.mjs` | `node --test tests/game/card-specs.test.js` |
| Build / public site / replay | `scripts/{build-graybox,build,verify-duel,browser-match-check}.mjs`, `.github/workflows/pages.yml` (publishes `/`, `/graybox/` and `/showdown/`) | `node scripts/verify-duel.mjs` (also runs `prototypes/showdown/*.test.js`); `--browser` replays the illustrated lane build, so use it only for a change to that page |
| Kiro tooling and evidence | relevant file in `.kiro/{specs,agents,steering,hooks,workflows,powers}/` plus matching evidence note | smallest relevant command; don't claim a Kiro run without a receipt |
| Optional Night Watch Crew app | `apps/night-watch/README.md`, then the specific Python backend or UI file | `python3 -m unittest discover -s apps/night-watch/backend -p 'test_*.py'` |

The table is a locator, not an instruction to read **every** listed file. The bracketed path group is shorthand, not a literal filesystem path.

For current research-derived ownership and next handoffs, read [the active closeout queue](kiro-closeout-queue.md). Deep links live in [the source register](kiro-source-register.md); do not load it for unrelated code tasks.

## Context and provenance hygiene

- Never paste the whole `docs/kiro-build-log.md`, archived PRs, full reference guides, huge screenshot trees or GLB files into context. Search for the relevant heading/identifier.
- Don't treat `docs/fable-tasks.md` and `docs/kiro-task-queue.md` as active; their initial instructions predate the implemented game.
- Read `docs/PROJECT-STATUS.md` for a dated summary and `docs/ARCHITECTURE.md` for contracts **only when needed**. Code and tests outrank stale notes.
- `AGENTS.md`, `CLAUDE.md` and Kiro steering may be automatically loaded. Keep them small. Store deep research in on-demand documents.
- Illustrated lane build: `?seed=0` is the opening; `?seed=60` is the Mounted Billy/Dragon showcase; `?mode=demo` preserves the original exchange. In the graybox, `?seed=N` fixes the Showdown deal.
- Separate **implementation** (Fable/Claude Code, Kiro, Codex) from **verification**. Attribute contributions exactly. A numerical check cannot prove the visual quality of an animation.

For task assignment, state: **goal, owned files, acceptance criteria, first check, forbidden changes, stopping point**. A worker should be able to start without a repo-wide survey.
