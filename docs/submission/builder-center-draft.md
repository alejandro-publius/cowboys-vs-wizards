<!--
PUBLISHING NOTES (not part of the post)
- Short companion to docs/submission/build-story.md. Publish only between "PUBLISH START" and "PUBLISH END". Nothing has been posted.
- GitHub and the published site are both at c5fa4ee. Every blob link uses https://github.com/alejandro-publius/cowboys-vs-wizards/blob/c5fa4ee/. This draft was written from the b3b4fec snapshot with no network, so confirm each linked path resolves at c5fa4ee.
- The Play and ?saloon=review links work on the published build. The Saloon was verified publicly at 1440 and 390 widths with no live feed. The published judge route is still being rechecked by the coordinator, so this post makes no claim about it.
- The coordinator reran both Billy gate arms over the tracked receipts. The Hellfire probe numbers come from the coordinator's fresh run at b3b4fec (tracked source: scripts/referee/hellfire-parity-probe.mjs).
-->
<!-- PUBLISH START -->
# One attack point shifted the balance in Showdown

In a 100,000-duel bot audit of my Kiroween 2026 card duel, lowering Billy from 2 attack to 1 moves Cowboy wins from **59.792% to 51.920%**. The first fails my written balance gate and the second passes. I haven't applied it: Billy still has 2 attack, the change awaits design approval, and the first-seat edge it leaves is my concern. [Play](https://alejandro-publius.github.io/cowboys-vs-wizards/) or open the [recorded review](https://alejandro-publius.github.io/cowboys-vs-wizards/?saloon=review). Both links work, and GitHub and the published site are at `c5fa4ee`.

## The rule and the run

A Kiro CLI agent proposed the edit under two written rules: each faction's win share within 45% to 55% (NSB-1), and the opening player's distance from 50% growing by at most 1 point (NSB-2). Level-2 bots played 25,000 held-out deals from both seats with both Billys. The [gate script](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/c5fa4ee/scripts/billy-balance-gate.mjs) re-derives every outcome from tracked receipts, and both arms have been rerun over them. See the [audit write-up](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/c5fa4ee/docs/evidence/billy-seat-audit/README.md).

## The edge that remains

The first player wins 59.412% of games at 2 attack and 58.136% at 1. NSB-2 limits growth, not the edge, so that passes. When the Wizards open, Cowboy share falls from 50.380% to 43.784%.

## Try it, and the referee

**Camp ledger → Sheriff's Ledger** replays one deal at both values: the Cowboys win on turn 13 at 2, the Wizards on turn 20 at 1. The `?saloon=review` replay was checked on the published site at 1440 and 390 widths with no live feed.

An independent Python referee disagreed with the engine 2,613 times in 45 duels. A fresh, reproducible hypothetical [probe](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/c5fa4ee/scripts/referee/hellfire-parity-probe.mjs) at `b3b4fec` classified the first divergence in all 45 as Hellfire cast on an empty board: the engine rejects it, the referee accepts it, the rulebook is silent. A temporary oracle copy under the engine's rule showed 0 mismatches in 155,868 actions. That is a counterfactual, and the real rule decision is open.

Kiro's [`PostFileSave` hook](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/c5fa4ee/.kiro/hooks/check-outrider-gate.json) failed a deliberate rules edit and passed the revert.

## Who did what

**Kiro CLI:** the proposal run, spec and reviewer, audit Workflow, hook, and a read-only referee triage. **Claude Code:** the Billy Ledger, the first replay verifier and four November 23 Claude Opus 5.5 sessions (referee canaries, a Wizard search). **Fable** (Claude Fable 5.2 in Claude Code) designed the rules, cards, bots and art direction; Fable and I approve card changes.

Code is MIT. Models are Tripo exports, the Sheriff idle motion is from Mixamo, and the title art came from GPT Image in ChatGPT. Reference files in `docs/references/lucca-character-factory/` keep their MIT license and Lucca Cerf attribution. A Claude Code session drafted this; I reviewed it.
<!-- PUBLISH END -->
