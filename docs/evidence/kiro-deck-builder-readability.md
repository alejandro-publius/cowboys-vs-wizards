# Kiro evidence: deck-builder readability specification

Date: Monday, November 16, 2026, 5:18 p.m. America/Los_Angeles (task start).
App and agent: Kiro CLI (default agent), authoring documents only.

## Status
- **Done:** requirements, design and QA checklist written (specification only).
- **Pending:** the UI redesign (Fable, separate branch), all browser QA, and user visual approval. No acceptance check has passed.

## Base and branch
- Branch `kiro/deck-builder-readability-spec`, base `origin/main` `599450a27703fbdb8961d626c3e779512f54f29e` (Merge PR #14).
- Docs-only. No tests, build, browser run, render, package install or source/UI/rules/art edit.

## Owned files
- `.kiro/specs/deck-builder-readability/requirements.md`
- `.kiro/specs/deck-builder-readability/design.md`
- `.kiro/specs/deck-builder-readability/tasks.md`
- `docs/evidence/kiro-deck-builder-readability.md`
- `docs/kiro-brag-sheet.md`: appended one row-level note (see that file). Prior content preserved.

## Inspected (read only)
`AGENTS.md`, `src/ui/title-menu.js`, `src/ui/title-menu.css`, `src/game/deck-builder.js` (validation), `src/profile/player-profile.js` (`saveDeck` lines), `scripts/build.mjs` and `src/ui/layout.html` (title art reference `assets/menu/title-screen.webp`), `.kiro/specs/duel-card-pipeline/requirements.md` (format), `docs/kiro-brag-sheet.md` (structure). The user's reference screenshot was not available; only the textual brief was used.

## Attribution
- Codex: the current title menu and deck-builder base.
- Kiro CLI: this requirements, design and QA specification.
- Fable: UI implementation, pending on a separate branch. Not coordinated by touching its files.
- A specification is not an implementation and is not user visual approval.

## Separate-branch evidence (not merged here)
Branch `kiro/custom-deck-simulation`, commit `3f840694d63c6bdd2093ec4b4e3da128162710ff`, preserved on its own branch and not merged into this branch. Its recorded result: scoped 9/9 test command, 128 distinct decks with replay, 2199 first-pass actions, 1419 CPU public-view checks. Not re-run for this task.

## Pending acceptance checks
Tasks 8 to 16 in `tasks.md`: measurements at 1280px and 390px (art width, 16px text, 44x44px controls, no horizontal overflow), count changes, invalid feedback, save and reload, Restore/Back/Escape/Play, keyboard navigation, and user visual review.

## Claim-to-file mapping (Kiro depth)
| Claim | File |
| --- | --- |
| Requirements-first EARS spec with measurable criteria | `.kiro/specs/deck-builder-readability/requirements.md` |
| Design grounded in existing functions, with QA mapping | `.kiro/specs/deck-builder-readability/design.md` |
| Implementation vs QA task split, nothing falsely checked | `.kiro/specs/deck-builder-readability/tasks.md` |
| Honest status and attribution | this file |

No hook, custom agent, property-based test or MCP tool ran for this task.

## Subsequent ownership handoff
Fable hit its reported usage limit before tracked UI edits. The approved brief transferred to actual Kiro CLI on branch kiro/readable-deck-workbench. This does not change who authored the original specification; implementation and browser acceptance remain separate evidence.
