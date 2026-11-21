# Showdown presenter guard: native Kiro permission trials

Date: 2026-11-20, 16:18 PST (America/Los_Angeles). Worker: Kiro CLI 3.5.0, V3 engine, run by an
independent Kiro worker session. Base: main `c3dcab64da3788954ba73669a2a7fca765a9251a`.

## Change

`.kiro/agents/showdown-presenter.json` gains one agent-scoped permission rule:

```json
{ "capability": "fs_write", "match": ["src/game/showdown/rules.js"], "effect": "deny" }
```

This is Kiro's declarative permission surface (agent `permissions.rules`, deny-overrides), not a hook
or a shell filter. It applies only to sessions running the `showdown-presenter` agent. The default
agent and maintainers keep their own policy. Fable-owned `rules.js` was not edited in this tree.
`tests/match/showdown-presenter-guard.test.js` pins the rule and checks that no presenter allow rule
names `rules.js` or grants `fs_write` under `src/`.

## Trials

Each trial was one `kiro-cli chat --agent-engine v3 --agent showdown-presenter --no-interactive
--output-format stream-json "<prompt>"` session, run in a disposable `git clone` of this branch
at `c3dcab64` with the edited agent file copied in (file SHA-256 `a0e6094f…94cc27`, identical to the
committed one). The fixture `.artifacts/kiro/showdown/guard-fixture.txt` was created in the clone
before the trials; that path is covered by the presenter's existing `fs_write` allow rule. Raw
stream-json logs are kept outside Git in the worker folder (`guard-trials/`).

| Trial | Request | Native event | Target SHA-256 before → after |
| --- | --- | --- | --- |
| 1 | Write tool appends a comment marker to `src/game/showdown/rules.js` | `tool_call_update` `status: failed`, `rawOutput`: "Blocked by a permission rule (deny fs_write matching "src/game/showdown/rules.js"); the user did not reject it. Source: agent-profile." `_meta.kiro.policyDenial`: `{capability: fs_write, resource: src/game/showdown/rules.js, effect: deny, matchedRule: <the rule above>, source: agent-profile}` | `096eb8a2…d5b61a` → `096eb8a2…d5b61a` (unchanged) |
| 2 | Write tool appends a line to the presenter fixture | `tool_call_update` `status: completed`, "Appended the text to the … guard-fixture.txt file." | `02472236…d919ee` → `a4407ed7…16a664` (changed) |
| 3 | Shell tool runs `printf '// guard-trial-3 marker\n' >> src/game/showdown/rules.js` | `tool_call_update` `status: failed`, "The permission request failed before it was answered, so this call did not run; the user did not reject it." Exit code -1. No `policyDenial`. | `096eb8a2…d5b61a` → `096eb8a2…d5b61a` (unchanged) |

Session ids: trial 1 `sess_09ae05ef-d337-448d-b9ee-488f8a383fd0`, trial 2
`sess_3bd5dd51-3b48-4221-a6e5-f3abb0eafe4e`, trial 3 `sess_204dd428-33b2-4064-897f-e818d30cb7bb`.
In every trial the agent's SessionStart hook ran (`completed`); in trials 1 and 2 the workspace
PostToolUse hook `check-showdown-guard-access` also ran. No quota stop occurred.

## What this proves and what it does not

- Proved: the presenter's own write tools are refused on `rules.js` by Kiro's permission engine,
  with the matched agent-profile rule reported in the event; an allowed presenter path still writes.
- Not proved, and a known limitation: shell writes are not path-guarded. Trial 3 was refused
  because `printf` is not on the presenter's shell allowlist and a non-interactive run cannot answer
  the approval prompt. In an interactive session a human could approve the same command, and an
  allowlisted command that runs code (for example `node --test …`) could write any file the user
  can. Kiro's `fs_write` rules shape shell writes only under the local command sandbox, which needs
  a settings change outside this worker's scope. A substring shell deny on `rules.js` was not added:
  it would be fragile command matching and would also block reads such as `git diff`.
- This is a guard against presenter mistakes, not a security boundary. Anyone can edit the agent
  file, run another agent, or edit the file outside Kiro.
