# Kiro plays Showdown through MCP (2026-11-19, America/Los_Angeles)

Worker: Kiro CLI 3.5.0 (claude-opus-5.5), branch `kiro/graywave-showdown-mcp`, base `4d52642`.

**Change.** The workspace MCP server `.kiro/powers/orb-duel-review/server.mjs` (Power 1.2.0) gained
`start_showdown_duel`, `observe_showdown` and `act_showdown` ([showdown.mjs](../../.kiro/powers/orb-duel-review/showdown.mjs)).
They run `createShowdownSession` from `src/match/showdown-session.js`, so rules and bot are the canonical
`src/game/showdown` functions. The agent gets `viewFor(state, "cowboy")`, numbered legal intents and
contract-field events. Sessions and revisions are random tokens. The deal seed is server-random and returned only
as a salted SHA-256 commitment until the duel ends; the finished observation adds `proof` (seed, salt, actions).
`SHOWDOWN_MCP_DEBUG_SEED` fixes the seed for tests and is not a tool input. Existing tools (lane replay receipt,
character GLB) are unchanged and labelled as the earlier build.

**Verification (observed).** `node --test .kiro/powers/orb-duel-review/test/*.test.mjs`: 10 pass.
- Paired hidden states: Cowboy-to-act states from 40 seeds (1000-1039), full decks, level-1 bot both sides: 362 states (43 with Wizard traps),
  each with two re-dealt Wizard hand/trap/deck twins and a different seed; observations identical.
- Fault injection: an observation that adds the Wizard hand is caught by the same pair check.
- Protocol: two server processes with debug seed 60 give identical Boot Hill transcripts; no seed, salt, deck list or
  proof before the end; replay of the proof reaches the same result; stale revision, unlisted intent, extra inputs refused.

**Real Kiro-surfaced run.** `kiro-cli chat --no-interactive --trust-workspace --trust-tools=@orb-duel-review` in this
worktree, 23:04-23:06 PST, no debug seed. Kiro called `start_showdown_duel` once and `act_showdown` 28 times, no other
tool, and won Boot Hill (`winner: cowboy`, `reason: base`). Receipt: [kiro-showdown-mcp-boot-hill.json](kiro-showdown-mcp-boot-hill.json);
a test replays it. The raw CLI log stays outside the repo. This shows the tools work for an agent on one seed; it says
nothing about clarity or fun for people.

**Not done.** The installed Power copy was not reinstalled (no global change), so the installed version may still be 1.1.0.
