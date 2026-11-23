# Referee first divergence: seed 109, Hellfire on an empty board

Source: `.artifacts/referee/seed-109-first-divergence.json` (kind `rejected-by-engine`, turn 1, step 1). Saved first run: 2,500 inputs, 155,868 actions, 2,477 completed distinct duels, 2,613 disagreements in 45 duels. Triage by Kiro from limited reads only; nothing was rerun.

**Observed action.** Wizard goes first on turn 1 and plays `{type: "spell", cardId: "wizard-hellfire-1"}` with no target. Both boards are empty; no card has been played yet.

**Verdicts.**
- Engine: rejected (`illegal`), state unchanged.
- Referee: accepted. Hellfire moves to the Wizard discard, `allowances.other` becomes false, and no orbs change.

**Code versus written rule.**
- `src/game/showdown/rules.js` `legalActions`: a spell without a target effect is listed only when `enemy.board.some(Boolean)`. `applyAction` throws for anything not listed.
- `proof/referee/referee.py` `_spell`: `damage-all` (Hellfire) needs no target and has no enemy-troop precondition; it rejects only a supplied target.
- `prototypes/showdown/RULEBOOK.md` §4.3 allows "one other card: a spell" per turn with no precondition. §10 "Ghostly" says Hellfire "chooses none" (no target). No line says an untargeted spell needs an enemy troop.

**Does the written rule settle it?** No. The rulebook is silent on casting Hellfire into an empty board, so the referee's permissive reading follows the text and the engine's restriction is unwritten. The rulebook's header says the code wins and the page should be fixed. That makes this a rulebook gap, not a referee bug, but the choice to keep or drop the restriction is a gameplay decision for Fable (issue 143). Side note: the referee docstring cites `rules/RULEBOOK.md`, not `prototypes/showdown/RULEBOOK.md`; I did not check whether the two match.

**First cause versus later differences.** Only this first difference is classified. After it, the two states differ in seed 109 (Hellfire's location, the `other` allowance), so later disagreements in this duel may be cascades. The other disagreements across the 45 duels are unclassified: this note does not claim Hellfire explains them, and it does not explain the 23 inputs that did not complete.

**Reproduction.** Minimal input: seed 109, `first: "wizard"`, the receipt's initial decks, and one action `{"type":"spell","cardId":"wizard-hellfire-1"}`. Once Fable rules on the question, add it as a case in the rule's test file and to the referee's input set. Then rerun the saved 2,500 inputs to count how many of the 45 duels still disagree once the first difference is gone.
