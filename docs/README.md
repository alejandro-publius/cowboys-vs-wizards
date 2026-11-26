# Documents: what is current and what is a record

**Open work lives in the [GitHub issue list](https://github.com/alejandro-publius/cowboys-vs-wizards/issues), not in any document here.** Several files in this folder are task lists written before the game existed. They read like open work and are not.

Each entry has one of three statuses:

- **Current:** kept up to date. Still check its date, and trust the code and tests over any note.
- **Record:** what happened or was planned at the time. It is not updated, so do not edit it; add a new note instead.
- **Old task list:** assignments that were finished or replaced. Do not treat as open work.

[Play the published game](https://alejandro-publius.github.io/cowboys-vs-wizards/) · [Review the verified build](PROJECT-STATUS.md#current-build) · [Try the judge walkthrough](JUDGE-GUIDE.md). To build the game, start at the [project README](../README.md). To work on the code, start at [AGENTS.md](../AGENTS.md).

## Files

| Document | Status | What it is |
| --- | --- | --- |
| [AGENT-ROUTER.md](AGENT-ROUTER.md) | Current | For each kind of coding task, the few files to read and the first check to run. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Current | Showdown engine, session, screen and release boundaries. |
| [JUDGE-GUIDE.md](JUDGE-GUIDE.md) | Current | A short route for a hackathon judge: what to play, what to inspect, where the evidence is. |
| [KIRO_USAGE.md](KIRO_USAGE.md) | Current | Observed native Kiro CLI sessions and commands to verify submission checks. |
| [SCORECARD.md](SCORECARD.md) | Current | What `npm run scorecard` measures for each Dec 4 Step 0 target and which evidence each row accepts. |
| [PROJECT-STATUS.md](PROJECT-STATUS.md) | Current | Dated Showdown release checks and review links, followed by integration and lane-era history. |
| [cards.csv](cards.csv) | Record | Lane card spreadsheet. The current [Showdown card table](../prototypes/showdown/cards.csv) includes visual direction. |
| [card-types.csv](card-types.csv) | Record | Lane card categories and frame proposals. |
| [rules.csv](rules.csv) | Record | Lane rules. See the current [Showdown rulebook](../prototypes/showdown/RULEBOOK.md). |
| [card-library.md](card-library.md) | Record | Lane cards, decks and research. See [Showdown's art catalog](../prototypes/showdown/ART-DIRECTION.md) for image generation. |
| [kiro-brag-sheet.md](kiro-brag-sheet.md) | Current | How Kiro was used on the project, feature by feature, with links to the evidence for each claim. |
| [kiro-closeout-queue.md](kiro-closeout-queue.md) | Current | The ledger of closeout items (K01 and up) with owner, result and blocker. The handoff issues cite its item numbers; new work still goes in the issue list. |
| [character-animation-plan.md](character-animation-plan.md) | Record | The November 14 plan for rigging and animating the characters. `AGENTS.md` still asks you to read it before animation work, but its authoring steps are an earlier proposal. |
| [kiro-build-log.md](kiro-build-log.md) | Record | The running log of who built what and when, started November 14. Long; search it, do not read it whole. |
| [kiro-source-register.md](kiro-source-register.md) | Record | A November 16 map of research sources and the tasks drawn from them. It is not evidence that any task ran. |
| [kiroween-research-and-recording.md](kiroween-research-and-recording.md) | Record | November 16 notes on the hackathon rules and a plan for recording the demo video. |
| [morning-handoff.md](morning-handoff.md) | Record | A handoff note from the November 16 build. It holds the seed 60 play-through that the project README links to. |
| [project-files.md](project-files.md) | Record | Where the art and model files sit in the owner's own folder outside this repository, as of commit `599450a`. |
| [requirement-test-map.md](requirement-test-map.md) | Current | Kiro-authored traceability map connecting Orb Duel acceptance criteria to tests, gaps and recorded property checks. |
| [fable-tasks.md](fable-tasks.md) | Old task list | Jobs assigned to Fable before the playable release. All are done or replaced. |
| [kiro-task-01.md](kiro-task-01.md) | Old task list | The first engine task written for Kiro. The task is done, but `AGENTS.md` still points here for the draft card numbers and known rule contradictions. |
| [kiro-task-queue.md](kiro-task-queue.md) | Old task list | The early queue of Kiro tasks, replaced first by `fable-tasks.md` and then by the closeout queue. |

## Folders

| Folder | Status | What it is |
| --- | --- | --- |
| [design/](design/) | Current | Start at its [index](design/README.md). Fable's design briefs for Kiro, as written, with an index of what was built, and the [release line and scoreboard](design/release-line.md): what is in the game, what is waiting on a playtest and what was cut. |
| [evidence/](evidence/) | Record | One dated note per piece of work, with the receipts, screenshots, simulation output and logs it cites. Some files are tied to recorded hashes. Never edit an existing file; add a new note. |
| [references/](references/) | Record | A pinned copy of a third-party character-animation guide (Lucca Cerf, MIT license) used as a reference. Not project writing. |
| [submission/](submission/) | Current | Drafts for the hackathon entry: the submission form text, the build story and the demo script with its playtest protocol. |

## Keeping this page true

`tests/assets/links.test.mjs` fails if a file or folder directly in `docs/` is missing from this page, and if any relative link in a tracked Markdown file points at something that does not exist. Run `node scripts/check-links.mjs` to list broken links.
