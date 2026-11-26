# Resource checklist: what the 45 recovered sources say to do, ranked

The checklist below records the November 16 research pass. The current release notes track the playable features and remaining submission work. The Billy animation pilot closed after its grip review. [Current project status](../PROJECT-STATUS.md#current-build) · [Billy pilot review](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/53)

Prepared November 16, 2026 (Pacific) by Fable (Claude Fable 5.2, in Rachel's Claude Code session), originally against `ead95f0`. Codex reconciled the completed work against `965bd709` after PR #52. **This is a research and planning document; writing it did not execute any proposal or Kiro tool.** Kiro #43–46 are now integrated, with their precise limits recorded below. Billy #49/#53 remains a preview; its sourced idle/shoot does not yet give a satisfactory grip. The [integration receipts](../evidence/parallel-closeout-2200.md) and [PR #52 CI](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/52) record 184 tests, two model-structure checks and the separate browser checks. Human, device, video and submission work remain open.

The source labels S1–S45 are defined in the [reference legend](#reference-legend) below. Their retained URLs and provenance come from [the source register](../kiro-source-register.md), which does not use these IDs. Labels identify references, not implementation or verification evidence. Open work lives in the GitHub issue list; coordinate an owner before adopting another item.

## The five moves with the most leverage

1. **Publish the video with real Kiro footage** (item 1). It is required, it carries the presentation score, and three of its shots do not exist yet.
2. **Put a person and a real Safari in front of the game** (items 2 and 3). Every source that shipped a browser project says passing checks were not enough, and this project has already proved it twice.
3. **Turn the weakest of the eight write-up topics into a strong one: property-based testing** (item 5). The expanded generated coverage still has no shrinking.
4. **Build identity is now live** (item 4). PR #55 publishes the commit and HTML hash, and the actual deployment verification passed.
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

### 3. Verify the card-face fix in real Safari and on a phone
- **Sources:** S40 (the reviewer used a real browser and listed what it had not verified: other browsers, mobile, Safari); S1 (the registry's BrowserStack Power runs on real devices).
- **Current state:** Kiro #43's fix is merged. The earlier [blank-card finding](../evidence/webkit-smoke.md) is historical: the combined web build now passes 6/6 card-face states in WebKit and 6/6 in Chromium ([fix and limits](../evidence/kiro-webkit-card-fix.md)). Actual Safari and a real phone remain unverified ([#21](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/21)).
- **How:** check the live hand, hover/selection, summon and viewer flip in actual Safari on a Mac and on an iPhone. Save the device/browser versions and observed results. The automated card-face regression already ran; repeat only after a relevant change or failure. BrowserStack is an optional paid path, not a default dependency.
- **Who:** a person or available real-device session for Safari and the phone; Kiro's fix is complete.
- **Done when:** `docs/evidence/human-device-check.md` exists and the WebKit check shows card faces.

### 4. Publish a build identity file with the site
- **Sources:** S35 (nobu_13: verify the commit you deploy matches the one you reviewed), S19 (audit trail agents cannot edit), S22 (test deployed flows).
- **Current state:** Kiro #54 is merged through PR #55. The public [build.json](https://alejandro-publius.github.io/cowboys-vs-wizards/build.json) identifies the build, and the README has a Verify row. The real [Pages run](https://github.com/alejandro-publius/cowboys-vs-wizards/actions/runs/44037705030) checked both the manifest and served HTML against independent CI commit/hash expectations and passed on attempt 1.
- **Evidence:** [Kiro implementation and actual deployment receipt](../evidence/kiro-build-identity.md). Only index.html identity is covered, not all assets.
- **Status:** complete for this scoped release-verification task.

### 5. Property-based tests with real generators and shrinking
- **Sources:** S16 (Kiro extracts properties from EARS requirements, generates hundreds or thousands of cases and shrinks failures; listed as an IDE capability), S15 (boundary-focused generators; difference-test a simple model against the real code; reproduce every failure on unmodified code), S31 (Oshima: turn acceptance criteria into property tests).
- **Current state:** the earlier six properties cover seeds 0–99. Kiro #44 now adds a dependency-free corpus of **800 legal matches**, from 200 seeds and four bot pairings, with replayable failures and no shrinking ([evidence](../evidence/kiro-preview-contracts.md)). Codex fixed single-seed replay's coverage-only assertion. This is already useful generated coverage; boundary-focused generation and shrinking remain optional improvements, not a reason to relabel the existing results.
- **How:** in the Kiro IDE, open the `orb-duel` spec and run its optional property-test tasks so the tests come from the spec. Aim generators at the boundaries the seeded deals rarely reach: decks at the six-copy cap, one-Sheriff decks, full boards, a troop at one orb, a clash that empties both lanes. Good candidate properties: card conservation, orb bounds, replay determinism, and "no level of the CPU reads hidden information". Keep any shrunk failing case as a named regression.
- **Who:** Kiro IDE or CLI; credit the tool that actually performs the work. A library is an implementation choice requiring a concrete benefit, not a prerequisite for honest Kiro attribution.
- **Done when:** an actual run exercises the stated boundaries, and any claimed shrinking is demonstrated by a minimized failing case. Update topic 7 to match those receipts; retain every limitation still true.

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
- **Current state:** two workspace save hooks now exist: card-spec registration and documentation links, alongside the three earlier agent hooks. Kiro #46's documentation hook failed on a deliberate broken link and passed after removal, repeated on the corrected wrapper ([actual receipts](../evidence/kiro-doc-link-hook.md)). Scoped write guards are a separate proposal; no `PreToolUse`, `PermissionRequest` or `Stop` execution is claimed.
- **How:** the Markdown hook is complete. If useful, add a narrowly scoped guard for original models or immutable receipts and prove it refuses a disposable attempted edit. Preserve the coordinator's authorized correction path. Select checks by changed area; do not run the full suite after every documentation save. Confirm installed hook semantics before implementing another guard.
- **Who:** Kiro.
- **Done when:** each hook has a dated receipt, including one of the guard refusing a write.

### 8. Demonstrate the configured area steering
- **Sources:** Kiro steering docs (S29: `product.md`, `tech.md`, `structure.md`; inclusion modes `always`, `fileMatch`, `manual`, `auto`); S33 (fileMatch steering for game rules; enforce rules with tests); S31 (keep steering short); S34 (one maintained master design).
- **Current state:** five steering files are tracked. Kiro #46 added `rules-area.md`, `rendering-area.md` and `interface-area.md`; the rules file covers the pure-game boundary. These are configured file scopes, not independent proof of native activation ([evidence](../evidence/kiro-scoped-steering-hook.md)).
- **How:** use a bounded session on an owned task to capture native evidence of which configured steering is included, where the installed client exposes it. Avoid adding duplicate default files merely to increase the count. If the client does not expose inclusion, record that limit.
- **Who:** Kiro.
- **Done when:** topic 5 names configured scopes separately from any actual activation receipt. Configuration alone must not be called observed loading.

### 9. Record credits and transcripts for each Kiro session
- **Sources:** S9 (3.1.0 shows session credits in `/usage`, the status line and workflow step rows; 3.3.0 adds `/transcript` for the whole conversation); S39 (credits recorded per phase: 1.86 for the spec, 43.13 in total); S37 and S42 (usage measurement); S4 (Auto's model handoffs cannot be observed, so do not claim them).
- **Current state:** the original 0.6441-credit trial remains historical. Codex recovered actual credit-unit metadata for ten later dispatched CLI jobs, with session IDs and source hashes ([receipt](../evidence/kiro-session-usage-20261116.md)). These observations are not an account total; Workflow parent/child accounting is not aggregated. Capture future sessions at completion rather than back-filling estimates.
- **How:** at the end of each Kiro session, save `/usage` and `/transcript` beside the evidence note. Add a credits column to the build log from here on. Do not back-fill.
- **Who:** the person running Kiro.
- **Done when:** the sessions for #43 to #46 each have a figure or the words "not captured".

### 10. A Workflow with independent reviewers in parallel
- **Sources:** S12 (`parallel` nodes, `semantic_reviewer`, `wf-design-reviewer`, `wf-review-aggregator`, `repeat` with a `fileCheck` stop condition, `validate_workflow` before launch); S11 (reviewers that never see the coder's reasoning); S22 (reviewers from a different model family); S34 (a fresh-session reviewer step).
- **Current state:** four saved Workflow recipes are tracked. The new contributor-review Workflow actually ran on frozen PR #40 as `wf_0b2ce64faf14a4aa`, with four steps, tests and browser receipts ([evidence](../evidence/kiro-contributor-review-40.md)). This is not an automatic per-PR service or a final combined-release review. Independent parallel reviewers remain a separate optional proposal.
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
- **Current state:** the original missing-attack experiment and Kiro #44's dropped-hit mutation are recorded experiments, not permanent mutation tests. The old WebKit interaction smoke passed with blank cards; the newer card-face check detects that baseline as 0/6 and the fix as 6/6.
- **How:** if the extra maintenance is worthwhile, preserve one small planted-fault check for clash completeness. The card-face baseline/fix comparison already exists in #43; do not repeat the original defect investigation.
- **Done when:** the suite contains a check that is expected to catch a planted fault.

### 14. One readiness verdict: every expected check ran
- **Sources:** S22 ("nothing failed" is not "everything ran"; cheap checks first; one verdict), S35 (GhostPR).
- **Current state:** `ci.yml` runs `npm test`, which now includes documentation-link and hook regression tests. PR #52 passed 184 tests and two model-structure checks. The web build runs during Pages deployment but is not a separate PR check. An expected-check summary could make omissions more visible.
- **How:** if needed, add the web build and an explicit summary of expected checks. Prefer checking meaningful suite discovery over an arbitrary count floor that becomes stale whenever tests are reorganized.
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
- **How:** only for a useful unclaimed task with account access already available. The Devpost Workflow sentence was already corrected in #52; do not dispatch that completed edit again.
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


## Reference legend

These navigation labels refer to URLs already retained in the source register. Adding this legend did not reopen or verify their contents. S37 identifies the retained preview URL only; the full issue remains unrecovered. S29/S30 are navigation families, with the exact consulted subpages described in the coverage note above. The three Devpost URLs are distinguished here as rules, overview and resources.

| ID | Retained source |
| --- | --- |
| S1 | [Registry](https://kiro.dev/registry/) |
| S2 | [Videos](https://kiro.dev/videos/) |
| S3 | [YouTube yTVWICb6ZI4](https://www.youtube.com/watch?v=yTVWICb6ZI4) |
| S4 | [Model Cascade](https://kiro.dev/blog/model-cascade/) |
| S5 | [Community](https://kiro.dev/community/) |
| S6 | [Developer blog](https://kiro.dev/blog/) |
| S7 | [Changelog](https://kiro.dev/changelog/) |
| S8 | [IDE changelog](https://kiro.dev/changelog/ide/) |
| S9 | [CLI changelog](https://kiro.dev/changelog/cli/) |
| S10 | [Crew changelog](https://kiro.dev/changelog/crew/) |
| S11 | [Introducing Workflows](https://kiro.dev/blog/introducing-workflows/) |
| S12 | [Workflow authoring](https://kiro.dev/docs/workflows/authoring/) |
| S13 | [CLI V3](https://kiro.dev/blog/cli-3/) |
| S14 | [How Kiro fixes itself](https://kiro.dev/blog/how-kiro-fixes-itself/) |
| S15 | [Harness properties in Lean](https://kiro.dev/blog/harness-properties-in-lean/) |
| S16 | [Spec correctness](https://kiro.dev/docs/specs/correctness/) |
| S17 | [Approve for me](https://kiro.dev/blog/introducing-approve-for-me/) |
| S18 | [Crew walkthrough](https://kiro.dev/videos/JjVbje4kAlY/) |
| S19 | [How we built a software factory with Kiro Crew](https://kiro.dev/blog/software-factory-1000-prs/) |
| S20 | [Introducing Kiro Crew](https://kiro.dev/blog/introducing-kiro-crew/) |
| S21 | [Introducing bots in Kiro Crew](https://kiro.dev/blog/crew-bots/) |
| S22 | [Keeping a software factory stable](https://kiro.dev/blog/software-factory-stability/) |
| S23 | [Introducing memory in Kiro IDE and CLI](https://kiro.dev/blog/memory-in-ide-cli/) |
| S24 | [Local sandboxing](https://kiro.dev/blog/local-sandboxing/) |
| S25 | [Close the laptop, keep the agent: cloud sessions](https://kiro.dev/blog/cloud-sessions/) |
| S26 | [Technical debt with autonomous mode in Kiro Web](https://kiro.dev/blog/tackling-technical-debt-at-scale-with-autonomous-mode/) |
| S27 | [Powers support Agent Plugins](https://kiro.dev/blog/powers-supports-plugins/) |
| S28 | [Kiro Crew source](https://github.com/kirodotdev/KiroCrew) |
| S29 | [Kiro Documentation](https://kiro.dev/docs/) |
| S30 | [Kiro Guides](https://kiro.dev/docs/guides/) |
| S31 | [October 4](https://builder.aws.com/content/3KF8lMm5mZQmBdkQFKNAFLblr0K/kiro-weekly-reading-list-4th-october-2026) |
| S32 | [October 11](https://builder.aws.com/content/3KaOedJXz7X3bKtOp40VoesUTbj/kiro-weekly-reading-list-th-october) |
| S33 | [October 18](https://builder.aws.com/content/3KsUwW0THpSz9UcaPkopKifzaju/kiro-weekly-reading-list-18th-october-2026) |
| S34 | [October 25](https://builder.aws.com/content/3LCkjfJIloaNwsVPRBygBll5h8C/kiro-weekly-reading-list-25th-october-2026) |
| S35 | [November 1](https://builder.aws.com/content/3LWfIgHmjUGOCCYX7sZXC0DJSn6/kiro-weekly-reading-list-1st-november-2026) |
| S36 | [November 8](https://builder.aws.com/content/3LpdwaZwh9sTkbCk8cAXBezlKKR/kiro-weekly-reading-list-8th-november-2026) |
| S37 | [November 15 preview](https://builder.aws.com/?trk=61b8af3d-aa07-438d-b99e-55cdb524dc02) |
| S38 | [Duskline](https://builder.aws.com/content/3KCH1lCKDVDv4FJlPFdoAEb0vEX/building-duskline-from-an-idea-to-a-live-d-browser-game-with-kiro-and-antideploy) |
| S39 | [VCR Party Host](https://dev.to/aiq_labs/bringing-back-the-vcr-board-game-with-kiro-a-spec-driven-build-from-the-command-line-2a6) |
| S40 | [Kiroween Invitation browser review](https://builder.aws.com/content/3LpKUiMT9UXTjR58Q0hYLsvTSv3/green-tests-were-not-enough-what-kiro-crew-found-in-my-kiroween-project) |
| S41 | [How To Review Pull Requests with Kiro CLI and GitHub Actions](https://dev.to/erikch/how-to-review-pull-requests-with-kiro-cli-and-github-actions-1b9b) |
| S42 | [Measuring Kiro Adoption: Dashboards and Queries That Show Whether Your Team Is Using It Well](https://blog.davidmernst.com/measuring-kiro-adoption-dashboards-and-queries-that-show-whether-your-team-is-using-it-well-79ce22a2d6cc) |
| S43 | [Rules](https://kiroween.devpost.com/rules) |
| S44 | [overview](https://kiroween.devpost.com/) |
| S45 | [resources](https://kiroween.devpost.com/resources) |
