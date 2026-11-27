<!--
PUBLISHING NOTES (not part of the post)
- Publish only what sits between "PUBLISH START" and "PUBLISH END". The November 16 lane-era draft below the end marker is archived history, kept verbatim.
- Front matter has `published: false`. Flip it yourself; nothing has been posted anywhere.
- Source links in this article use c5fa4ee, the published build used for the original checks. The current deployment is identified by its live build.json.
- The recorded Saloon was verified publicly at 1440 and 390 widths with no live feed. On November 26 Codex followed its link into the Ledger and played both Billy endings on public build 6fbbe8c at 390 and 1280 pixels.
- The two Billy gate arms were rerun by the coordinator over the tracked receipts. The terminal excerpt below is still the recorded c8fa7f2 output. Update it if the rerun text differs.
- The Hellfire probe numbers (all 45 first divergences classified, 0 mismatches in 155,868 actions) come from the coordinator's fresh run at b3b4fec. The tracked source is scripts/referee/hellfire-parity-probe.mjs.
-->
<!-- PUBLISH START -->
---
title: "How Kiro tested a one-point balance change in Showdown"
published: false
description: "A 100,000-duel bot audit passes a balance gate for one card change. The first-seat edge remains, the change isn't approved, and the card is unchanged."
tags: gamedev, javascript, testing, ai
---

In a 100,000-duel bot audit, lowering one Cowboy card, Billy, from 2 attack to 1 moves Cowboy wins from **59.792% to 51.920%**. The first number fails my written balance gate (exit 2) and the second passes (exit 0). I haven't applied it: Billy still has 2 attack, the change awaits design approval, and the opening-player edge it leaves behind is what worries me.

