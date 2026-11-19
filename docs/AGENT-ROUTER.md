# AI agent quick router (read on demand)

**Purpose:** find the few files needed for a task without scanning the repository. This is *not* automatically included in agent context. Root [AGENTS.md](../AGENTS.md) is the short always-on contract.

## First 30 seconds

1. Identify the requested behavior, the **owned paths**, current branch/HEAD and working-tree changes. Never overwrite another agent's edits.
2. Select **one** row below. Read the smallest entry point, the immediately imported dependency and the matching test. Search for symbols before reading whole files.
3. Make one focused change and run the row's targeted check. Expand only when a failure or dependency requires it.
4. Report exact changed paths, commit, tests actually run and what remains unverified. No automatic merge or force push.

| Task | Read first | Run first |
| --- | --- | --- |
| Rules, tribute, spells, CPU | `src/game/{actions,legal,clash,cpu}.js` as relevant; `docs/kiro-task-01.md` only when a rule is disputed | `node --test tests/game/<closest>.test.js` |
| Main menu / settings / achievements / decks | `src/ui/title-menu.js`, `src/profile/player-profile.js`, `src/game/deck-builder.js`; integration in `src/main.js` | `node --test tests/game/{deck-builder,player-profile}.test.js`; `scripts/browser-menu-check.mjs` for UI |
| Hand, cards, selection | `src/ui/cards.js`, `src/match/selection.js` | `node --test tests/match/selection.test.js` |
| Match flow, impact timing, restart | `src/match/{controller,presenter,scheduler}.js` | `node --test tests/match/<closest>.test.js` |
| Sheriff fire / reaction / weapon | `src/render/{sheriff,cues,match-board}.js`; `docs/evidence/fable-sheriff-integration.md` if relevant | `node --test tests/match/sheriff.test.js` |
| Wizard / Dragon / mounted animation | `src/render/{wizard,cues,match-board}.js`, `docs/character-animation-plan.md`; inspect specific asset only | `node --test tests/match/attack-clips.test.js` or `tests/match/wizard.test.js` |
| 3D layout, orbs, camera | `src/render/{match-board,orbs,match-camera}.js` | `node --test tests/match/orbs.test.js` |
| Give a card its 3D model | `src/render/presentation-manifest.js` (one entry; the file explains the fields) | `node --test tests/assets/presentation-manifest.test.mjs` |
| New card and card registration | `.kiro/specs/duel-card-pipeline/`, `scripts/sync-card-specs.mjs` | `node --test tests/game/card-specs.test.js` |
| Build / public site / replay | `scripts/{build,verify-duel,browser-match-check}.mjs`, `.github/workflows/pages.yml` | `node scripts/verify-duel.mjs`; browser option only for a page-affecting change |
| Kiro tooling and evidence | relevant file in `.kiro/{specs,agents,steering,hooks,workflows,powers}/` plus matching evidence note | smallest relevant command; don't claim a Kiro run without a receipt |
| Optional Night Watch Crew app | `apps/night-watch/README.md`, then the specific Python backend or UI file | `python3 -m unittest discover -s apps/night-watch/backend -p 'test_*.py'` |

The table is a locator, not an instruction to read **every** listed file. The bracketed path group is shorthand, not a literal filesystem path.

For current research-derived ownership and next handoffs, read [the active closeout queue](kiro-closeout-queue.md). Deep links live in [the source register](kiro-source-register.md); do not load it for unrelated code tasks.

## Context and provenance hygiene

- Never paste the whole `docs/kiro-build-log.md`, archived PRs, full reference guides, huge screenshot trees or GLB files into context. Search for the relevant heading/identifier.
- Don't treat `docs/fable-tasks.md` and `docs/kiro-task-queue.md` as active; their initial instructions predate the implemented game.
- Read `docs/PROJECT-STATUS.md` for a dated summary and `docs/ARCHITECTURE.md` for contracts **only when needed**. Code and tests outrank stale notes.
- `AGENTS.md`, `CLAUDE.md` and Kiro steering may be automatically loaded. Keep them small. Store deep research in on-demand documents.
- `?seed=0` is the opening; `?seed=60` is the Mounted Billy/Dragon showcase; `?mode=demo` preserves the original exchange.
- Separate **implementation** (Fable/Claude Code, Kiro, Codex) from **verification**. Attribute contributions exactly. A numerical check cannot prove the visual quality of an animation.

For task assignment, state: **goal, owned files, acceptance criteria, first check, forbidden changes, stopping point**. A worker should be able to start without a repo-wide survey.
