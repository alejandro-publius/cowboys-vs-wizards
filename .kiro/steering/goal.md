---
inclusion: always
---

# Dec 4 goal

Written by Claude in Claude Code on 2026-11-22 as Step 1 of the user's
December 4 plan. Targets come from the user and the rules quoted in
`docs/submission/rules-check.md`. Only the user changes a target.

## Scorecard

Each line passes or fails at a commit, judged from its "Scored on" source.
People score the human lines; agents report them as pending. Count only real,
distinct work. Never split, repeat or pad work to raise a count.

| Line | Target | Scored on |
| --- | --- | --- |
| submit | The Representative submits the form by December 4, 2:00 pm Pacific. "No extensions will be granted." | human |
| credits | Each team member requests the 4,000 Kiro credits by Tuesday, December 1, 2026 at 12:00 pm Pacific Time (allow 48 business hours); codes must be redeemed by December 4. | human |
| category | Category and bonus categories identified in the form (draft says Costume Contest). | human |
| loop-prs | 300 PRs on the real remote, each made by the native Kiro loop and traced to its native session receipt. | GitHub, receipts |
| reviews | 100 reviews, each of a named head SHA by a reviewer other than the PR's author. | GitHub |
| duels | 10,000,000 simulated duels: complete games in receipts that record seeds, rules version and case count. A rerun of the same seeds and versions counts once. | receipts |
| card-band | Every card in `.kiro/specs/duel-card-pipeline/cards/` measures inside a per-card band. Its numbers and measurement stay unset until an approved spec requirement sets them. NSB-1 is a faction band, not a per-card claim. | that requirement |
| properties | 100 distinct properties, each linked to a requirement ID and run by `node --test`, counted by property, not by case or seed. | tests |
| scoping | Each native hook and agent limited to the paths and tools it owns, each with a real native trigger observed. | `.kiro/hooks/`, `.kiro/agents/`, receipts |
| second-game | A second game live on the public site, played through the shared kit `src/review/paired-duel-kit.js`. | deployed `build.json` commit; `scripts/verify-poker-kit.mjs` for Boot Hill Poker |

## Every task

- Each commit message cites a real requirement ID: one already in a
  `.kiro/specs/*/requirements.md` or `bugfix.md` at the parent commit (for
  example `NSB-1`), or, in a commit that writes requirements, the IDs it adds.
  Scorecard line names are not requirement IDs.
- The balancer writes only `.kiro/specs/duel-card-pipeline/cards/*.json`. The
  current `showdown-balancer` is narrower: the attempt's scratch copy of them.
- `src/game/` changes only for a requirement of a spec approved in writing by
  Fable (issue 143) or the user, and the commit cites it.
  `src/game/card-specs.generated.js` changes only by regeneration from the
  card specs.

## Stop policy: regressions only

This is a plan; no hook or script enforces it yet.

1. Score every line at the task's base commit and at its head.
2. A line that passed at base and does not pass at head fails the task. A
   missing or unmeasurable value does not pass.
3. A line already failing at base never blocks a task. Unmet project-wide
   targets must not freeze unrelated work.
4. On a failure, stop and report the line, both values and the commands run.
   Never edit a line, its threshold or its source to make a task pass.

## Load status

Configured: the front matter above sets `inclusion: always`. Observed: no
native Kiro session has been seen loading this file. Only a native session's
`steering_inclusion` event naming `goal.md` counts as observed (method:
`docs/evidence/showdown-scoped-steering.md`). Custom agents in `.kiro/agents/`
list their own `resources`; whether this file reaches them is unverified.
Native use is verified separately.
