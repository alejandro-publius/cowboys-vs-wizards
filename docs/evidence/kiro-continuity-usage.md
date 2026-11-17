# Kiro continuity and usage evidence

Status: final for this task. Telemetry comes from the sanitized receipt [`kiro-continuity-usage/session-observation.json`](kiro-continuity-usage/session-observation.json), captured by Codex.

- Worktree branch `kiro/continuity-usage-evidence`, base `599450a`.
- Authorship: Kiro CLI 3.3.0 independently performed the file inspection and wrote the analysis. Codex orchestrated the task, reviewed the official docs, and captured the telemetry and receipt.
- Files read by Kiro: `AGENTS.md`, `.kiro/steering/build-evidence.md`, `.kiro/steering/duel-iteration.md`, and the compaction/hook lines (15, 43) of `docs/kiro-brag-sheet.md`. No tests, builds or network research were run. No `.kiro`, UI, runtime, art or global configuration file was edited.

## Constraints that block repeating rejected motion or false attribution

| Risk | Existing rule | Source |
| --- | --- | --- |
| Hand-authored motion or art the user did not approve | Source art and motion from the user's Tripo exports or finished assets/clips in supplied GitHub repos. Confirm reuse rights and record the source. Plan any new design, asset or animation with the user first. Applies to Blender, in-game effects, poses, and work delegated to Fable or Kiro. | `AGENTS.md` bullet 1; repeated in `.kiro/steering/build-evidence.md` paragraph 1 |
| Replacing approved motion | Preserve the approved art and the attack demo. Preserve the original Tripo GLBs. Dragon and Mounted Billy GLBs carry exported attack clips. Read `docs/character-animation-plan.md` before animation work. | `AGENTS.md` bullets 2 and last |
| Altering fitted assets or timing | Dragon and Mounted Billy use fitted GLBs with authored clips. Skeleton uses its optimized Tripo mesh. Sheriff uses a procedural rig and revolver cue. Keep original exports and browser timing intact. Verify `?mode=demo` after a mode change. | `.kiro/steering/duel-iteration.md`, "Contracts to keep" (fileMatch: `src/match/**`, `src/render/**`, `src/ui/**`, `scripts/browser-match-check.mjs`, `assets/cards/**`) |
| Inventing mechanics to fill gaps | Do not invent mechanics to fill asset gaps. | `AGENTS.md` bullet 5 |
| Wrong agent credited | Attribute work to the actual app/agent. Never invent test, visual, performance, Kiro-usage or PR evidence. Each worker has its own evidence note. | `AGENTS.md` |
| Overstated claims | Label planned, observed and verified separately. Record unrun checks as pending. Rendered review supports appearance claims and a human playtest supports clarity/fun claims. | `.kiro/steering/build-evidence.md`; `duel-iteration.md` "Report once" |
| Historical receipts reused as new runs | Do not treat historical test receipts as new runs. | `AGENTS.md` |

Scope note: `build-evidence.md` is `inclusion: always`. `duel-iteration.md` loads only when matching files are in play, so it would not apply to a docs-only task like this one.

## Tracked steering versus Memory

These rules are tracked repository files (`AGENTS.md`, `.kiro/steering/`). They are versioned, reviewable and present in any clone. Kiro Memory is a separate, non-repository mechanism. Steering evidence must not be cited as Memory evidence.

## Memory: unsupported in the observed session

