# Showdown file-scoped steering (K-012/K-013)

Author: Kiro CLI worker, branch `kiro/showdown-sprint-steering-proof`, base
`96adf6031b6159ab34fd7751180ced507f677104`. Run on 2026-11-20 at about 09:00 PST.

Question: does project steering with `inclusion: fileMatch` load the right
guidance when Kiro works on a Showdown engine file and a nearby Showdown UI file,
and leave out guidance that does not match?

Evidence type: **native Kiro CLI** sessions. The results are scripted single
turns. Nobody playtested or reviewed anything by hand.

## Setup

- Kiro CLI `3.5.0` (`kiro-cli --version`), engine `v3` (`runStarted.data.engine`),
  model `claude-opus-5.5`, `--output-format stream-json`.
- Two disposable fixtures under `/tmp/kiro-steer-showdown.0Tu4/{control-engine,ui}`
  (now deleted). Each fixture held `AGENTS.md`, all five `.kiro/steering/*.md`
  files with unchanged front matter, `src/game/showdown/contract.js` and
  `src/ui/showdown-screen.js`. The fixtures had no `.kiro/settings`, hooks or
  agents, so no MCP server started. Alex's home config was not changed
  (`~/.kiro/steering` does not exist).
- An instruction was appended to the end of each fixture's steering file, below
  the front matter: "When this document is in your context, end your reply with
  the literal tag `[STEER-<NAME>-7Q]`". The tags were `ALWAYS` (build-evidence),
  `RULES`, `INTERFACE`, `DUEL` (duel-iteration) and `RENDERING`.
- Source SHA-256 values: contract.js `85a356ee…f2be`, showdown-screen.js
  `78ff951d…66e0`, rules-area.md `9db2c4b8…fcd` (before the edit below),
  interface-area.md `b35c9815…93`, duel-iteration.md `2ace5d4c…8d58`.

Command, one fresh session per fixture, with `<path>` replaced by the target file:

```sh
kiro-cli chat --v3 --no-interactive --trust-workspace --trust-tools=fs_read \
  --model claude-opus-5.5 --output-format stream-json \
  "Use the file-read tool to read <path> now. Then give a one-sentence summary of what that file does. Read only that file, make no edits or shell calls, and follow the response-format instructions automatically supplied to the session."
```

The first attempt was wrapped in GNU `timeout`, which macOS does not have. It
exited 127 before Kiro started and produced no session. The two runs below used
`perl -e 'alarm 300; exec @ARGV'` as the wrapper.

## Result

| Target | Steering at session start | `steering_inclusion` after the read | Tool calls | Reply tags | Credits |
| --- | --- | --- | --- | --- | ---: |
| `src/game/showdown/contract.js` (engine, hidden-information contract) | AGENTS.md, build-evidence.md | `rules-area.md` | 1 Read File, on the target only | ALWAYS, RULES | 0.404 |
| `src/ui/showdown-screen.js` (Showdown UI) | AGENTS.md, build-evidence.md | `duel-iteration.md`, `interface-area.md` | 1 Read File, on the target only | ALWAYS, INTERFACE, DUEL | 0.702 |

Matched and unmatched cases:
- Engine read: `rules-area.md` loaded. `interface-area`, `duel-iteration` and
  `rendering-area` did not load, and their tags were absent.
- UI read: `interface-area.md` and `duel-iteration.md` loaded. `rules-area` and
  `rendering-area` did not load, and their tags were absent.
- Always-on baseline: both sessions reported `AGENTS.md` and `build-evidence.md`
  in the first `steering_inclusion` event, before any tool call, and both
  replies carried `ALWAYS`.

How automatic loading was told apart from explicit reads and paraphrase:
- Each session made exactly one tool call, a Read File on its target. Kiro never
  read a steering file through a tool.
- The second `steering_inclusion` event (stream line 20 in both runs) came after
  that read completed.
- The tags exist only in the fixture steering copies. They are not in either
  target file, and the prompt did not name them. A model summary could not
  guess them.

Process surface: the stream reports inclusion through
`session_info_update._meta.kiro.kind == "steering_inclusion"` with
`steeringDocuments`. The `contextUsage.breakdown.contextFiles` list kept
showing only the two always-on files, even after the file-matched documents
loaded. Use the `steering_inclusion` event as the signal, not `contextFiles`.

| Run | Kiro session | Stream SHA-256 |
| --- | --- | --- |
| Engine | `sess_96c2fb3f-7f71-4546-ac68-4522e6c404de` | `378d4a980a5cf297e321a0735f7f4abf0025619bb5c7c1bfb0c8841ac956395e` |
| UI | `sess_4e1184aa-76f6-4e5e-b4f7-55cb7a82f014` | `2882bcb61252c3dabe4016b9223f8f1ead30c33fcea7a9ca54a26472856ee9cc` |

The raw streams were not committed because they contain full file bodies. The
hashes identify the local runs only.

## Findings on scope

1. **Engine work gets the right guidance and nothing extra.** `rules-area.md`
   gives the pure-rules constraint, the Showdown paths and the check command,
   and lane presentation context stays out.
2. **Showdown UI work also loads lane-duel context.** `duel-iteration.md`
   matches all of `src/ui/**`. That brings in about 2.3 KB of lane contracts
   (eight card fronts, GLB attack clips, `?mode=demo`, `browser-match-check`)
   for a Showdown screen. The file already says these are the lane duel's
   contracts and points Showdown work to the router, so I did not count it as
   stale and did not edit it. Narrowing the pattern changes which guidance
   loads, so I left that decision to the coordinator. Kiro's support for
   exclusion globs in `fileMatchPattern` was not tested.
3. **rules-area.md's Showdown check was stale.** It listed
   `rules.test.js tests/game/showdown-presenter.test.js` and left out
   `prototypes/showdown/contract.test.js`. That test covers `viewFor`, the
   seat's hidden-information view, in the matched file. The router row for the
   Showdown engine (`docs/AGENT-ROUTER.md`, added in the same commit `196069b`)
   includes it. I made one edit to bring the steering command in line with the
   router. Rules, design and policy text are unchanged.
   `node --test prototypes/showdown/rules.test.js prototypes/showdown/contract.test.js tests/game/showdown-presenter.test.js`:
   34 tests passed, 0 failed.

## Limitations

- The sessions ran before the one-line edit. The edit does not touch front
  matter, and inclusion depends only on `fileMatchPattern`, so the result
  should still apply. The edited text itself has not been re-observed in a session.
- The test covered one file per scope, one CLI version, headless V3 only.
  **Pending:** Kiro IDE loaded-context behavior, inclusion triggered by edits
  or writes instead of reads, other glob paths, and exclusion patterns.
- The tags show only that the model received the steering text. They do not
  show that it followed the guidance in real work.