This post is being written as part of the Kiroween 2026 hackathon, covering my entry *Cowboys vs. Wizards: Showdown*, a haunted-Western card duel. I’ve linked the source from the version used for this write-up, `c5fa4ee`. You can play the deal on the current site. [Play Showdown](https://alejandro-publius.github.io/cowboys-vs-wizards/) · [Open the recorded review](https://alejandro-publius.github.io/cowboys-vs-wizards/?saloon=review)

## The rule, the numbers, the controls

A Kiro CLI agent proposed the edit. The pass/fail rule sits in a spec file the agent can't edit, and the protocol was published before the run:

- **NSB-1:** Each faction's win share SHALL be within 45% to 55%, inclusive.
- **NSB-2:** The opening player's absolute win-share distance from 50% SHALL grow by at most 1 percentage point versus the baseline.

Level-2 bots played 25,000 held-out deals from both seats with both versions of Billy, in the Node engine frozen at `eedab93`: 100,000 duels, 50,000 matched pairs.

The [gate script](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/c5fa4ee/scripts/billy-balance-gate.mjs) re-derives every outcome from the tracked `outcomes.csv.gz` and checks two SHA-256 digests first. Both arms have since been rerun over the tracked receipts. On a disposable copy, narrowing NSB-1 to 49–51 turned the same 51.920% RED. The audit ran as Kiro CLI Workflow `wf_27f8bf0bb063c889` with a [read-only auditor agent](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/c5fa4ee/.kiro/agents/showdown-seat-auditor.json); the [write-up](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/c5fa4ee/docs/evidence/billy-seat-audit/README.md) lists six rejected attempts at other cards.

## What the gate lets through

- **The opening edge stays.** The first player wins 59.412% of games at 2 attack and 58.136% at 1. NSB-2 limits growth, not the edge, so a 58% opening advantage passes.
- **It overshoots by seat.** When the Wizards open, Cowboy share falls from 50.380% to 43.784%. NSB-1 judges seats combined, so this still passes.
- **Bots, not people.** No first-time player has played this build to a recorded result.

## Replay one deal both ways

In the game, open **Camp → Camp ledger → Sheriff's Ledger** and step through seed 726421019 at 2 attack and at the proposed 1. At 2 attack the Cowboys win on turn 13. At 1 the Bone Wall survives on 1 orb and the Wizards win on turn 20. I picked this deal after the cohort was recorded, so it's an illustration, not a typical game.

The [`?saloon=review`](https://alejandro-publius.github.io/cowboys-vs-wizards/?saloon=review) link opens a recorded Kiro shift ending on the written rule, the measured shares and the recheck command. It was checked on the published site at 1440 and 390 widths with no live feed.

## One native hook

A `PostFileSave` hook, [`check-outrider-gate.json`](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/c5fa4ee/.kiro/hooks/check-outrider-gate.json), replays ten recorded Outrider positions when an engine file is saved:

```json
{
  "trigger": "PostFileSave",
  "matcher": "(^|/)(src/game/showdown/[^/]+\\.js|src/game/card-specs\\.generated\\.js|…)$",
  "action": { "type": "command", "command": "node scripts/check-outrider-gate-hook.mjs" }
}
```

In a Kiro CLI session on November 20, a deliberate `rules.js` edit (a ride strike past troops cost 2 orbs, not 1) produced a `failed` [receipt](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/c5fa4ee/docs/evidence/outrider-gate/hook-receipts.jsonl): "0 fresh, 10 stale". Saving the revert gave `passed`, "10 fresh". The receipts carry the Kiro session id. There was no Kiro IDE run.

## The referee's 2,613 disagreements

An independent Python referee, written from the rulebook and card spreadsheet, disagreed with the engine 2,613 times in 45 duels over 2,500 inputs (155,868 actions). Its verdict is `fail`.

A fresh, reproducible hypothetical [probe](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/c5fa4ee/scripts/referee/hellfire-parity-probe.mjs) at `b3b4fec` classified the first divergence in all 45 duels as one case: Hellfire cast on an empty board. The engine rejects it, the referee accepts it, and the rulebook is silent. With a temporary oracle copy under the engine's rule, the probe found 0 mismatches in 155,868 actions. That is a counterfactual, not a result: the frozen referee and receipt are unchanged, and whether Hellfire needs an enemy troop is a gameplay ruling that is still open. The referee hasn't been run against the Billy candidate.

## Who did what

- **Kiro CLI:** the proposal run, spec and reviewer, audit Workflow, save hook, receipt-checking Power, a read-only referee triage and a browser test fixture fix. It changed no rule or card.
- **Claude Code:** the Billy Ledger, its tests and the first replay verifier, plus four November 23 sessions on Claude Opus 5.5: referee browser canaries, a transcript generator, a repaired history runner and a Wizard search.
- **Fable** (Claude Fable 5.2 in Claude Code) designed the rules, cards, bots and art direction. Fable and I approve card changes, and this one isn't approved. **Codex** measured the 10,000-game sample. I handled art direction, Tripo exports and merging.

The code is MIT licensed. Models are Tripo exports, the Sheriff idle motion is sourced from Mixamo, and the title illustration was generated with GPT Image in ChatGPT and approved on November 16, 2026. Reference files in `docs/references/lucca-character-factory/` keep their MIT license and attribution to Lucca Cerf. A Claude Code session drafted this post and I reviewed it.

[Source](https://github.com/alejandro-publius/cowboys-vs-wizards/tree/c5fa4ee) · [Kiro evidence map](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/c5fa4ee/docs/kiro-brag-sheet.md) · [Night Watch](https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch)
<!-- PUBLISH END -->

---

# Archive (not part of the post): November 16 lane-era draft, verbatim

The text below is the previous contents of this file, kept unchanged as history. It describes the retired three-lane duel.

# Making a haunted-Western card duel inspectable with Kiro

> **Lane-era draft (November 16, 2026).** It describes the three-lane duel. The December 4 entry is Showdown; its current Kiro answers and proof are in the [judge write-up](kiro-brag-sheet.md). Kept as history.

Draft for a third-party blog, prepared November 16, 2026. Review against the final release before publishing. This article is written as part of the **Kiroween 2026 hackathon**.

Cowboys vs. Wizards is a browser card duel across three 3D lanes. A free Sheriff can hold a lane. Stronger troops cost sacrifices, called tributes. Each troop and each Base has life orbs, and each orb is one life. When the two sides clash, attacks resolve together, even if an attacker is defeated during the exchange.

We built it for people who play strategy and card games in a browser. Our hypothesis is that these players often cannot see why a round went the way it did, because the result arrives as changed numbers or a log line. So we put the decision on the board. Where a troop stands decides what it fights, and both halves of a clash play out in the arena. We have not tested the hypothesis: no first-time player has been observed yet. Lane-based card duels are also not a new genre.

What we can show is narrower: positional three-lane decisions, simultaneous outcomes you can watch, and evidence that names the build it was produced from. The clearest example is the match that starts from seed 60. (A seed is a number that makes a match repeatable.) Two tribute summons bring in Mounted Billy with five life orbs. A Singularity spell pulls him into the center lane, and the Wizards summon the Dragon opposite him. In the clash he is defeated and still takes the Dragon from five orbs to two.

That exchange became a useful reason to use Kiro: an animation can look convincing and still tell the wrong story about what the rules decided.

## Start with a visible rule
Kiro's Requirements-First Orb Duel specification separated requirements, design and implementation tasks. Fable, the model used in our Claude Code sessions, wrote the pure JavaScript rules engine and CPU. Kiro implemented match selection, presentation and scheduling.

One seeded test compares what the presentation shows with the damage events the engine produced. In a separate experiment, Codex, the coding assistant coordinating the project, deliberately introduced a fault that suppressed defeated attackers, and that test failed at seed zero. The experiment checked the test itself; it was not a production defect that Kiro discovered. Our tests loop over fixed seeds. They do not generate counterexamples or shrink them.

## Make the build identify itself
The saved replay Workflow runs actual browser checks and writes a receipt: a record of the run that includes the hash (a fingerprint) of the HTML it tested. The Orb Duel Review Power, a package installed into Kiro, supplies the review procedure and now bundles its own MCP server to inspect the receipt. A page and a receipt that match pass. Pairing the same clean receipt with an older page returns `stale`.

On its final run the saved Workflow passed 157 tests and 12 scripted browser checks: eight steps of the seed 0 opening and four of the seed 60 showdown, with no console errors. That run belongs to frozen commit `02b1bf8`, and the figures describe that commit; an earlier run on `e9aeb06` gave the same counts. Any later change to the game needs its own checks. [Final run evidence](../evidence/kiro-final-polish-verification.md).

Kiro wrote the reviewer server and the Power's procedure. Codex wrote the first replay Workflow and set up the working workspace MCP connection; Kiro ran and refreshed the Workflow. The first attempt to reproduce the review exposed two problems: the installed copy of the Power was out of date, and it depended on the workspace's server. Kiro repaired the package. Codex reviewed it and showed that the installed Power alone returns actual pass and stale results, using isolated copies of historical browser evidence. The Power is now version 1.1.0 with explicit project binding. [Installed-package evidence](../evidence/kiro-power-package-fix.md).

## Give automation a narrow job
The duel-presenter agent loads focused guidance. A SessionStart hook runs named checks. A card-save hook regenerates the card catalog after a card specification changes. Compaction hooks preserve a receipt identifier.

A trial of another Workflow, Summoning Circle, proposed a card change, reviewed its requirements, registered it and simulated matches. A four-orb Skeleton changed the simulated outcomes; it remained a proposal. The shipped Skeleton kept three orbs.

Night Watch, our separate Kiro Crew app, compares committed game revisions using matching seeds, records failed checks and prepares GitHub issue drafts. Its reports describe the chosen CPU policies and seeds, not human-player balance. The user enabled version 0.1.2. A manual CLI run and an actual Crew scheduler trigger each saved a report with 65 passing rule tests and 1,000 seeds per revision. A nightly job is registered for 2 a.m. Pacific. It requires the Mac and Crew to be running and uses local Git refs without fetching remote updates. We have not visually verified the latest report after a UI reload or observed a future unattended clock-time run. The earlier browser taskrunner timeout is separate and unresolved. [Activation evidence](../evidence/night-watch-activation.md).

## Look at the actual screen
An earlier Crew browser review found boxed developer labels over Skeleton pieces. Those labels were removed. Passing rules tests had not caught that presentation problem.

It happened again with a different engine. A scripted check in Playwright's WebKit build, the engine behind Safari, saw all seven of its steps, from the title menu to a summoned troop, while every card in the hand was drawn as a blank rectangle. The defect was found by looking at the screenshot. It is recorded as an open finding, and it has not been confirmed in Safari itself. [WebKit evidence](../evidence/webkit-smoke.md).

The current game uses user-approved cards and title artwork. The Sheriff uses approved, sourced Mixamo idle motion. Original Tripo exports are preserved separately from optimized runtime models. Older attack motions still have known limitations; new motion must come from approved exports or licensed sources.

The deck-builder acceptance criteria name readable card art, rules written as page text of at least 16px, touch-sized controls, saved counts and no sideways overflow on a phone-sized viewport. Human visual approval remains separate from numerical checks.

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
