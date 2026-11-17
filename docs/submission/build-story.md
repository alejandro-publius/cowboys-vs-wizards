# Making a haunted-Western card duel inspectable with Kiro

Draft for a third-party blog, prepared November 16, 2026. Review against the final release before publishing. This article is written as part of the **Kiroween 2026 hackathon**.

Cowboys vs. Wizards is a browser card duel across three 3D lanes. A free Sheriff can hold a lane. Stronger troops cost sacrifices, called tributes. Each troop and each Base has life orbs, and each orb is one life. When the two sides clash, attacks resolve together, even if an attacker is defeated during the exchange.

We built it for people who play strategy and card games in a browser. Our hypothesis is that these players often cannot see why a round went the way it did, because the result arrives as changed numbers or a log line. So we put the decision on the board. Where a troop stands decides what it fights, and both halves of a clash play out in the arena. This is a hypothesis. No first-time player has been observed yet, and lane-based card duels are not a new genre.

What we can show is narrower: positional three-lane decisions, simultaneous outcomes you can watch, and evidence that names the build it was produced from. The clearest example is the match that starts from seed 60. (A seed is a number that makes a match repeatable.) Two tribute summons bring in Mounted Billy with five life orbs, a Singularity spell pulls him into the Dragon's lane, and in the clash he is defeated and still takes the Dragon from five orbs to two.

That exchange became a useful reason to use Kiro: an animation can look convincing and still tell the wrong story about what the rules decided.

## Start with a visible rule
Kiro's Requirements-First Orb Duel specification separated requirements, design and implementation tasks. Fable, the model used in our Claude Code sessions, wrote the pure JavaScript rules engine and CPU. Kiro implemented match selection, presentation and scheduling.

One seeded test compares what the presentation shows with the damage events the engine produced. In a separate experiment, Codex, the coding assistant coordinating the project, deliberately introduced a fault that suppressed defeated attackers, and that test failed at seed zero. The experiment checked the test itself; it was not a production defect that Kiro discovered. Our tests loop over fixed seeds. They do not generate counterexamples or shrink them.

## Make the build identify itself
The saved replay Workflow runs actual browser checks and writes a receipt: a record of the run that includes the hash (a fingerprint) of the HTML it tested. The Orb Duel Review Power, a package installed into Kiro, supplies the review procedure and now bundles its own MCP server to inspect the receipt. A page and a receipt that match pass. Pairing the same clean receipt with an older page returns `stale`.

The saved Workflow passed 157 tests and 12 scripted browser checks. That run belongs to frozen commit `e9aeb06`, and the figures describe that commit. Any later change to the game needs its own checks.

Kiro wrote the reviewer server and the Power's procedure. Codex wrote the first replay Workflow and set up the working workspace MCP connection; Kiro ran and refreshed the Workflow. The first attempt to reproduce the review exposed two problems: the installed copy of the Power was out of date, and it depended on the workspace's server. Kiro repaired the package. Codex reviewed it and showed that the installed Power alone returns actual pass and stale results, using isolated copies of historical browser evidence. The Power is now version 1.1.0 with explicit project binding. [Installed-package evidence](../evidence/kiro-power-package-fix.md).

## Give automation a narrow job
The duel-presenter agent loads focused guidance. A SessionStart hook runs named checks. A card-save hook regenerates the card catalog after a card specification changes. Compaction hooks preserve a receipt identifier.

A trial of another Workflow, Summoning Circle, proposed a card change, reviewed its requirements, registered it and simulated matches. A four-orb Skeleton changed the simulated outcomes; it remained a proposal. The shipped Skeleton kept three orbs.

Night Watch, our separate Kiro Crew app, compares committed game revisions using matching seeds, records failed checks and prepares GitHub issue drafts. Its reports describe the chosen CPU policies and seeds, not human-player balance. The user enabled version 0.1.2. A manual CLI run and an actual Crew scheduler trigger each saved a report with 65 passing rule tests and 1,000 seeds per revision. A nightly job is registered for 2 a.m. Pacific. It requires the Mac and Crew to be running and uses local Git refs without fetching remote updates. We have not visually verified the latest report after a UI reload or observed a future unattended clock-time run. The earlier browser taskrunner timeout is separate and unresolved. [Activation evidence](../evidence/night-watch-activation.md).

## Look at the actual screen
An earlier Crew browser review found boxed developer labels over Skeleton pieces. Those labels were removed. Passing rules tests had not caught that presentation problem.

The current game uses user-approved cards and title artwork. The Sheriff uses approved, sourced Mixamo idle motion. Original Tripo exports are preserved separately from optimized runtime models. Older attack motions still have known limitations; new motion must come from approved exports or licensed sources.

The deck-builder acceptance criteria name readable card art, typed rules, touch-sized controls, saved counts and no sideways overflow on a phone-sized viewport. Human visual approval remains separate from numerical checks.

## Keep the evidence small and useful
We keep long research notes and transcripts out of the instructions that every AI session loads. A short routing document tells each worker which files it owns and which check to run first. A ledger records who owns each task, how it is accepted and what is handed off next.

The most useful Kiro features produced observable consequences: a spec defined simultaneous attacks, a hook ran a real check, a Workflow reproduced a route, and a reviewer rejected stale evidence.

## What the evidence does not show
The recorded checks support the tested rule behavior and identify the reviewed build. They do not show that anyone wants the game or finds it clear. A five-task first-time playtest is written and has not been run; its results table is blank. Animation feel and visual quality still need human judgment.

- [Play](https://alejandro-publius.github.io/cowboys-vs-wizards/)
- [Game source](https://github.com/alejandro-publius/cowboys-vs-wizards)
- [Kiro evidence](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/main/docs/kiro-brag-sheet.md)
- [Night Watch](https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch)

The public demo link must be added after upload; none is claimed here.

## Who did what
- **User:** art direction and approval of art and motion.
- **Fable:** original engine and CPU, documented character work, and this judge-story text.
- **Kiro:** documented specification, presentation and tooling.
- **Codex:** coordination, integration, selected UI, retargeting and verification.

Where this overview and a task's receipt disagree, the receipt is correct.
