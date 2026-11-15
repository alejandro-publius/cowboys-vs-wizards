# Task 01 — deterministic orb-duel engine

Prepared by Codex for execution in Kiro. The user authorized continued implementation and asked to conserve credits. These numeric rules are the current playable draft, to be balanced after playtesting.

## Scope and budget

Read this file, `package.json`, `.kiro/specs/orb-duel/requirements.md`, and `.kiro/steering/build-evidence.md`. Implement the headless match engine and its focused checks. Keep the current Three.js board demo intact. Use plain JavaScript and Node's built-in test runner. No new packages, web research, subagents, new art, Firebase, Unity migration, or automatic repeat-review loops in this task. The animation pass will separately use the user's Lucca Cerf reference.

Patch contradictory requirements rather than adding another large spec. Add a short `design.md` (maximum 80 lines) and `tasks.md` (maximum 12 top-level tasks), completing only the engine milestone. Then implement it. Stop with a concise report and the real test results.

## Rules for this milestone

- Three lanes per side, five base orbs. Troop health is integer 0..max, with max 1..5; zero means defeated. Stars indicate summon tier, never a spendable resource.
- Each deck has 12 uniquely identified card instances. Shuffle reproducibly by seed, opening hand four, no round-1 draw. Draw one per side at the start of rounds 2..9 if available. Empty deck alone does not end a match.
- Each round, players act sequentially; starting side is seeded and alternates each round. Each side may summon at most once and cast at most once, then end its action phase. A summon must precede its spell if it plays both. No action timer. After both sides end, resolve one simultaneous clash and begin the next round unless finished.
- Sacrifice costs: stars 1..4 = zero troops; 5..6 = one; 7+ = two. Sacrifices are chosen distinct friendly troops. Commit the card, sacrifices, destination and summon allowance atomically only after all inputs validate. On a full board a sacrifice summon can use a tile being vacated. Invalid actions and cancelled selections do not alter state or RNG.
- Every troop attacks its opposing lane, including newly summoned troops. Snapshot attacks for all lanes, apply all damage, then remove defeated units and decide the result. An opposing troop absorbs the full attack; excess does not hit the base. An empty opposing lane takes the attack's full damage on that base, symmetrically for both factions. Clamp all health at zero.
- Both bases zero in the same resolution = draw. Otherwise a zero base loses. After round 9 clash, higher base health wins, equal = draw. A terminal match rejects further actions.
- Cowboy deck: Sheriff 2 stars / 3 health / 1 attack x6; Billy 5 / 4 / 2 x3; Mounted Billy 7 / 5 / 3 x1; Deadeye x2 (remove one orb from a chosen living enemy troop).
- Wizard deck: Skeleton 1 / 3 / 1 x6; Wizard 5 / 4 / 2 x3; Dragon 8 / 5 / 3 x1; Singularity x2 (remove one orb from a chosen enemy troop, then optionally move a survivor to a chosen adjacent empty enemy lane). Damage and relocation are one validated action; no movement of defeated troops. Spells with no valid target cannot be spent.
- Card-instance ownership is exactly one of deck, hand, board, or discard. Defeated/sacrificed troops and resolved spells go to discard exactly once. No duplicates or creating new card instances mid-match.
- Expose a small pure API: create seeded match, list legal actions, apply an action, and derive public state/events for a later renderer. Include stable action IDs or expected state revision to reject duplicate/stale UI submissions. Keep renderer and animation out of the engine.
- Add a reproducible CPU baseline that chooses only legal actions, sees its own hand plus public board (no opponent hand/deck order), and completes a match. Prefer a simple documented heuristic with deterministic ties, not an LLM.

## Required verification

Use focused examples for full-board tribute, invalid-action atomicity, reciprocal open-lane damage, simultaneous mutual kills/base draws, spell relocation/death, stale duplicate actions, round limit, and deterministic replay. Add reproducible seeded legal-action walks across multiple seeds checking card conservation, health bounds and per-round limits. Describe randomized invariant checks accurately; do not claim an external PBT library was used.

Save the run command, seed range/count and actual results under `docs/evidence/`. Append one concise entry to `docs/kiro-build-log.md` identifying Kiro and the spec changes actually made. Do not claim browser/animation verification, asset readiness or balance from these engine tests.

## Known spec errors to remove

Requirements 7.3 currently protects the player's open lanes; fix symmetry. Requirements 3/12 currently forbid every full-board tribute; allow paid tribute. Requirements 4/8 spend cards before confirmation; make atomic. Requirement 9 invents a star resource; remove it. Requirement 10 halts before simultaneous results; fix it. Remove the invented 60-second timer, mandatory 1..8-star deck coverage, no-effect spell stubs, and one-star Billy/Wizard overrides. Missing 3D models are asset blockers for a future rendering task, not permission to change game rules or claim replacement models are final.
