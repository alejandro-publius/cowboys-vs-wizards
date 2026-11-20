# K-035 + K-037: portable Agent Skill for Boot Hill practice deals

2026-11-20, America/Los_Angeles. Written by Kiro (Kiro IDE agent session `sess_1b07de33-787b-4aeb-89e9-e9286a7795a9`,
model claude-opus-5.5), which also ran the native Kiro CLI sessions below. Codex verifies; nothing here is Codex's result.

## What it is

[`.kiro/skills/showdown-practice/SKILL.md`](../../.kiro/skills/showdown-practice/SKILL.md), one file, no scripts, no
Power, no server. Given an ordinary request to play or replay a Boot Hill opening, it answers with the canonical
practice link (`?practice=0` or `?practice=60` on https://alejandro-publius.github.io/cowboys-vs-wizards/), the normal
Play -> Camp -> Practice Boot Hill path, the first move, and the note that practice saves nothing. Any other deal
(for example 61) gets "not supported" plus the two real links, never an invented URL. It never uses `?seed`.

SKILL.md SHA-256 at commit `46155c3`: `620dcb8325192159520571cd93dd8cbed29eb689058f08cff1b216c0aa6e3e24`.

## Format and discovery, checked against official sources

- [Kiro Agent Skills docs](https://kiro.dev/docs/skills/) (page dated Nov 18, 2026): workspace skills live in
  `.kiro/skills/<name>/SKILL.md`, supported in IDE, CLI, Web and Mobile; `name` must match the folder; discovery loads
  name and description, activation loads the body.
- [Agent Skills specification](https://agentskills.io/specification): `name` (lowercase, hyphens), `description`
  (<= 1024 chars), optional `license`, `compatibility` (<= 500 chars), `metadata` (string map). The file uses only these.
- Native introspection: Kiro CLI 3.5.0 v3 exposes the skill as resource id `skill::showdown-practice`, loaded through
  tool `disclose_context` (title "Load skill: showdown-practice"). The writing Kiro IDE session's resource catalogue
  also lists `skill::showdown-practice` with the committed description; when it first appeared there was not recorded.
- The coordinator verified the workbook reference for video 15, [Kiro powers and Agent Skills in your development workflows, 15:25](https://www.youtube.com/watch?v=aDysU8zIWK8&t=925s). The workbook records the chapter “Introduction to skills.” The worker used the official format documentation above for implementation. The chapter reference supplies context only.

## First move, checked against the engine and the built page

- Engine, client view (`createShowdownSession` + `practiceDuel` from entry commit `1b2136f`): on both deals turn 1,
  Cowboys active, legal actions exactly `summon: Sheriff` and `end`. `practiceFromQuery("?practice=61")` is null.
- Chrome, page built by `npm run build` from `1b2136f` (build label `1b2136f40ffb`, HTML SHA-256
  `400896728e901b735fc29bc84c54087ba1100630035064d9379ef97e033862a9`), driven by the workflow worker's then-uncommitted
  `scripts/browser-showdown-practice.mjs` (SHA-256 `39d9021c…48eb3`): for deal 0 and 60, both Camp click and direct
  `?practice=N` showed `Practice: Boot Hill · turn 1 · your turn`, the same opening fingerprint per deal
  (`aa4b306e212b9e31`, `6c5f3c105b6ee7f2`), Sheriff click took hand 4 -> 3 and troops 0 -> 1 ("The Cowboys' Sheriff
  arrived."), and storage hashes were unchanged. The script still exited 1 on its own "status names Boot Hill" and
  "Camp text unchanged" checks. That is the other worker's WIP script; this note does not count it as a pass.

## Portability: same bytes, two Kiro locations, fresh native sessions

Locations, both with the identical SKILL.md hash above:
1. Repo project scope: `git clone --no-local` of branch `kiro/showdown-practice-skill` at `46155c3` into a temp dir.
2. Throwaway consumer: new empty Git project; skill installed by `git archive 46155c3 .kiro/skills/showdown-practice | tar -x`.

Each run: `kiro-cli chat --no-interactive --output-format stream-json --agent-engine <v2|v3> --trust-tools=<…>`, a new
session, the user's existing login (no account or global config change; no `~/.kiro/skills` exists). Prompts named no
skill. Positive: "I'm testing Cowboys vs. Wizards. How do I replay the same Boot Hill opening hand, and what should I
click first?" Wrong seed: "…Boot Hill practice link for deal 61?" Negative: "In one line: what is the boiling point of
water at sea level in Celsius?"

| Location | Engine | Prompt | Session | Load signal | Result |
| --- | --- | --- | --- | --- | --- |
| consumer | v3 | positive | `sess_cb023eda-df5b-4098-a809-6d1ee0d7769c` | `disclose_context` `skill::showdown-practice` | `?practice=0` (and 60), Sheriff first, saves nothing |
| consumer | v3 | deal 61 | `sess_ec14e7ff-a6f1-4f9e-84d7-19a868046367` | same | "Deal 61 isn't supported", only 0/60 links |
| consumer | v3 | negative | `sess_0bfbb9ce-929e-4ab5-b38b-e35ad017b5aa` | none | "100 °C" |
| repo | v3 | positive | `sess_4141ebc6-4809-4e19-aad0-45f6c6c3bdc1` | same | `?practice=0` (and 60), Sheriff first |
| repo | v3 | deal 61 | `sess_d78775fc-2464-47b0-b9ba-9901bad8ebbd` | same | not supported, only 0/60 links |
| repo | v3 | negative | `sess_5a79a88d-1fac-4cf3-9b29-cfe1c31907c5` | none | "100 °C." |
| consumer | v2 | positive | `789dd383-331d-4d8e-b891-5be37a3581c5` | read of `.kiro/skills/showdown-practice/SKILL.md` | `?practice=0`/60, Sheriff first |
| consumer | v2 | deal 61 | `11191202-496e-4769-81ff-18277ce1d4e8` | same read | not supported, 0/60 links |
| consumer | v2 | negative | `cde98302-3cf9-430e-a7e3-2cec08edf2d3` | none | "100 °C." |
| repo | v2 | positive | `bfe40127-8fed-4f38-bf99-df1663bea784` | same read | `?practice=0`/60, Sheriff first, warns off `?seed` |
| repo | v2 | deal 61 | `1ec09963-5958-4975-b462-8c2bd41aeb3b` | same read | not supported, 0/60 links |
| repo | v2 | negative | `f37b9cc8-f529-4899-9b09-a2b84228246e` | none | "Water boils at 100 °C…" |

v3 runs trusted only `disclose_context`; v2 runs trusted no tools. One earlier v3 positive run with no trusted tools
(`sess_ce57d45e-0b2f-462f-bfba-94e20e6d9040`) was denied the skill load in non-interactive mode and said so without
guessing a link. No answer named a later draw, a Wizard card or a strategy.

No allowlist script was added: all four wrong-seed runs refused 61 from the SKILL.md table alone, so a mapper would not
change correctness here.

## Limits

- Proof is two locations in one client (Kiro CLI, v2 and v3 engines), not cross-client. No second client was run:
  the installed Claude, Codex and Gemini CLIs use other paid providers, and Codex is the verifier.
- The public links work only after the entry change (`1b2136f`) is merged and published; the hosted site was not
  checked. Public repository distribution is verifiable only after merge. No registry submission.
- No human tester used the skill. Raw stream-json logs stay outside Git.
