# Judge & Devpost Submission Packaging

## Introduction

Judges evaluate Kiroween 2026 entries across five equal criteria (Potential Impact, Technological Implementation, Design, Innovation/Idea, and Presentation, 10 points each) and may score solely from the text description, images, and demo video. Leading with Kiro's engineering role, explicitly declaring `Category: Costume Contest` in `docs/submission/devpost-packet.md` (which `scripts/scorecard.mjs` checks), mapping how each haunted interface element serves gameplay comprehension, and providing a dedicated Best Kiro Crew App write-up for `cowboys-vs-wizards-night-watch` aligns the repository's public narrative with its tracked `.kiro/` and evidence artifacts.

## Requirements

- JSP-1: THE root `README.md` and `docs/submission/devpost-packet.md` SHALL open with a 30-second pitch naming the audience, the spec-gated playable AI balance workflow in the Night Shift Saloon, and the reusable `packages/frontier-kit` foundation, and SHALL list Kiro first in build attribution while preserving accurate credit for Fable, Codex, Claude Code, Rachel Selbrede, and Alex.
- JSP-2: THE `docs/submission/devpost-packet.md` file SHALL include an explicit `Category: Costume Contest` line accepted by `scripts/scorecard.mjs`, a five-criteria judge evidence table, and a "How the Haunted Costume Does a Job" functional UX table.
- JSP-3: THE `docs/submission/night-watch-crew-writeup.md` file SHALL document the public `alejandro-publius/cowboys-vs-wizards-night-watch` Kiro Crew application for the Best Kiro Crew App bonus track using only verified repository receipts.
- JSP-4: EVERY relative link and anchor across `README.md`, `docs/submission/devpost-packet.md`, and `docs/submission/night-watch-crew-writeup.md` SHALL pass `tests/assets/links.test.mjs`.
