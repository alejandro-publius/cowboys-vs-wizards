# Fable judge-story pass

November 16, 2026. Author: Fable through Claude Code CLI 2.1.326 (requested model `claude-fable-5-2`; the final response reports the same model key). Branch `fable/judge-story-polish`, based on main `b5cecc6`. Docs only.

## Files changed

- `docs/submission/judge-demo-script.md` (new): 2:40 narration and shot list, and the first-time human playtest protocol with blank results.
- `docs/submission/devpost-packet.md`: pitch, audience, player-problem hypothesis, verifiable differentiators, Workflow figure with its commit, Night Watch status, pointers to the script and protocol.
- `docs/submission/build-story.md`: audience and hypothesis paragraphs, the seed 60 example, Workflow figure with its commit, Night Watch status, a section on what the evidence does not show, attribution line.
- `docs/evidence/fable-judge-story.md` (this note).

No runtime, asset, rules, test, config, package or Kiro file was touched.

## What was executed

- **Shell commands: none.** No tests, builds, browser runs, git commands or network requests.
- **Tools used:** file read, glob, grep, write and edit only.
- **Files read:** `AGENTS.md`; `docs/submission/devpost-packet.md`; `docs/submission/build-story.md`; `docs/JUDGE-GUIDE.md`; `docs/evidence/kiro-workflow-replay.md` (first 60 lines); `docs/evidence/gameplay-demo/menu-and-gameplay-preview.json`; `docs/evidence/gameplay-demo/seed60-599450a.json`; the "duel to film" section of `docs/morning-handoff.md`; the How to Play function in `src/ui/title-menu.js` (lines 56–77).
- **Not committed, pushed, merged or published.**

## Where the facts come from

| Claim in the new text | Source | Checked by Fable in this pass |
| --- | --- | --- |
| Preview is 58.73 s: 15.03 s menu at `e9aeb06`, 43.67 s seed 60 at `599450a`, silent | The two JSON receipts | Read the receipts. Did not view or decode the videos. |
| Mounted Billy enters with five orbs, is pulled to the center lane, is defeated and takes the Dragon from five orbs to two | `docs/morning-handoff.md`, `docs/JUDGE-GUIDE.md` | Read the docs. Did not replay the route. |
| Saved Kiro Workflow passed 157 tests and 12 scripted browser checks at frozen `e9aeb06` | The coordinator's task brief | **Not verified.** The one Workflow note read here records an earlier run (`wf_30bc03349c699917`: 112 Node tests, eight opening and four showdown checks). The script tells the editor to read the figures off the actual report. |
| Reviewer returns `pass` for a matching page and `stale` for an older page | `docs/submission/build-story.md`, `docs/evidence/kiro-workflow-replay.md` | Read the docs. Did not run the reviewer. |
| Night Watch backend at 0.1.2, installed app blocked, latest Crew review timed out | The coordinator's task brief | Not verified. Other workers own these repairs; no fix is claimed. |
| Attribution: Fable engine and CPU; Kiro presentation, spec and tooling; Codex integration and verification; user approved art and motion | Task brief and existing docs | Preserved as given. |
| How to Play wording | `src/ui/title-menu.js` | Read directly. |

## Limits

- The 324-word narration count was made by hand, segment by segment (29, 54, 58, 44, 63, 22, 46, 8). No tool counted it and nobody has read it aloud against a clock. The 2:40 timing is an estimate at about 121 words per minute.
- No timecodes inside the existing clips are given, because the videos were not viewed. The split of clip A into title, deck and settings portions is taken from the receipt's segment name.
- Existing game footage runs 58.73 s. The script needs about 118 s of game picture, so an edit from existing footage alone relies on held frames and reuse. Two optional captures are listed as NEEDED to avoid that.
- The Kiro Workflow UI footage, the reviewer footage and the narration do not exist yet. Segments 5 and 6 cannot be finished until they do.
- The playtest protocol has not been run. No human feedback, score, adoption figure or demand claim appears in the new text, and none exists.
- The target audience and the player problem are hypotheses written by Fable. They are not findings.
- The onboarding copy check produced two observations and no code change.
- `docs/JUDGE-GUIDE.md` was not edited (outside the owned files). It does not yet link to the demo script.
- This pass gives the game no quality score.

## Codex review and sanitized execution receipt

The actual Fable task completed successfully, with no quota error or timeout. Codex launched one file-only task, then reviewed the four changed files. Raw output remains outside the worktree in ignored `.artifacts/fable-judge-story-polish-launch/`. No account balance or credential is published.

Codex checked the final Workflow note at `docs/evidence/kiro-closeout-release-check.md`: run `wf_5bd13532f5142477` records 157 tests and 8+4 browser checks on `e9aeb06`. Fable's earlier not-verified statement above records its own narrower read; the figures are now corroborated by this separate review.

Two concrete corrections were made after Fable finished: the narration now says troop cards become pieces (spells do not), and human task5 asks for a different valid twelve-card deck rather than an impossible single-count change. Codex also removed a time-sensitive claim that runtime would remain unchanged, and distinguished an unrecorded final script from the source videos that already exist.

Codex counted narration with a word-boundary expression retaining internal hyphens/apostrophes: 325 words, segments 29, 55, 58, 44, 63, 22, 46, 8. The 2:40 plan still needs an actual read-through. This docs-only review ran no game tests, builds or browser replays.

```json
{
  "app": "Claude Code 2.1.326",
  "requested_model": "claude-fable-5-2",
  "reported_model_usage_keys": [
    "claude-fable-5-2"
  ],
  "session_id": "6f3eedce-25fd-45e5-a6e9-b691c3997034",
  "exit_code": 0,
  "timed_out": false,
  "started_utc": "2026-11-17T04:19:38.092606+00:00",
  "ended_utc": "2026-11-17T04:22:36.376843+00:00",
  "reported_turns": 21,
  "permission_denial_count": 0,
  "stdout_sha256": "e4eaf8ba7048ab48da8927107890b2222a743fba7dba1a5a3b5b53f9de639a88",
  "stderr_sha256": "e705bbf8982385da2b1a03725921d0a6c6730bbaadd22c8f9168522573d067e0"
}
```
