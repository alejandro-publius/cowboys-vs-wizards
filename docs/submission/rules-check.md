# The entry checked against the official rules

Prepared November 16, 2026 (Pacific) by Fable (Claude Fable 5.2, in a collaborator's Claude Code session). Checked against `main` at `4c0723d`.

**Source.** The Rules and Overview pages of kiroween.devpost.com, copied from a logged-in browser on November 16, 2026 and pasted into the session by a team member. The Rules page was marked "Updated November 16, 2026". Earlier project documents had the rules second-hand because the site blocks automated readers; this is the first check against the text itself. The Resources tab was not provided and is not covered. Quotes below are from the pasted text. This document changes no other file and makes no submission.

## What the rule text changes

Nine things the project's documents did not have, or had only in part:

1. **The write-up asks specific questions under each of the eight topics.** The packet describes what was done under each heading but leaves most of those questions unanswered. See the table below.
2. **Judges "are not required to test the Project and may choose to judge based solely on the text description, images, and video".** Images are named. No screenshots have been chosen for the submission gallery.
3. **Judging "may utilize expert panels, peer review, automated AI-driven analysis, or any combination thereof".** The repository and write-up may be read by a tool before a person. Plain headings and working links matter.
4. **The Social Blitz post is judged on "original thoughts vs AI writing".** A person has to write it. No agent should draft it. It "must start with the hashtag" `#KiroweenHackathon26`.
5. **Pre-existing work must be disclosed.** Entrants "must disclose any other pre-existing code or work incorporated into the Project". The packet has no disclosure paragraph.
6. **The video "must not include third party trademarks".** The demo script names other products in its narration and captions.
7. **Credits have their own deadline.** Each entrant, "including each member of a Team", may request 4,000 Kiro credits "by Tuesday, December 1, 2026 at 12:00 pm Pacific Time"; codes must be redeemed by December 4.
8. **"Insufficient use of Kiro will result in disqualification at the Judges' sole discretion"**, and stage one of judging is a pass or fail on whether the project "reasonably applies the required tools". The honest split of work between Kiro, Fable and Codex has to read as substantial Kiro use, not as a small share.
9. **Best Demo needs more than a good video:** the highest Presentation score "that is also in the top 10% of overall eligible Submission scores".

## Submission requirements

| Rule | Status | Evidence or what is left |
| --- | --- | --- |
| Built with Kiro (IDE, CLI, Web and/or Crew) | Met | IDE, CLI and Crew, with receipts in [the evidence map](../kiro-brag-sheet.md) |
| "Newly created by the Entrant after the start of the Hackathon Submission Period" (October 30) | **Owner to confirm** | The first commit is dated November 14 and is titled "preserve existing board demo and Kiro preparation". Confirm that the demo it preserved was itself made on or after October 30, and say so in the description. |
| Disclose pre-existing code or work | **Open** | Needs one paragraph: Three.js and Rapier (libraries), the Tripo-generated models and when they were generated, the Mixamo idle motion, the MIT-licensed Lucca Cerf reference files in `docs/references/`, and any sourced motion that ships later. |
| Third-party SDKs, APIs and data used under their terms | **Owner to confirm** | Tripo output and Mixamo motion are used under those services' terms; the project's notes say some download and licence metadata is missing. |
| URL to the working application, free and unrestricted "until the Judging Period ends" (January 29, 2027, 1:00 pm Pacific) | Met today | The live site returned HTTP 200, and its `build.json` named commit `4c0723d`. It has to stay up for ten more weeks. |
| Text description of features and functionality | Drafted | [`devpost-packet.md`](devpost-packet.md) |
| Video: "less than three (3) minutes" | Planned | Script is 2:40, or about 2:50 with the optional Night Watch line |
| Video: shows the project working "on the device for which it was built" | Partly | Real browser footage exists (58.73 s). Narration and the Kiro shots are not recorded. |
| Video: public on YouTube, link in the form | **Open** | No upload yet |
| Video: no third-party trademarks or copyrighted music | **Open risk** | See "Risks" |
| Public GitHub repository (not GitLab or Bitbucket) with all source, assets and instructions | Met | Public; README has build and run steps |
| Open-source licence "detectable and visible at the top of the repository page (in the About section)" | Met | GitHub reports MIT |
| `/.kiro` at the repository root and not in `.gitignore` | Met | Tracked; `.gitignore` does not mention it |
| Category and bonus categories identified | **Open** | Draft says Costume Contest |
| Write-up on how Kiro was used | Drafted, incomplete | See the next section |
| Team of at most three; one Representative enters | **Person** | Every teammate must have joined the hackathon on Devpost. The page this text was copied from still showed "Join hackathon" for the account that copied it. |
| Materials in English | Met | |

## The write-up: the questions the form actually asks

The rules list each topic with its own questions. "Answered today" refers to the packet on `main`. Where an answer needs the builder's own judgment, no agent should write it.

| Topic and question | Answered today? | What the evidence supports |
| --- | --- | --- |
| **Apps.** "How did they differ, if you tried multiple?" | No. The packet says what each did, not how they differed. | The IDE was where the spec was written and reviewed; the CLI ran unattended jobs, hooks and Workflows in separate worktrees; Crew drove a real browser and runs the scheduled Night Watch job. One sentence of comparison would answer it. |
| **Custom agents.** "Which Kiro app did you try them in?" | No | Kiro CLI, per the build log. |
| "How did they impact your build?" | Partly | Scoped permissions, and the card landing-target fix. |
| **Hooks.** "What specific workflows did you automate?" | Yes | Tests at session start, catalog regeneration on save, a receipt ID kept across compaction, and now the documentation save hook. |
| "How did these hooks improve your development process?" | No | Supported: a card's numbers cannot drift from the generated catalog. Beyond that it needs the builder's words. |
| **Specs.** "How did you structure your spec?" | Yes | Requirements, a design with six properties, ten ordered tasks. |
| "How did the spec-driven approach improve your development process?" | Yes | It caught the same-seed restart fault before it shipped. |
| "How did this compare to vibe coding?" | **No** | The attack demo existed before the spec. Whether it was built without one, and how the two felt, is the builder's to say. |
| **Steering.** "How did you leverage steering?" | Yes | Five files, scoped by area. |
| "Was there a particular strategy that made the biggest difference?" | **No** | The packet rightly says no run isolates a steering file's effect. The strategy that mattered most is the builder's judgment. |
| **MCP.** "What ... did MCP enable that otherwise would have been difficult or impossible?" | Partly | Supported: an agent can check that a receipt belongs to the build in front of it and refuse a stale one, without a person comparing hashes. The packet describes the tools but does not say this. |
| **Property-based testing.** "Did PBT help catch any issues you might have missed with unit tests?" | **No** | The honest answer on record: a planted fault was caught in a one-time experiment; no production defect is recorded as found by a property. Say that plainly. |
| "What kind of requirements did you enable PBT for?" | Partly | Simultaneous clashes (requirement 5.6), orb bounds, selection purity, cancellation, the CPU's information limit. |
| **Powers.** "Which powers did you leverage?" | Yes | The project's own Orb Duel Review Power. |
| "Did you use any third-party tooling or integrations you wouldn't have otherwise?" | **No** | No registry Power is recorded as used. If none was, say so in a sentence. |

## Judging criteria: what the entry has for each

All five are "equally weighted", 20% each.

| Criterion (the rules' own questions, shortened) | Strongest evidence | Weakest point |
| --- | --- | --- |
| **Potential Impact:** a real problem for a real audience; "useful, intuitive, and accessible"; "would someone actually use this?" | Keyboard play, a screen-reader clash log, a guided first match in progress | The player problem is still labelled a hypothesis, and no person has been observed playing |
| **Technological Implementation:** thorough and skilful use of Kiro; "a variety of Kiro tools used impactfully"; "was there experimentation?" | Specs, hooks, steering, a custom agent, MCP, a Power, four Workflows, Crew, each with receipts and stated limits | Kiro Web unused; the property tests have no shrinking; several write-up questions unanswered |
| **Design:** "a complete, coherent product experience, not just a technical proof of concept" | Illustrated menu, deck builder, settings, pause and resume | Not confirmed in Safari or on a phone |
| **Innovation/Idea:** novel concept; unusual technologies combined | Evidence that names its build; simultaneous clashes shown on a 3D board | The packet itself says lane-based card duels are not new |
| **Presentation:** the video shows the project "working end-to-end"; says what problem, for whom, and why it matters | Script written and checked against receipts | Nothing is recorded or uploaded |

## Bonus prizes

| Prize | Exact condition | Status |
| --- | --- | --- |
| Best Kiro Crew App ($1,000) | "A writeup describing the features and functionality" and a public GitHub URL; "newly created during the Submission Period"; "GitHub account must match overall submission"; judged among the top 50 | The Night Watch repository is public, MIT-licensed, on the same account, created November 17 UTC. The write-up for the form is not drafted. |
| Bonus Blog (2,000 credits, top 100 by score) | Public post "on any third-party blog platform during the Submission Period" that "must mention it is being written as part of the Kiroween 2026 hackathon" | Draft has the required sentence. Not published. |
| Social Blitz (5 winners) | Starts with `#KiroweenHackathon26`; "your favorite thing about Kiro" and "how it changed the way you approached development"; posted in the Submission Period; link in the form; judged on "original thoughts vs AI writing" | Not written. **A person must write it.** |
| Best Student Project ($1,500 and a subscription, one per category) | "All members of a submitting team must be students", with LinkedIn profile, student email, year and degree, and school for each; proof may be requested | A fact for the team to state. Adding or removing a teammate changes eligibility. |
| Best Demo ($1,000) | Top Presentation score among the top 10% overall | No extra step |
| Best Ghost of Kiroween Past ($2,000) | Registered for Kiroween 2025 | Only the entrant knows |
| Best Startup Project ($10,000) | Founder of a startup, with a website | Only the entrant knows |

A project can win one Overall prize or one Category prize, and any number of bonus prizes.

## Risks to settle before submitting

- **Product names in the video.** Segment 7 of the script says "Fable wrote the engine and CPU ... Codex integrated and verified", segment 5 says "in Chrome", and the screen recordings will show browser and application interfaces. Whether naming or showing another company's product counts as including a third-party trademark is the organisers' call. The low-risk version keeps exact attribution in the written description and says "other AI coding tools" and "a browser" in the video. The rules allow a written request for clarification before the deadline.
- **How the split of work reads.** The description says Fable wrote the rules engine and Codex coordinated. That is accurate and should stay. Put Kiro's work first and concretely, so stage one's "reasonably applies the required tools" is never in doubt.
- **The site must stay up through January 29, 2027.** GitHub Pages will do that if the repository stays public and the workflow keeps passing.

## For people, with dates

| By | Who | What |
| --- | --- | --- |
| December 1, 12:00 pm Pacific | Each team member | Request the 4,000 Kiro credits through the Credit Request Form; allow 48 business hours |
| Before the form is submitted | Each team member | Click "Join hackathon" on Devpost so the Representative can add them |
| Before the form is submitted | The Representative | Confirm the project start date, write the disclosure paragraph, choose the category and bonuses, choose gallery images |
| During the Submission Period | A person | Write and post the social post; publish the blog post |
| December 4, 2:00 pm Pacific | The Representative | Submit. "No extensions will be granted." |
