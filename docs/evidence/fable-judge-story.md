# Fable judge-story pass

November 16, 2026. Author: Fable (Claude Fable 5.2, Claude Agent SDK). Branch `fable/judge-story-polish`, based on main `b5cecc6`. Docs only.

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
