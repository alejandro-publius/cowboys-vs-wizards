# Scoped steering and link hook (issue #46)

Author: Kiro CLI, branch `kiro/scoped-steering-2136`.

## Steering (written)
- `.kiro/steering/rules-area.md`: `src/game/**` and rules scripts.
- `.kiro/steering/rendering-area.md`: `src/render/**`, `src/physics/**`, GLBs.
- `.kiro/steering/interface-area.md`: `src/ui/**`, `src/profile/**`, `src/main.js`, browser checks.
- All use `inclusion: fileMatch`. `build-evidence.md` and AGENTS.md remain always-on, so art and provenance rules are unchanged.
- Overlap: existing `duel-iteration.md` also matches `src/render/**` and `src/ui/**`; both load there. Not edited (not owned).

## Activation: pending
Only the front-matter syntax mirrors the existing `duel-iteration.md` format. This CLI session exposes no tool that reports which steering files loaded, so activation is **not verified**. To verify: open a file under each pattern in Kiro IDE and check the loaded-context list.

## Hook: blocked
Rachel's #33 link checker is not present: no matching script in `scripts/`, no `docs-index`-style checker in `docs/evidence/`, and it is not merged into this branch (`origin/rachel/docs-index` exists but is unreviewed and was not read). No hook file was created, no checker was duplicated, and no hook event was captured. Pending: once #33 is merged, add `.kiro/hooks/check-project-doc-links.json` (PostFileSave, matcher scoped to tracked `docs/**/*.md`, in the format of `sync-duel-card-specs.json`), edit a tracked doc, record the real hook event output, then restore the edit.
