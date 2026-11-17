# Making a haunted-Western card duel inspectable with Kiro

Draft for a third-party blog, prepared November 16, 2026. Review against the final release before publishing. This article is written as part of the **Kiroween 2026 hackathon**.

Cowboys vs. Wizards is a browser card duel across three 3D lanes. A free Sheriff can hold a lane. Stronger troops cost sacrifices. When the two sides clash, attacks resolve together—even if an attacker is defeated during the exchange.

That detail became a useful reason to use Kiro: an animation can look convincing and still tell the wrong story about what the rules decided.

## Start with a visible rule
Kiro's Requirements-First Orb Duel specification separated requirements, design and implementation tasks. Fable wrote the pure JavaScript rules engine and CPU. Kiro implemented match selection, presentation and scheduling.

A seeded property compares presentation cues with engine damage events. In a separate Codex mutation experiment, deliberately suppressing defeated attackers made that check fail at seed zero. This was a check of the test, not a production defect that Kiro discovered. Our tests are deterministic seeded loops; they do not include generated counterexamples or shrinking.

## Make the build identify itself
The saved replay Workflow runs actual browser checks and records the HTML hash. The local Orb Duel Review Power supplies the review procedure, and the project MCP inspects the receipt. A matching page and receipt pass. Pairing the same clean receipt with an older page returns stale.

Kiro authored the reviewer server and Power procedure. Codex authored the initial replay Workflow and configured the working workspace MCP connection; Kiro executed and refreshed the Workflow. Installed Power copies and workspace servers can differ, so our reproduction records those versions separately.

## Give automation a narrow job
The duel-presenter agent loads focused guidance. A SessionStart hook runs named checks. A card-save hook regenerates the catalog after a specification changes. Compaction hooks preserve a receipt identifier.

The Summoning Circle trial proposed a card change, reviewed its requirements, registered it and simulated matches. A four-orb Skeleton changed the simulated outcomes; it remained a proposal. The shipped Skeleton kept three orbs.

Night Watch, our separate Crew app, compares committed game revisions using matching seeds, records failed checks and prepares GitHub issue drafts. Its reports describe the chosen CPU policies and seeds, not human-player balance. We distinguish a manual or isolated scheduled run from a continuously active service.

## Look at the actual screen
An earlier Crew browser review found boxed developer labels over Skeleton pieces. Those labels were removed. Passing rules tests had not caught that presentation problem.

The current game uses user-approved cards and title artwork. Sheriff includes approved sourced Mixamo idle motion. Original Tripo exports are preserved separately from optimized runtime models. Older attack motions still have known limitations; new motion must come from approved exports or licensed sources.

The deck-builder acceptance criteria name readable card art, typed rules, touch-sized controls, saved counts and no sideways overflow on a phone-sized viewport. Human visual approval remains separate from numerical checks.

## Keep the evidence small and useful
We keep long research and transcripts out of always-loaded instructions. A short router identifies each worker's files and first check. A durable ledger records ownership, acceptance checks and the next handoff.

The most useful Kiro features produced observable consequences: a spec defined simultaneous attacks, a hook ran a real check, a Workflow reproduced a route, and a reviewer rejected stale evidence.

- [Play](https://alejandro-publius.github.io/cowboys-vs-wizards/)
- [Game source](https://github.com/alejandro-publius/cowboys-vs-wizards)
- [Kiro evidence](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/main/docs/kiro-brag-sheet.md)
- [Night Watch](https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch)

The public demo link must be added after upload; none is claimed here. User: art direction and approval. Fable: documented engine/CPU and character work. Kiro: documented specification, presentation and tooling. Codex: coordination, integration, selected UI, retargeting and verification. Task receipts take precedence over this overview.
