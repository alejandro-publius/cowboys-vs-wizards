# Resource checklist: what the 45 recovered sources say to do, ranked

Prepared November 16, 2026 (Pacific) by Fable (Claude Fable 5.2, in a collaborator's Claude Code session). **This is a research and planning document. Nothing in it has been done by writing it, and no Kiro tool was run.** Each gap below was checked against `main` at `ead95f0`. Work that Kiro is doing right now in local worktrees (#43 to #46, #49) is not on `main`, so it is listed as in progress, not as a gap closed.

The source numbers (S1 to S45) are the 45 entries of the recovered resource list; the links are in [the source register](../kiro-source-register.md). Open work lives in the GitHub issue list. If a line here is adopted, it should become an issue.

## The five moves with the most leverage

1. **Publish the video with real Kiro footage** (item 1). It is required, it carries the presentation score, and three of its shots do not exist yet.
2. **Put a person and a real Safari in front of the game** (items 2 and 3). Every source that shipped a browser project says passing checks were not enough, and this project has already proved it twice.
3. **Turn the weakest of the eight write-up topics into a strong one: property-based testing** (item 5). The write-up currently has to say "no generators and no shrinking".
4. **Make the live site name its own build** (item 4). The project's whole argument is that evidence names the build it came from; the deployed page is the one artifact that does not.
5. **Run Kiro as a reviewer on every pull request** (item 6). It is the most visible continuous use of Kiro available, and the setup is a published recipe.

## How to read an item

Each item gives the sources, the gap as it stands today, how to do it, who has to do it, and what "done" means. **Who** matters: the hackathon scores how Kiro was used, so some work only counts if a Kiro session does it ([#37](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/37)). "Any agent" means a coding agent or a person can do it without affecting that.

## A. Before submission: required or scored directly

### 1. Record the three missing shots and publish the video
- **Sources:** S2, S18, S44; project re-check of the rules (five criteria at 20% each, so design and presentation are 40%).
- **Gap today:** narration is not recorded; footage K1 (Workflow run), K2 (Power pass and stale) and N (Night Watch report) do not exist; no public YouTube link. The IDE's Workflow tab (1.4.86 and later) shows the step tree beside a step's transcript, which is exactly shot K1.
- **How:** follow [the demo script](judge-demo-script.md), whose facts were re-checked in #50. Film K1 in the IDE Workflow tab on the final run `wf_0572a745f5194cf1`. Film K2 from an installed-Power session. Reload Night Watch before filming N.
- **Who:** a person.
- **Done when:** a public YouTube link under three minutes is in the README, the judge guide and the form.

### 2. Run the first-time player sessions
- **Sources:** S31 (nobu_13), S36, S39, S40. All four found player-visible faults after green tests.
- **Gap today:** 0 sessions. The protocol is written and blank ([#19](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/19), [#20](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/20)).
- **How:** as the protocol says. Three real sessions are enough to replace "no human has played this" in three documents.
- **Who:** a person. An agent must not stand in.
- **Done when:** the results table has three rows and the "not run" lines are updated in the packet, the story and the script.

### 3. Confirm the blank-card defect in real Safari, and fix it
- **Sources:** S40 (the reviewer used a real browser and listed what it had not verified: other browsers, mobile, Safari); S1 (the registry's BrowserStack Power runs on real devices).
- **Gap today:** Playwright WebKit draws every hand card blank ([evidence](../evidence/webkit-smoke.md)). Not confirmed in Safari. The fix is assigned to Kiro in #43 and is not on `main`. No real phone has been tried ([#21](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/21)).
- **How:** open the live game in Safari on a Mac and on an iPhone and look at the hand; one minute each. After #43 lands, rerun `scripts/browser-webkit-smoke.mjs`. BrowserStack would cover more devices but is a paid service, so it is an owner decision, not a default.
- **Who:** a person for Safari and the phone; Kiro for the fix (already assigned).
- **Done when:** `docs/evidence/human-device-check.md` exists and the WebKit check shows card faces.

### 4. Publish a build identity file with the site
- **Sources:** S35 (nobu_13: verify the commit you deploy matches the one you reviewed), S19 (audit trail agents cannot edit), S22 (test deployed flows).
- **Gap today:** `pages.yml` prints the SHA-256 of `dist/web/index.html` into the run summary, which only someone with repository access can find. `https://alejandro-publius.github.io/cowboys-vs-wizards/build.json` returns 404. A judge cannot tie the page in front of them to a commit.
- **How:** in the `pages.yml` build job, after the web build, write `dist/web/build.json` with the commit, the build time and the SHA-256 of `index.html`. No change under `src/`. Then add a final job step that fetches the live `build.json` after deploy and fails if its commit is not the one just built.
- **Who:** any agent; the coordinator owns `pages.yml`.
- **Done when:** the live URL returns the commit of `main`, and the README's Verify table has a row for it.

### 5. Property-based tests with real generators and shrinking
- **Sources:** S16 (Kiro extracts properties from EARS requirements, generates hundreds or thousands of cases and shrinks failures; listed as an IDE capability), S15 (boundary-focused generators; difference-test a simple model against the real code; reproduce every failure on unmodified code), S31 (Oshima: turn acceptance criteria into property tests).
- **Gap today:** the six properties are loops over seeds 0 to 99. The write-up has to say "no generators and no shrinking" under a required topic. No test file cites a requirement number. #44 (Kiro, in progress) adds a generated clash-log suite.
- **How:** in the Kiro IDE, open the `orb-duel` spec and run its optional property-test tasks so the tests come from the spec. Aim generators at the boundaries the seeded deals rarely reach: decks at the six-copy cap, one-Sheriff decks, full boards, a troop at one orb, a clash that empties both lanes. Good candidate properties: card conservation, orb bounds, replay determinism, and "no level of the CPU reads hidden information". Keep any shrunk failing case as a named regression.
- **Who:** Kiro (IDE). An agent adding a property library by hand would not count toward the topic and needs a dependency decision.
- **Done when:** topic 7 of the packet can drop its last sentence, with a receipt of one generated run.

### 6. A Kiro reviewer on every pull request
- **Sources:** S41 (the full recipe), S22 (one review round, findings tiered by severity, reviewer from a different model family than the author), S14 (separate proposing from judging).
- **Gap today:** `.github/workflows/` has `ci.yml` and `pages.yml` only. `.kiro/agents/` has one agent, not a reviewer. #45 ran one Kiro review Workflow locally on PR #40; nothing runs on each pull request.
- **How:** S41's recipe, adapted. A read-only agent `.kiro/agents/pr-reviewer.md` (read tool only; no write, shell or network; told to treat the diff as untrusted). A workflow on `pull_request` with `contents: read` and `pull-requests: write`, skipping forks, that pipes `git diff origin/$BASE...HEAD` (capped at 150 KB) into `kiro-cli chat --v3 --no-interactive --agent pr-reviewer` and posts one comment. Add a per-PR concurrency group. Never use `pull_request_target`.
- **Costs and limits:** needs a `KIRO_API_KEY` repository secret from a paid plan, and each review spends credits. The 150 KB cap can cut a diff; have the comment say when it did.
- **Who:** Kiro writes the agent; the repository owner adds the secret.
- **Done when:** one pull request carries a Kiro review comment, and its link is in the evidence map.

## B. Deepens the Kiro story

### 7. Hooks that enforce a rule, each with a receipt of it firing
- **Sources:** S9 (CLI 3.4.0, November 16: `PreToolUse` can rewrite or gate a tool call, and a new `PermissionRequest` hook can deny); S37 (controls enforced by tools); S19 (enforce permissions at the host, not in the prompt); S35 (test each hook on its own, because one loaded and never fired); S39 (disclose a hook that was never seen firing); S36 (run the full suite from a hook after each task).
- **Gap today:** one workspace hook (`PostFileSave` on card specs) and three agent hooks (`SessionStart`, `PreCompact`, `PostCompact`). No `PreToolUse`, `PermissionRequest` or `Stop` hook. The project's strictest rules, "do not edit existing evidence files" and "preserve the original Tripo models", are enforced only by prose in `AGENTS.md`.
- **How:** (a) a `PreToolUse` hook that denies a write to an existing file under `docs/evidence/` and to the original model files; (b) a `Stop` hook that runs `node scripts/verify-duel.mjs`; (c) a `PostFileSave` hook on Markdown that runs the link check, already queued as #46 behind #42. Trigger each one on purpose and keep its output.
- **Who:** Kiro.
- **Done when:** each hook has a dated receipt, including one of the guard refusing a write.

### 8. Steering: the three default files, and rules steering for `src/game/`
- **Sources:** Kiro steering docs (S29: `product.md`, `tech.md`, `structure.md`; inclusion modes `always`, `fileMatch`, `manual`, `auto`); S33 (fileMatch steering for game rules; enforce rules with tests); S31 (keep steering short); S34 (one maintained master design).
- **Gap today:** two steering files. `duel-iteration.md` is scoped to match, render and interface code. Nothing is scoped to `src/game/`, where the hardest rule lives (no DOM, rendering, filesystem or network). The three default files do not exist. #46 (in progress) adds area steering.
- **How:** let Kiro generate the three defaults and trim them; add a `fileMatch` file for `src/game/**`. IDE 1.4.86 flags steering it could not fully use; check that nothing is flagged.
- **Who:** Kiro.
- **Done when:** topic 5 of the packet can name what loads for each area.

### 9. Record credits and transcripts for each Kiro session
- **Sources:** S9 (3.1.0 shows session credits in `/usage`, the status line and workflow step rows; 3.3.0 adds `/transcript` for the whole conversation); S39 (credits recorded per phase: 1.86 for the spec, 43.13 in total); S37 and S42 (usage measurement); S4 (Auto's model handoffs cannot be observed, so do not claim them).
- **Gap today:** one usage figure is on record (0.6441 credits). The closeout receipt says "this run emitted no usage figures". The evidence map lists as a gap that the Kiro runs cannot be inspected from the repository.
- **How:** at the end of each Kiro session, save `/usage` and `/transcript` beside the evidence note. Add a credits column to the build log from here on. Do not back-fill.
- **Who:** the person running Kiro.
- **Done when:** the sessions for #43 to #46 each have a figure or the words "not captured".

### 10. A Workflow with independent reviewers in parallel
- **Sources:** S12 (`parallel` nodes, `semantic_reviewer`, `wf-design-reviewer`, `wf-review-aggregator`, `repeat` with a `fileCheck` stop condition, `validate_workflow` before launch); S11 (reviewers that never see the coder's reasoning); S22 (reviewers from a different model family); S34 (a fresh-session reviewer step).
- **Gap today:** three saved Workflows. The replay Workflow is three `wf-coder` steps in sequence; the lore review uses `repeat`. None runs reviewers in parallel or merges their reports, and no step sets a different model for the reviewer.
- **How:** one recipe for a frozen pull request: tests and replay, then two reviewers in parallel (behaviour, and design against the spec), then the aggregator writing one report. Give the reviewers a different `modelId` from the author. Run `validate_workflow` first.
- **Who:** Kiro.
- **Done when:** one run's report is in `docs/evidence/` with the recipe in `.kiro/workflows/`.

### 11. Demonstrate Memory, which was recorded as blocked
- **Sources:** S23 (Memory is off by default; enable it with `/memories`; an access change takes effect in a new session; needs CLI 2.29 or IDE 1.4.0).
- **Gap today:** the evidence says a fresh V3 session "exposed no Memory tool". The article gives the likely reason: it had not been switched on, and switching it on needs a new session.
- **How:** `/memories`, choose read and write, start a new session, correct Kiro on one repository fact, start another session on related work and capture the Memory entry. Keep mandatory rules in steering; Memory is for what comes up mid-task.
- **Who:** the person running Kiro.
- **Done when:** the receipt replaces the "blocked" line, or records what else stopped it.

### 12. Requirement-to-test traceability
- **Sources:** S39 (18 of 22 tasks named the criteria they satisfied), S40 (link each requirement to a test), S16.
- **Gap today:** no test file under `tests/` mentions a requirement number. Only requirement 5.6 is traced to a property in prose.
- **How:** have Kiro annotate each property test with the requirement it validates, then add a small test that fails when a requirement has no test citing it.
- **Who:** Kiro for the annotations; any agent for the checking test.
- **Done when:** the check passes and the packet links the table.

## C. Cheap hygiene any agent can do

### 13. A permanent negative control for the checks
- **Sources:** S36 (Necrolink: add a known-good control to test your checker), S14 (lock each fix in as a permanent assertion; audit the harness), S35 (confirm tests actually ran before trusting a pass).
- **Gap today:** the experiment that proved the clash property catches a missing attack was run once, by hand, on a copy. Nothing in the suite would notice if that property stopped detecting anything. The WebKit check passed with blank cards.
- **How:** a test that hands the clash property a presenter with one attack removed and expects it to fail. #43 is adding the equivalent for card faces.
- **Done when:** the suite contains a check that is expected to catch a planted fault.

### 14. One readiness verdict: every expected check ran
- **Sources:** S22 ("nothing failed" is not "everything ran"; cheap checks first; one verdict), S35 (GhostPR).
- **Gap today:** `ci.yml` runs `npm test` and trusts its exit status. A test file that silently stopped being picked up would not turn anything red. The link check (#42) and the web build are not part of the pull request check.
- **How:** have the test job assert a floor on the number of test files and tests, add the web build, and write a summary listing each expected check and whether it ran.
- **Done when:** the job summary shows the list, and removing a test file turns it red.

### 15. Enforce the pure-rules boundary with a test
- **Sources:** S33 (Ribhav: enforce rules with tests, such as banning engine imports from game logic), S31 (Burgholzer: failures escaped at runtime boundaries).
- **Gap today:** `AGENTS.md` says `src/game/` must have no DOM, rendering, filesystem, network or model dependency. The code obeys it; no test checks it.
- **How:** a test that reads every file in `src/game/` and fails on an import from outside it or on `document`, `window`, `fetch` or `node:`.
- **Done when:** adding such an import turns the suite red.

### 16. A size budget for the web build
- **Sources:** S22 (bundle-size budgets in the gate).
- **Gap today:** `dist/web/` is 52 MB across 27 assets and the single-file build is 62 MB. Nothing fails if a model or image is added by mistake. First load on a phone connection has not been measured.
- **How:** a step that fails when `dist/web/` or `index.html` grows past a set ceiling a little above today's figures.
- **Done when:** the budget is in CI with today's numbers recorded.

### 17. Keep build output and large assets out of Kiro's context
- **Sources:** S31 (Vitor: `.kiroignore` for build output, caches and large asset dumps), S33 (disable unused MCP servers).
- **Gap today:** there is no `.kiroignore`. The repository holds a 62 MB generated HTML when built, model files, and long evidence logs.
- **How:** confirm the file name and syntax in the current Kiro docs, then ignore `dist/`, `node_modules/`, `.artifacts/`, the model files and the large evidence JSON.
- **Done when:** the file is tracked and a Kiro session confirms it is honoured.

### 18. A guard against secrets, and a decision on local paths
- **Sources:** S40 (a pre-commit hook that blocks secrets, account IDs and agent state files in a public repository).
- **Gap today:** a scan for key-shaped strings found none. Eleven tracked files contain a local home path, and evidence files contain session IDs; the receipts say this was left unredacted on purpose. Nothing would stop a key being committed tomorrow, and the review recipe in item 6 introduces a `ksk_` key.
- **How:** a CI step that fails on key patterns (`ksk_`, `gho_`, `AKIA`, `sk-`). Decide once whether home paths stay.
- **Done when:** the step exists and the decision is written down.

### 19. Say what makes a review finding blocking
- **Sources:** S22 (a blocking finding needs a location, quoted evidence, a trigger and a consequence; everything else is advisory or a follow-up issue).
- **Gap today:** `CONTRIBUTING.md` and the pull request template do not say it. Reviews so far have been disciplined, but the rule is unwritten.
- **How:** four lines in `CONTRIBUTING.md`.
- **Done when:** merged.

### 20. Draft the social post and settle the bonus formats
- **Sources:** S43 to S45; the project's rules re-check; [#38](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/38).
- **Gap today:** nothing is drafted for the social bonus. The blog draft exists and is unpublished. The Crew bonus needs its own repository submission, whose required format is unchecked. S35 notes credits must be requested before December 1.
- **How:** a person confirms each line on the rules page while logged in; an agent can draft the post text.
- **Done when:** each bonus is marked entered or declined in #38.

## D. Optional, with a real cost

### 21. One bounded Kiro Web task
- **Sources:** S26 (label an issue `kiro`; it opens a pull request and never merges), S25 (`kiro-cli --cloud`).
- **Gap today:** the packet says "Kiro Web was not used", which is true. Three of the four apps were.
- **How:** only if there is a real small task for it, such as the sentence in `devpost-packet.md` that still names only the earlier Workflow run. Needs Kiro Web enabled on the account.
- **Caution:** #37 says not to use a feature only to list it. Skip this unless the task is useful by itself.

### 22. A tracked sandbox configuration for unattended runs
- **Sources:** S24 (`.kiro/settings/sandbox.json`, `permissions.yaml`; writes confined to the project; network through a filter), S17 (keep deny rules; avoid trusting all tools), S33 (define permissions and rollback before autonomous changes).
- **Gap today:** `.kiro/settings/` holds `mcp.json` only. The sandbox was tried once in a scratch workspace. Kiro jobs now run unattended with a watchdog.
- **How:** a project `sandbox.json` that confines writes to the worktree and limits network to what the checks need.
- **Who:** Kiro and the owner.

## Not worth doing

- **A Crew Bot (S21).** Night Watch already covers the recurring job. A bot would be a second thing to verify.
- **An adoption dashboard (S42).** A team-scale tool; item 9 gets the useful part.
- **Lean proofs (S15).** The article's borrowable habits are in item 5. Do not call seeded or generated tests formal verification.
- **Hosting Kiro on other hardware (S35: Unraid, Raspberry Pi, Lambda).** No evidence the project needs it.
- **Approve for me as a feature to show (S17).** Use it if confirmations get in the way; it is not an achievement.
- **More mechanics.** Every case study that shipped (S38, S39, S40) cut scope and tested what existed. The larger spell and trap ideas stay deferred.

## What the project already does that the sources recommend

Worth saying in the write-up, because the sources treat these as the hard parts: a task ledger with owners and separate worktrees (S19); attribution by tool with limits stated (S39, S40); a stale-evidence reviewer (S35); findings from a real browser recorded as findings (S36, S40); exact dependency pins (S35); tests on every pull request; rules kept in pure modules (S31); and a list of what was not verified in nearly every evidence note (S40).

## Coverage: what was read for this document

| | Sources | Count |
| --- | --- | --- |
| Read on November 16 for this document | S1, S4, S8 to S17, S19 to S27, S29 to S36, S38 to S41 | 33 |
| Index pages or videos, not opened in this pass | S2 Videos, S5 Community, S6 Blog index, S7 main changelog, S18 Crew walkthrough video, S28 Crew source | 6 |
| Could not be read | S3 (YouTube link, contents never recovered), S37 (full November 15 issue never recovered), S42 (HTTP 403), S43 to S45 (Devpost pages return HTTP 403 to automated readers) | 6 |

For S29 and S30 the pages read were the hooks, steering, Workflow authoring and spec correctness references and the guides index. For S43 to S45 this document relies on the project's own logged-in re-check of November 16 and on [#38](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/38); **a person should confirm every rule on the official page.** Pages were read through an automated summarizer, so a detail quoted from a source should be checked on the page before it is relied on. One such detail: `.kiroignore` (item 17) comes from a reading-list summary, not from Kiro's reference docs.
