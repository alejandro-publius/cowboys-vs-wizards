# Scoped steering and link hook (issue #46)

Author: Kiro CLI, branch `kiro/scoped-steering-2136`.

## Steering (written)
- `.kiro/steering/rules-area.md`: `src/game/**` and rules scripts.
- `.kiro/steering/rendering-area.md`: `src/render/**`, `src/physics/**`, GLBs.
- `.kiro/steering/interface-area.md`: `src/ui/**`, `src/profile/**`, `src/main.js`, browser checks.
- All use `inclusion: fileMatch`. `build-evidence.md` and AGENTS.md remain always-on, so art and provenance rules are unchanged.
- Overlap: existing `duel-iteration.md` also matches `src/render/**` and `src/ui/**`; both load there. Not edited (not owned).

## File-scoped activation verified on November 17, 2026 (Pacific)

Codex ran four fresh Kiro CLI 3.4.0 V3 sessions against a small fixture copied from `892cadac5689290b8fd109ae6a51837cc6f1c31d`. Each session read one file. The fixture retained all five project steering files and their original match patterns. Each copy had a distinct response tag appended outside the front matter. The prompts named only the target file and asked Kiro to summarize it and follow its automatically supplied response-format instructions.

Each stream reported `AGENTS.md` and `build-evidence.md` at session start. The table records the later `steering_inclusion` event after the file-read request and the tags Kiro returned. All four turns finished successfully with one read each.

| File read | Additional steering loaded | Response tags | Session credits |
| --- | --- | --- | ---: |
| `package.json` | None | Always | 0.328938 |
| `src/game/legal.js` | `rules-area.md` | Always, rules | 0.398421 |
| `src/render/match-camera.js` | `duel-iteration.md`, `rendering-area.md` | Always, duel, rendering | 0.517445 |
| `src/ui/card-art.js` | `duel-iteration.md`, `interface-area.md` | Always, duel, interface | 0.404044 |

Reproduce with `kiro-cli chat --v3 --trust-workspace --trust-tools=fs_read --model claude-opus-5.5 --output-format stream-json "<prompt>"` in a disposable copy. For each steering file, append a unique literal tag instruction to the copy. In a fresh session per target, use the following prompt, replacing `<path>` with the target.

> Use the file-read tool to read `<path>` now. Then give a one-sentence project summary based on that file. Read only that file, make no edits or shell calls, and follow the response-format instructions automatically supplied to the session.

Expected evidence is a `steering_inclusion` event naming the matching documents and a final response containing exactly their tags plus the always-on tag. The non-matching control should show only the initial event and the always-on tag.

| Run | Kiro session | Stream SHA-256 |
| --- | --- | --- |
| Control | `sess_ed03b9df-f2ac-4613-b8a4-bf5acb82e3bd` | `74b63b600d8943b9faef34e3aa70a8df8e64d6e778bccb75519279ae4aca8cad` |
| Rules | `sess_71a23930-d460-4c31-83d4-a0f97ec3e7a6` | `558c390ffee863e5c91960b1885e58cc19ac8fd484bfca054d067f697d151add` |
| Rendering | `sess_37d2af4a-c1a3-4e7b-8b88-13386b23a7a0` | `a68f5900803178fd1f784e35ad45e5afd8dae5a72ce6deb8d58934ea44529c1a` |
| Interface | `sess_048b3360-a28f-4cc7-9890-e247bf610f8c` | `ee50124a034aee5f2b6a0139247757af804c5e5806fe4038fc1eaa9aaadd7117` |

The CLI reported `claude-opus-5.5` as the selected model and approximately 1.649 credits across the four turns. The probe measured inclusion and an observable response change for four paths. IDE behavior, other glob paths, engineering quality and account-wide usage are outside its scope. Production steering files were untouched.

## Original activation handoff
Only the front-matter syntax mirrors the existing `duel-iteration.md` format. This CLI session exposes no tool that reports which steering files loaded, so activation is **not verified**. To verify: open a file under each pattern in Kiro IDE and check the loaded-context list.

## Original hook handoff

The later [documentation save-hook receipt](kiro-doc-link-hook.md) records a separate successful CLI verification.
Rachel's #33 link checker is not present: no matching script in `scripts/`, no `docs-index`-style checker in `docs/evidence/`, and it is not merged into this branch (`origin/rachel/docs-index` exists but is unreviewed and was not read). No hook file was created, no checker was duplicated, and no hook event was captured. Pending: once #33 is merged, add `.kiro/hooks/check-project-doc-links.json` (PostFileSave, matcher scoped to tracked `docs/**/*.md`, in the format of `sync-duel-card-specs.json`), edit a tracked doc, record the real hook event output, then restore the edit.