- This session ran on engine v2. Per the official Memory docs (https://kiro.dev/docs/memory.md, reviewed by Codex), Memory requires V3. The session exposed no Memory tool or configuration. The generic `knowledge` tool is a different feature and was not used.
- Nothing was listed, created, updated or retrieved, and no setting was changed.
- This does not show Memory is disabled globally. No fresh-session Memory retrieval was tested.

### V3 follow-up (fresh session, explicit `--v3`, session-only)

- A new, non-resumed session was started with `--v3` for this check. This engine choice was session-only: no global setting or permission changed, and the default model stayed Auto with no model override.
- Observed in the session stream: the tool catalogue contained no Memory tool. The only related tool was the generic `knowledge` index/search tool, a different feature. Its schema was loaded and it was not invoked.
- Result: **blocked, Memory tool absent.** No retrieval and no store was attempted. No repository-scoped memory was created, so no title or id exists. Steering recall (`AGENTS.md` sourcing rule) was not substituted for Memory. Retrieval remains untested.

## Compaction

- **Documented historical check:** `docs/evidence/kiro-submission-preflight.md#kiro-compaction-check` records a November 16 run by Codex of `kiro-cli chat --v3 --trust-workspace --agent duel-presenter` on `861af78`. It states that `/compact` was invoked after four turns, `PreCompact` logged the Git revision, and `PostCompact` returned the replay plan with receipt `861af78-1794855476196`. In a resumed Kiro CLI 3.3.0 session, Kiro named seed 0 (opening) and seed 60 (Mounted Billy showdown) and quoted the receipt. The brag sheet cites the same receipt.
- **Raw receipt recovered (correction).** Codex later recovered and read the original JSONL at commit `4321ba40156a8b49e35602dbb23ed562dc8d9d85`, path `docs/evidence/kiro-public-evidence/originals/duel-compaction.jsonl` ([immutable blob](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/4321ba40156a8b49e35602dbb23ed562dc8d9d85/docs/evidence/kiro-public-evidence/originals/duel-compaction.jsonl); the same relative path will work once the root integrates). SHA-256 of the local read-only copy: `d4dc1d00d54c932bd84a0c94045beb926af8d6cabe6b6aba8342098ab77f171e`. It holds a before entry (revision `861af78`, id `861af78-1794855463527`, `hasSummary` false) and an after entry (revision `861af78`, id `861af78-1794855476196`, `hasSummary` true). This corroborates the raw hook phases. The JSONL does not prove the contents of the resumed answer; the preflight note documents those.
- The earlier "absent" finding applied only to the two local artifact locations first checked (main root and source-preview worktree). It was not evidence that the original was missing.
- This session did not compact and did not reproduce the historical run. Reading steering is not a compaction demonstration.

## Observed session metadata (Codex-captured; see receipt)

| Item | Observation |
| --- | --- |
| App | Kiro CLI 3.3.0, headless `chat --output-format stream-json`, exit code 0, turn 25,867 ms |
| Engine | v2, as reported by `runStarted`. No engine override. |
| Model | Public catalog `default_model=auto`. No model override. This shows the visible default Auto only. The internal serving model and routing are not exposed and not inferred. |
| Saved settings | `chat.defaultModel`, `chat.defaultAgent`, `chat.agentEngine`: each returned "No value associated" (exit 1). These are config observations, not proof of what was selected. |
| Usage | Four `meteringUsage` entries in the initial completed turn: 0.09177051990049752, 0.100722235986733, 0.30381755953565504, 0.14779139966832502. Sum 0.6441017150912106 credits (displayed 0.6441). |

The credit figure is session-turn usage as reported in the stream. It is not an account balance or settled bill, and it covers the initial turn only (measured under V2) and excludes later turns including the V3 check. No `/usage` or account/billing query was run.

## Remaining blockers

- Resumed-answer contents from the historical compaction run rest on the preflight note, not on the JSONL.
- Memory retrieval is untested: the V3 session exposed no Memory tool.
- Internal serving model identity is not exposed.
- Raw `.artifacts/kiro-continuity-usage/` logs stay ignored and local. The receipt lists their SHA-256 digests.

## V3 stream corroboration captured by Codex

The [sanitized V3 receipt](kiro-continuity-usage/v3-session-observation.json) preserves the actual current model/mode configuration, zero Memory context tokens, process result and recovered compaction phases. The current values were {"mode": {"current_value": "vibe", "display_name": "Default"}, "model": {"current_value": "auto", "display_name": "auto"}}. Zero Memory tokens does not reveal whether global Memory is off. Kiro authored the capability review; Codex extracted this receipt after the turn completed.
